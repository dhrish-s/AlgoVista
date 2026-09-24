import assert from 'node:assert/strict';
import test from 'node:test';
import { appendAITelemetry, clearAITelemetry, exportAITelemetryJSON, getAITelemetryEntries, isAITelemetryEnabled, recordAITelemetry } from '../src/services/ai/AITelemetry';
import { AIProviderManager } from '../src/services/ai/AIProviderManager';
import { AIProvider, AIProviderID, AIProviderSettings } from '../src/services/ai/types';

test('enables AI telemetry only when the development flag is explicitly true', () => {
  const previousFlag = process.env.VITE_AI_TELEMETRY;
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.VITE_AI_TELEMETRY;
  process.env.NODE_ENV = 'development';
  assert.equal(isAITelemetryEnabled(), false);
  process.env.VITE_AI_TELEMETRY = 'true';
  assert.equal(isAITelemetryEnabled(), true);
  process.env.NODE_ENV = 'production';
  assert.equal(isAITelemetryEnabled(), false);
  if (previousFlag === undefined) delete process.env.VITE_AI_TELEMETRY;
  else process.env.VITE_AI_TELEMETRY = previousFlag;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

test('keeps only the latest 500 telemetry records and returns defensive copies', () => {
  clearAITelemetry();
  for (let index = 0; index < 505; index += 1) {
    appendAITelemetry({
      timestamp: `2026-01-01T00:00:${String(index).padStart(2, '0')}Z`,
      operation: 'step-generation',
      provider: 'openai',
      model: `model-${index}`,
      latencyMs: index,
      payload: { staticCharacters: index, variableCharacters: 1, totalCharacters: index + 1 },
      outcome: 'success'
    });
  }

  const records = getAITelemetryEntries();
  assert.equal(records.length, 500);
  assert.equal(records[0].model, 'model-5');
  records[0].payload.staticCharacters = -1;
  assert.equal(getAITelemetryEntries()[0].payload.staticCharacters, 5);
  clearAITelemetry();
});

test('records normalized provider usage only while telemetry is enabled', () => {
  const previousFlag = process.env.VITE_AI_TELEMETRY;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  delete process.env.VITE_AI_TELEMETRY;
  clearAITelemetry();
  const entry = {
    operation: 'step-generation' as const,
    provider: 'claude' as const,
    model: 'test-model',
    usage: { inputTokens: 20, outputTokens: 30, cacheReadTokens: 4, cacheWriteTokens: 2 },
    latencyMs: 50,
    payload: { staticCharacters: 100, variableCharacters: 25, totalCharacters: 125 },
    outcome: 'success' as const
  };
  recordAITelemetry(entry);
  assert.equal(getAITelemetryEntries().length, 0);
  process.env.VITE_AI_TELEMETRY = 'true';
  recordAITelemetry(entry);
  const recorded = getAITelemetryEntries()[0];
  assert.equal(recorded.inputTokens, 20);
  assert.equal(recorded.outputTokens, 30);
  assert.equal(recorded.cacheReadTokens, 4);
  assert.equal(recorded.cacheWriteTokens, 2);
  assert.deepEqual(recorded.payload, entry.payload);
  clearAITelemetry();
  if (previousFlag === undefined) delete process.env.VITE_AI_TELEMETRY;
  else process.env.VITE_AI_TELEMETRY = previousFlag;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

test('exports the current telemetry buffer as formatted JSON', () => {
  clearAITelemetry();
  appendAITelemetry({
    timestamp: '2026-01-01T00:00:00.000Z',
    operation: 'problem-parsing',
    provider: 'gemini',
    model: 'test-model',
    latencyMs: 10,
    payload: { staticCharacters: 40, variableCharacters: 10, totalCharacters: 50 },
    outcome: 'success'
  });
  assert.deepEqual(JSON.parse(exportAITelemetryJSON()), getAITelemetryEntries());
  assert.match(exportAITelemetryJSON(), /\n  \{/);
  clearAITelemetry();
});

test('records rejected provider attempts and the fallback that succeeds', async () => {
  const previousFlag = process.env.VITE_AI_TELEMETRY;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.VITE_AI_TELEMETRY = 'true';
  process.env.NODE_ENV = 'development';
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';
  clearAITelemetry();

  const settings: AIProviderSettings = {
    defaultProvider: 'openai',
    fallbackProvider: 'claude',
    modelNames: { gemini: 'test-gemini', openai: 'test-openai', claude: 'test-claude' },
    taskRouting: { steps: 'openai' }
  };
  const rejectedMetrics = { staticCharacters: 100, variableCharacters: 20, totalCharacters: 120 };
  const primary = {
    id: 'openai',
    generateSteps: async () => ({
      data: [],
      usage: { inputTokens: 10, outputTokens: 5 },
      requestMetrics: rejectedMetrics
    })
  } as unknown as AIProvider;
  const fallback = {
    id: 'claude',
    generateSteps: async () => ({
      data: [{
        id: 'done', line: 1, explanation: 'Return.', operationType: 'return',
        variables: {}, visualState: { array: [] }
      }],
      usage: { inputTokens: 12, outputTokens: 8 },
      requestMetrics: { staticCharacters: 100, variableCharacters: 20, totalCharacters: 120 }
    })
  } as unknown as AIProvider;
  const manager = new AIProviderManager(settings);
  const providers = (manager as unknown as { providers: Map<AIProviderID, AIProvider> }).providers;
  providers.set('openai', primary);
  providers.set('claude', fallback);

  await manager.generateSteps({}, '', {});

  const records = getAITelemetryEntries();
  assert.equal(records.length, 3);
  assert.deepEqual(records.map((record) => record.outcome), ['rejected', 'rejected', 'fallback']);
  assert.equal(records[0].inputTokens, 10);
  assert.deepEqual(records[0].payload, rejectedMetrics);
  assert.equal(records[2].provider, 'claude');
  clearAITelemetry();
  if (previousFlag === undefined) delete process.env.VITE_AI_TELEMETRY;
  else process.env.VITE_AI_TELEMETRY = previousFlag;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

test('records a successful primary provider attempt', async () => {
  const previousFlag = process.env.VITE_AI_TELEMETRY;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.VITE_AI_TELEMETRY = 'true';
  process.env.NODE_ENV = 'development';
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  clearAITelemetry();

  const manager = new AIProviderManager({
    defaultProvider: 'openai',
    fallbackProvider: 'claude',
    modelNames: { gemini: 'test-gemini', openai: 'test-openai', claude: 'test-claude' },
    taskRouting: {}
  });
  const provider = {
    id: 'openai',
    parseProblem: async () => ({
      data: { title: 'Two Sum' },
      usage: { inputTokens: 7, outputTokens: 3 },
      requestMetrics: { staticCharacters: 40, variableCharacters: 7, totalCharacters: 47 }
    })
  } as unknown as AIProvider;
  (manager as unknown as { providers: Map<AIProviderID, AIProvider> }).providers.set('openai', provider);

  await manager.parseProblem('Two Sum');

  const records = getAITelemetryEntries();
  assert.equal(records.length, 1);
  assert.equal(records[0].outcome, 'success');
  assert.equal(records[0].provider, 'openai');
  assert.equal(records[0].inputTokens, 7);
  clearAITelemetry();
  if (previousFlag === undefined) delete process.env.VITE_AI_TELEMETRY;
  else process.env.VITE_AI_TELEMETRY = previousFlag;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

test('records a timed-out provider before fallback succeeds', async () => {
  const previousFlag = process.env.VITE_AI_TELEMETRY;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.VITE_AI_TELEMETRY = 'true';
  process.env.NODE_ENV = 'development';
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';
  clearAITelemetry();

  const manager = new AIProviderManager({
    defaultProvider: 'openai',
    fallbackProvider: 'claude',
    modelNames: { gemini: 'test-gemini', openai: 'test-openai', claude: 'test-claude' },
    taskRouting: {}
  });
  const primary = {
    id: 'openai',
    parseProblem: async () => new Promise(() => undefined)
  } as unknown as AIProvider;
  const fallback = {
    id: 'claude',
    parseProblem: async () => ({ data: { title: 'Two Sum' } })
  } as unknown as AIProvider;
  const providers = (manager as unknown as { providers: Map<AIProviderID, AIProvider> }).providers;
  providers.set('openai', primary);
  providers.set('claude', fallback);

  await manager.parseProblem('Two Sum', { timeoutMs: 5 });

  const records = getAITelemetryEntries();
  assert.deepEqual(records.map((record) => record.outcome), ['timeout', 'fallback']);
  assert.match(records[0].message || '', /timed out after 5 ms/);
  clearAITelemetry();
  if (previousFlag === undefined) delete process.env.VITE_AI_TELEMETRY;
  else process.env.VITE_AI_TELEMETRY = previousFlag;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});
