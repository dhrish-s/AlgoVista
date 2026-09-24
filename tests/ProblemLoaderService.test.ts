import assert from 'node:assert/strict';
import test from 'node:test';
import { ProblemLoaderService } from '../src/services/ProblemLoaderService';
import { validateParsedProblem } from '../src/services/ParsedProblemValidator';
import { getAIManager } from '../src/services/ai/AIProviderManager';
import { AIProvider, AIProviderID } from '../src/services/ai/types';
import { MemoryResultCacheStorage } from '../src/services/cache/MemoryResultCacheStorage';
import { ResultCache } from '../src/services/cache/ResultCache';
import { setResultCacheForTests } from '../src/services/cache/resultCacheInstance';
import { StructuredProblem } from '../src/types';

test('preserves the exact source input on a parsed problem', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  const manager = getAIManager({
    defaultProvider: 'openai',
    fallbackProvider: 'openai',
    modelNames: { gemini: 'test-gemini', openai: 'test-openai', claude: 'test-claude' },
    taskRouting: { parse: 'openai' }
  });
  const provider = {
    id: 'openai',
    parseProblem: async () => ({
      data: {
        id: 'two-sum',
        source: 'pasted-text',
        title: 'Two Sum',
        statement: 'Find two array values that add to the requested target value.',
        examples: [{ input: 'nums = [2,7], target = 9', output: '[0,1]' }],
        constraints: ['Exactly one answer exists.'],
        approaches: [{
          id: 'map', name: 'Hash Map', explanation: 'Store complements.',
          complexity: { time: 'O(n)', space: 'O(n)' }, isOptimal: true
        }],
        inferredPatterns: [],
        parsingConfidence: 1
      }
    })
  } as unknown as AIProvider;
  (manager as unknown as { providers: Map<AIProviderID, AIProvider> }).providers.set('openai', provider);

  const sourceInput = '  Two Sum:\nnums + target?  ';
  const parsed = await ProblemLoaderService.parseProblemText(sourceInput);

  assert.equal(parsed.sourceInput, sourceInput);
});

test('validates parsed problems through a reusable confidence boundary', () => {
  const valid = {
    title: 'Two Sum',
    statement: 'Find two array values that add to the requested target value.',
    examples: [{ input: 'nums = [2,7], target = 9', output: '[0,1]' }],
    constraints: ['Exactly one answer exists.'],
    approaches: [{
      id: 'map', name: 'Hash Map', explanation: 'Store complements.',
      complexity: { time: 'O(n)', space: 'O(n)' }, isOptimal: true
    }],
    parsingConfidence: 0.9
  };

  assert.equal(validateParsedProblem(valid), 0.9);
  assert.throws(
    () => validateParsedProblem({ ...valid, examples: [] }),
    /missing required problem details/
  );
  assert.throws(
    () => validateParsedProblem({ ...valid, parsingConfidence: 0.2 }),
    /Low confidence parsing result/
  );
});

test('reuses a validated parsed problem from the persistent cache', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  const manager = getAIManager({
    defaultProvider: 'openai', fallbackProvider: 'openai',
    modelNames: { gemini: 'test-gemini', openai: 'test-openai', claude: 'test-claude' },
    taskRouting: { parse: 'openai' }
  });
  let calls = 0;
  const provider = {
    id: 'openai',
    parseProblem: async () => {
      calls += 1;
      return {
        data: {
          id: 'two-sum', source: 'pasted-text', title: 'Two Sum',
          statement: 'Find two array values that add to the requested target value.',
          examples: [{ input: 'nums = [2,7], target = 9', output: '[0,1]' }],
          constraints: ['Exactly one answer exists.'], approaches: [], inferredPatterns: [], parsingConfidence: 1
        }
      };
    }
  } as unknown as AIProvider;
  (manager as unknown as { providers: Map<AIProviderID, AIProvider> }).providers.set('openai', provider);
  const cache = new ResultCache(new MemoryResultCacheStorage());
  setResultCacheForTests(cache);

  try {
    await ProblemLoaderService.parseProblemText('Two Sum');
    await cache.settlePendingWrites();
    const cached = await ProblemLoaderService.parseProblemText('  Two   Sum  ');

    assert.equal(calls, 1);
    assert.equal(cached.sourceInput, '  Two   Sum  ');
    assert.equal((cached as StructuredProblem & { __providerMeta?: { status?: string } }).__providerMeta?.status, 'cached');
  } finally {
    setResultCacheForTests(null);
  }
});

test('deduplicates concurrent parsing while keeping stale consumers isolated', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  const manager = getAIManager({
    defaultProvider: 'openai', fallbackProvider: 'openai',
    modelNames: { gemini: 'test-gemini', openai: 'test-openai', claude: 'test-claude' },
    taskRouting: { parse: 'openai' }
  });
  let calls = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const provider = {
    id: 'openai',
    parseProblem: async () => {
      calls += 1;
      await gate;
      return {
        data: {
          id: 'two-sum', source: 'pasted-text', title: 'Two Sum',
          statement: 'Find two array values that add to the requested target value.',
          examples: [{ input: 'nums = [2,7], target = 9', output: '[0,1]' }],
          constraints: [], approaches: [], inferredPatterns: [], parsingConfidence: 1
        }
      };
    }
  } as unknown as AIProvider;
  (manager as unknown as { providers: Map<AIProviderID, AIProvider> }).providers.set('openai', provider);
  const cache = new ResultCache(new MemoryResultCacheStorage());
  setResultCacheForTests(cache);

  try {
    const first = ProblemLoaderService.parseProblemText('Two Sum');
    const second = ProblemLoaderService.parseProblemText('  Two   Sum  ');
    await Promise.resolve();
    release?.();
    const [firstResult, secondResult] = await Promise.allSettled([first, second]);

    assert.equal(calls, 1);
    assert.equal(firstResult.status, 'rejected');
    assert.equal((firstResult as PromiseRejectedResult).reason.name, 'AbortError');
    assert.equal(secondResult.status, 'fulfilled');
  } finally {
    setResultCacheForTests(null);
  }
});
