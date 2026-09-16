import assert from 'node:assert/strict';
import test from 'node:test';
import { DynamicStepGenerator } from '../src/services/DynamicStepGenerator';
import { generateIdealVisualization } from '../src/services/IdealLogicService';
import { ApproachOption, ExecutionStep, StructuredProblem } from '../src/types';
import { useStore } from '../src/store/useStore';
import { getAIManager } from '../src/services/ai/AIProviderManager';
import { AIProvider } from '../src/services/ai/types';

const problem = {
  id: 'valid-parentheses',
  source: 'mixed',
  title: 'Valid Parentheses',
  statement: 'Validate matching brackets.',
  examples: [{ input: '()[]{}', output: 'true' }],
  constraints: [],
  inferredPatterns: [],
  parsingConfidence: 1
} as StructuredProblem;

const stackApproach: ApproachOption = {
  id: 'stack',
  name: 'Stack-based Matching',
  explanation: 'Use a stack.',
  complexity: { time: 'O(n)', space: 'O(n)' },
  isOptimal: true
};

const bruteApproach: ApproachOption = {
  ...stackApproach,
  id: 'brute-force',
  name: 'Brute Force',
  explanation: 'Repeatedly remove matching pairs.',
  isOptimal: false
};

const steps: ExecutionStep[] = [{
  id: 'return',
  line: 2,
  explanation: 'Return the result.',
  operationType: 'return',
  variables: {},
  visualState: { stack: [] }
}];

test('reuses cached Ideal Logic code and generates new code for another approach', async () => {
  const originalGenerateSolution = DynamicStepGenerator.generateSolution;
  const originalGenerate = DynamicStepGenerator.generate;
  const generatedApproaches: string[] = [];
  const tracedCode: string[] = [];

  DynamicStepGenerator.generateSolution = async (_problem, approach) => {
    generatedApproaches.push(approach.id);
    return { code: `function ${approach.id.replace('-', '_')}() {\n  return true;\n}` };
  };
  DynamicStepGenerator.generate = async (_problem, _approach, code) => {
    tracedCode.push(code);
    return steps;
  };

  try {
    const first = await generateIdealVisualization(problem, stackApproach, undefined, problem.examples[0]);
    const rerun = await generateIdealVisualization(problem, stackApproach, first.code, problem.examples[0]);
    const switched = await generateIdealVisualization(problem, bruteApproach, undefined, problem.examples[0]);

    assert.deepEqual(generatedApproaches, ['stack', 'brute-force']);
    assert.equal(rerun.code, first.code);
    assert.equal(rerun.reusedCode, true);
    assert.equal(switched.reusedCode, false);
    assert.deepEqual(tracedCode, [first.code, first.code, switched.code]);
  } finally {
    DynamicStepGenerator.generateSolution = originalGenerateSolution;
    DynamicStepGenerator.generate = originalGenerate;
  }
});

test('stores Ideal Logic code, approach cache, steps, and index atomically', () => {
  useStore.setState({ idealSolutionCache: {}, userCode: '', currentSteps: [], currentStepIndex: -1 });
  useStore.getState().setIdealVisualization('stack', 'function solve() {}', steps);

  const state = useStore.getState();
  assert.equal(state.idealSolutionCache.stack, 'function solve() {}');
  assert.equal(state.userCode, 'function solve() {}');
  assert.equal(state.currentSteps, steps);
  assert.equal(state.currentStepIndex, 0);
});

test('Sync My Code traces existing code without generating an Ideal Logic solution', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  let solutionCalls = 0;
  let tracedCode = '';
  const provider = {
    id: 'openai',
    generateSolution: async () => {
      solutionCalls += 1;
      throw new Error('Ideal solution generation must not run for Sync My Code.');
    },
    generateSteps: async (_problem: unknown, code: string) => {
      tracedCode = code;
      return { data: steps };
    }
  } as unknown as AIProvider;
  const manager = getAIManager({
    defaultProvider: 'openai',
    fallbackProvider: 'openai',
    modelNames: { gemini: 'test', openai: 'test', claude: 'test' },
    taskRouting: { steps: 'openai' }
  });
  const providers = (manager as unknown as { providers: Map<string, AIProvider> }).providers;
  providers.clear();
  providers.set('openai', provider);
  const existingCode = 'function isValid(s: string): boolean {\n  return s.length > 0;\n}';

  await DynamicStepGenerator.generateFromUserCode(problem, existingCode, problem.examples[0]);

  assert.equal(solutionCalls, 0);
  assert.equal(tracedCode, existingCode);
});
