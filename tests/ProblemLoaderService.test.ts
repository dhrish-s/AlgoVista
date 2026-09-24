import assert from 'node:assert/strict';
import test from 'node:test';
import { ProblemLoaderService } from '../src/services/ProblemLoaderService';
import { validateParsedProblem } from '../src/services/ParsedProblemValidator';
import { getAIManager } from '../src/services/ai/AIProviderManager';
import { AIProvider, AIProviderID } from '../src/services/ai/types';

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
