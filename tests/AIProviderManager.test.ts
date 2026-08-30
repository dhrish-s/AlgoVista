import assert from 'node:assert/strict';
import test from 'node:test';
import { AIProviderManager } from '../src/services/ai/AIProviderManager';
import { AIProvider, AIProviderID, AIProviderSettings } from '../src/services/ai/types';
import { ExecutionStep } from '../src/types';

process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
process.env.VITE_CLAUDE_API_KEY = 'test-claude-key';

const validTrace: ExecutionStep[] = ['initialize', 'compare', 'finish'].map((id, index) => ({
  id,
  line: index + 1,
  explanation: `Execute ${id}`,
  operationType: index === 0 ? 'init' : index === 1 ? 'compare' : 'return',
  variables: {},
  visualState: { array: [1, 2, 3] }
}));

const settings: AIProviderSettings = {
  defaultProvider: 'openai',
  fallbackProvider: 'claude',
  modelNames: {
    gemini: 'test-gemini',
    openai: 'test-openai',
    claude: 'test-claude'
  },
  taskRouting: { steps: 'openai' }
};

const createProvider = (
  id: AIProviderID,
  generate: () => unknown
): { provider: AIProvider; getCalls: () => number } => {
  let calls = 0;
  const provider = {
    id,
    generateSteps: async () => {
      calls += 1;
      return { data: generate() };
    }
  } as unknown as AIProvider;

  return { provider, getCalls: () => calls };
};

const createManager = (primary: AIProvider, fallback: AIProvider) => {
  const manager = new AIProviderManager(settings);
  const providers = (manager as unknown as { providers: Map<AIProviderID, AIProvider> }).providers;
  providers.set('openai', primary);
  providers.set('claude', fallback);
  return manager;
};

test('falls back when the primary provider returns an empty trace', async () => {
  const primary = createProvider('openai', () => []);
  const fallback = createProvider('claude', () => validTrace);
  const manager = createManager(primary.provider, fallback.provider);

  const response = await manager.generateSteps({}, '', {}, { task: 'steps' });

  assert.equal(response.meta?.provider, 'claude');
  assert.equal(response.meta?.status, 'fallback');
  assert.equal(response.data.length, 3);
  assert.equal(fallback.getCalls(), 1);
});

test('falls back when every primary-provider step is malformed', async () => {
  const primary = createProvider('openai', () => [null, { id: '', operationType: 'unknown' }]);
  const fallback = createProvider('claude', () => validTrace);
  const manager = createManager(primary.provider, fallback.provider);

  const response = await manager.generateSteps({}, '', {}, { task: 'steps' });

  assert.equal(response.meta?.provider, 'claude');
  assert.equal(response.meta?.status, 'fallback');
  assert.equal(response.data.length, 3);
  assert.equal(fallback.getCalls(), 1);
});

test('accepts a valid three-step primary trace without falling back', async () => {
  const primary = createProvider('openai', () => validTrace);
  const fallback = createProvider('claude', () => validTrace);
  const manager = createManager(primary.provider, fallback.provider);

  const response = await manager.generateSteps({}, '', {}, { task: 'steps' });

  assert.equal(response.meta?.provider, 'openai');
  assert.equal(response.meta?.status, 'success');
  assert.equal(response.data.length, 3);
  assert.equal(primary.getCalls(), 1);
  assert.equal(fallback.getCalls(), 0);
});
