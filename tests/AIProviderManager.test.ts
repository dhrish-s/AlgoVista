import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_OPERATION_TIMEOUT_MS, AIProviderManager } from '../src/services/ai/AIProviderManager';
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

test('assigns operation-specific AI request deadlines', () => {
  assert.deepEqual(AI_OPERATION_TIMEOUT_MS, {
    'problem-parsing': 45_000,
    'solution-generation': 45_000,
    'step-generation': 180_000,
    'small-helper': 30_000
  });
});

test('passes the actual operation identity to each provider request', async () => {
  const operations: Array<string | undefined> = [];
  const provider = {
    id: 'openai',
    parseProblem: async (_input: string, options?: { operation?: string }) => {
      operations.push(options?.operation);
      return { data: {} };
    },
    generateSolution: async (_problem: unknown, _approach: unknown, options?: { operation?: string }) => {
      operations.push(options?.operation);
      return { data: { code: 'function solve(): boolean { return true; }', language: 'typescript' } };
    },
    generateSteps: async (_problem: unknown, _code: string, _case: unknown, options?: { operation?: string }) => {
      operations.push(options?.operation);
      return { data: validTrace };
    },
    evaluateReasoning: async (_problem: unknown, _reasoning: string, options?: { operation?: string }) => {
      operations.push(options?.operation);
      return { data: { isValid: true, score: 1, feedback: 'Good.' } };
    }
  } as unknown as AIProvider;
  const manager = createManager(provider, provider);

  await manager.parseProblem('test');
  await manager.generateSolution({}, {});
  await manager.generateSteps({}, '', {});
  await manager.evaluateReasoning({}, 'reasoning');

  assert.deepEqual(operations, [
    'problem-parsing',
    'solution-generation',
    'step-generation',
    'small-helper'
  ]);
});

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

test('falls back when the primary provider returns a malformed tree base', async () => {
  const primary = createProvider('openai', () => [{
    ...validTrace[0],
    visualState: {
      treeBase: {
        nodes: [{ id: 'root', value: 1, children: ['missing'] }],
        rootId: 'root'
      },
      treeDelta: {}
    }
  }]);
  const fallback = createProvider('claude', () => validTrace);
  const manager = createManager(primary.provider, fallback.provider);

  const response = await manager.generateSteps({}, '', {}, { task: 'steps' });

  assert.equal(response.meta?.provider, 'claude');
  assert.equal(response.meta?.status, 'fallback');
  assert.equal(fallback.getCalls(), 1);
});

test('falls back when the primary provider returns a malformed graph base', async () => {
  const primary = createProvider('openai', () => [{
    ...validTrace[0],
    visualState: {
      graphBase: {
        nodes: [{ id: 'a', value: 'A' }],
        edges: [{ id: 'a-b', source: 'a', target: 'missing' }]
      },
      graphDelta: {}
    }
  }]);
  const fallback = createProvider('claude', () => validTrace);
  const manager = createManager(primary.provider, fallback.provider);

  const response = await manager.generateSteps({}, '', {}, { task: 'steps' });

  assert.equal(response.meta?.provider, 'claude');
  assert.equal(response.meta?.status, 'fallback');
  assert.equal(fallback.getCalls(), 1);
});

test('falls back when the primary provider returns a malformed DP table base', async () => {
  const primary = createProvider('openai', () => [{
    ...validTrace[0],
    visualState: {
      dpTableBase: { rows: 2, columns: 2, columnLabels: ['only-one'] },
      dpTableDelta: {}
    }
  }]);
  const fallback = createProvider('claude', () => validTrace);
  const manager = createManager(primary.provider, fallback.provider);

  const response = await manager.generateSteps({}, '', {}, { task: 'steps' });

  assert.equal(response.meta?.provider, 'claude');
  assert.equal(response.meta?.status, 'fallback');
  assert.equal(fallback.getCalls(), 1);
});

test('falls back when the primary provider returns a malformed linked-list base', async () => {
  const primary = createProvider('openai', () => [{
    ...validTrace[0],
    visualState: {
      linkedListBase: {
        nodes: [{ id: 'head', value: 1, nextId: 'missing' }],
        headId: 'head'
      },
      linkedListDelta: {}
    }
  }]);
  const fallback = createProvider('claude', () => validTrace);
  const manager = createManager(primary.provider, fallback.provider);

  const response = await manager.generateSteps({}, '', {}, { task: 'steps' });

  assert.equal(response.meta?.provider, 'claude');
  assert.equal(response.meta?.status, 'fallback');
  assert.equal(fallback.getCalls(), 1);
});

test('attributes a final error to the fallback provider that actually failed', async () => {
  const primary = createProvider('openai', () => []);
  const fallback = createProvider('claude', () => {
    throw new Error('Claude request failed.');
  });
  const manager = createManager(primary.provider, fallback.provider);

  await assert.rejects(
    manager.generateSteps({}, '', {}, { task: 'steps' }),
    (error: Error & { provider?: AIProviderID; requestedProvider?: AIProviderID; status?: string }) => {
      assert.equal(error.provider, 'claude');
      assert.equal(error.requestedProvider, 'openai');
      assert.equal(error.status, 'unavailable');
      assert.match(error.message, /claude provider/i);
      return true;
    }
  );
});

test('aborts a hanging primary request on timeout and uses the fallback', async () => {
  let primarySignalWasAborted = false;
  const primary = {
    id: 'openai',
    generateSteps: async (_problem: unknown, _code: string, _testCase: unknown, options?: { signal?: AbortSignal }) => {
      options?.signal?.addEventListener('abort', () => {
        primarySignalWasAborted = true;
      });
      return new Promise<never>(() => {});
    }
  } as unknown as AIProvider;
  const fallback = createProvider('claude', () => validTrace);
  const manager = createManager(primary, fallback.provider);

  const response = await manager.generateSteps({}, '', {}, { task: 'steps', timeoutMs: 10 });

  assert.equal(primarySignalWasAborted, true);
  assert.equal(response.meta?.provider, 'claude');
  assert.equal(response.meta?.status, 'fallback');
  assert.equal(fallback.getCalls(), 1);
});

test('surfaces a timeout when every attempted provider hangs', async () => {
  const createHangingProvider = (id: AIProviderID) => ({
    id,
    generateSteps: async () => new Promise<never>(() => {})
  } as unknown as AIProvider);
  const manager = createManager(createHangingProvider('openai'), createHangingProvider('claude'));

  await assert.rejects(
    manager.generateSteps({}, '', {}, { task: 'steps', timeoutMs: 10 }),
    (error: Error & { provider?: AIProviderID; status?: string }) => {
      assert.equal(error.provider, 'claude');
      assert.equal(error.status, 'unavailable');
      assert.match(error.message, /claude provider timed out/i);
      return true;
    }
  );
});

test('keeps caller cancellation distinct from a provider timeout', async () => {
  const controller = new AbortController();
  const primary = {
    id: 'openai',
    generateSteps: async () => new Promise<never>(() => {})
  } as unknown as AIProvider;
  const fallback = createProvider('claude', () => validTrace);
  const manager = createManager(primary, fallback.provider);
  setTimeout(() => controller.abort(), 5);

  await assert.rejects(
    manager.generateSteps({}, '', {}, { task: 'steps', signal: controller.signal, timeoutMs: 100 }),
    (error: Error) => {
      assert.equal(error.name, 'AbortError');
      assert.match(error.message, /cancelled/i);
      return true;
    }
  );
  assert.equal(fallback.getCalls(), 0);
});

test('falls back when generated solution code is malformed', async () => {
  const primary = {
    id: 'openai',
    generateSolution: async () => ({ data: { code: '', language: 'typescript' } })
  } as unknown as AIProvider;
  const fallback = {
    id: 'claude',
    generateSolution: async () => ({
      data: { code: 'function solve(): boolean {\n  return true;\n}', language: 'typescript' }
    })
  } as unknown as AIProvider;
  const manager = createManager(primary, fallback);

  const response = await manager.generateSolution({}, {}, { task: 'steps' });

  assert.equal(response.meta?.provider, 'claude');
  assert.equal(response.meta?.status, 'fallback');
  assert.match(response.data.code, /function solve/);
});

test('passes the requested language to providers and validates the same language', async () => {
  let receivedLanguage: string | undefined;
  const primary = {
    id: 'openai',
    generateSolution: async (_problem: unknown, _approach: unknown, options?: { solutionLanguage?: string }) => {
      receivedLanguage = options?.solutionLanguage;
      return { data: { code: 'def solve():\n    return True', language: 'python' } };
    }
  } as unknown as AIProvider;
  const manager = createManager(primary, primary);

  const response = await manager.generateSolution({}, {}, {
    task: 'steps',
    solutionLanguage: 'python'
  });

  assert.equal(receivedLanguage, 'python');
  assert.equal(response.data.language, 'python');
});

test('aborts timed-out solution generation and continues to fallback', async () => {
  let primarySignalWasAborted = false;
  const primary = {
    id: 'openai',
    generateSolution: async (_problem: unknown, _approach: unknown, options?: { signal?: AbortSignal }) => {
      options?.signal?.addEventListener('abort', () => {
        primarySignalWasAborted = true;
      });
      return new Promise<never>(() => {});
    }
  } as unknown as AIProvider;
  const fallback = {
    id: 'claude',
    generateSolution: async () => ({
      data: { code: 'function solve(): boolean {\n  return true;\n}', language: 'typescript' }
    })
  } as unknown as AIProvider;
  const manager = createManager(primary, fallback);

  const response = await manager.generateSolution({}, {}, { task: 'steps', timeoutMs: 10 });

  assert.equal(primarySignalWasAborted, true);
  assert.equal(response.meta?.provider, 'claude');
  assert.equal(response.meta?.status, 'fallback');
});
