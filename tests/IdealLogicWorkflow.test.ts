import assert from 'node:assert/strict';
import test from 'node:test';
import { DynamicStepGenerator } from '../src/services/DynamicStepGenerator';
import { generateIdealVisualization } from '../src/services/IdealLogicService';
import { ApproachOption, ExecutionStep, StructuredProblem } from '../src/types';
import { useStore } from '../src/store/useStore';
import { getAIManager } from '../src/services/ai/AIProviderManager';
import { AIProvider } from '../src/services/ai/types';
import { SOLUTION_LANGUAGES } from '../src/services/ai/solutionLanguages';

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
  const firstRunPhases: string[] = [];
  const rerunPhases: string[] = [];

  DynamicStepGenerator.generateSolution = async (_problem, approach) => {
    generatedApproaches.push(approach.id);
    return { code: `function ${approach.id.replace('-', '_')}() {\n  return true;\n}` };
  };
  DynamicStepGenerator.generate = async (_problem, _approach, code) => {
    tracedCode.push(code);
    return steps;
  };

  try {
    const first = await generateIdealVisualization(
      problem,
      stackApproach,
      undefined,
      problem.examples[0],
      'typescript',
      undefined,
      (phase) => firstRunPhases.push(phase)
    );
    const rerun = await generateIdealVisualization(
      problem,
      stackApproach,
      first.code,
      problem.examples[0],
      'typescript',
      undefined,
      (phase) => rerunPhases.push(phase)
    );
    const switched = await generateIdealVisualization(
      problem,
      bruteApproach,
      undefined,
      problem.examples[0],
      'typescript'
    );

    assert.deepEqual(generatedApproaches, ['stack', 'brute-force']);
    assert.equal(rerun.code, first.code);
    assert.equal(rerun.reusedCode, true);
    assert.equal(switched.reusedCode, false);
    assert.deepEqual(tracedCode, [first.code, first.code, switched.code]);
    assert.deepEqual(firstRunPhases, ['solution', 'trace']);
    assert.deepEqual(rerunPhases, ['trace']);
  } finally {
    DynamicStepGenerator.generateSolution = originalGenerateSolution;
    DynamicStepGenerator.generate = originalGenerate;
  }
});

test('stores Ideal Logic code, approach cache, steps, and index atomically', () => {
  useStore.setState({ idealSolutionCache: {}, userCode: '', currentSteps: [], currentStepIndex: -1 });
  useStore.getState().setIdealVisualization('stack', 'function solve() {}', steps);

  const state = useStore.getState();
  assert.equal(state.idealSolutionCache.stack?.typescript, 'function solve() {}');
  assert.equal(state.userCode, 'function solve() {}');
  assert.equal(state.currentSteps, steps);
  assert.equal(state.currentStepIndex, 0);
});

test('keeps generated solutions isolated by approach and language', () => {
  useStore.setState({ idealSolutionCache: {} });
  useStore.getState().setIdealVisualization('stack', 'function solve() {}', steps, 'typescript');
  useStore.getState().setIdealVisualization('stack', 'def solve():\n    return True', steps, 'python');

  const cache = useStore.getState().idealSolutionCache;
  assert.equal(cache.stack?.typescript, 'function solve() {}');
  assert.equal(cache.stack?.python, 'def solve():\n    return True');
});

test('reuses Python code and restores cached TypeScript for the same approach', async () => {
  const originalGenerateSolution = DynamicStepGenerator.generateSolution;
  const originalGenerate = DynamicStepGenerator.generate;
  const generatedLanguages: string[] = [];
  DynamicStepGenerator.generateSolution = async (_problem, _approach, language) => {
    generatedLanguages.push(language);
    return {
      code: language === 'python'
        ? 'def is_valid(s: str) -> bool:\n    return bool(s)'
        : 'function isValid(s: string): boolean {\n  return Boolean(s);\n}'
    };
  };
  DynamicStepGenerator.generate = async () => steps;

  try {
    useStore.setState({ idealSolutionCache: {} });
    const typescript = await generateIdealVisualization(
      problem, stackApproach, undefined, problem.examples[0], 'typescript'
    );
    useStore.getState().setIdealVisualization('stack', typescript.code, typescript.steps, 'typescript');
    const python = await generateIdealVisualization(
      problem, stackApproach, undefined, problem.examples[0], 'python'
    );
    useStore.getState().setIdealVisualization('stack', python.code, python.steps, 'python');

    const cache = useStore.getState().idealSolutionCache.stack;
    const pythonRerun = await generateIdealVisualization(
      problem, stackApproach, cache?.python, problem.examples[0], 'python'
    );
    const typescriptReturn = await generateIdealVisualization(
      problem, stackApproach, cache?.typescript, problem.examples[0], 'typescript'
    );

    assert.deepEqual(generatedLanguages, ['typescript', 'python']);
    assert.equal(pythonRerun.reusedCode, true);
    assert.equal(pythonRerun.code, python.code);
    assert.equal(typescriptReturn.reusedCode, true);
    assert.equal(typescriptReturn.code, typescript.code);
  } finally {
    DynamicStepGenerator.generateSolution = originalGenerateSolution;
    DynamicStepGenerator.generate = originalGenerate;
  }
});

test('forwards every registered source language through Ideal Logic traces', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  const tracedLanguages: Array<string | undefined> = [];
  const provider = {
    id: 'openai',
    generateSteps: async (
      _problem: unknown,
      _code: string,
      _testCase: unknown,
      options?: { solutionLanguage?: string }
    ) => {
      tracedLanguages.push(options?.solutionLanguage);
      return { data: steps };
    }
  } as unknown as AIProvider;
  const manager = getAIManager({
    defaultProvider: 'openai', fallbackProvider: 'openai',
    modelNames: { gemini: 'test', openai: 'test', claude: 'test' }, taskRouting: { steps: 'openai' }
  });
  const providers = (manager as unknown as { providers: Map<string, AIProvider> }).providers;
  providers.clear();
  providers.set('openai', provider);
  for (const language of SOLUTION_LANGUAGES) {
    const result = await generateIdealVisualization(
      problem, stackApproach, 'first line\nsecond line', problem.examples[0], language
    );
    assert.equal(result.reusedCode, true);
  }

  assert.deepEqual(tracedLanguages, SOLUTION_LANGUAGES);
});

test('keeps TypeScript, Python, C++, Java, and C cached separately for one approach', () => {
  const typescript = 'function solve(): boolean { return true; }';
  const python = 'def solve():\n    return True';
  const cpp = 'class Solution { public: bool solve() { return true; } };';
  const java = 'class Solution { public boolean solve() { return true; } }';
  const c = 'bool solve(void) { return true; }';
  useStore.setState({ idealSolutionCache: {}, userCodeDrafts: {}, userCode: '' });
  useStore.getState().setIdealVisualization('stack', typescript, steps, 'typescript');
  useStore.getState().setIdealVisualization('stack', python, steps, 'python');
  useStore.getState().setIdealVisualization('stack', cpp, steps, 'cpp');
  useStore.getState().setIdealVisualization('stack', java, steps, 'java');
  useStore.getState().setIdealVisualization('stack', c, steps, 'c');

  const cache = useStore.getState().idealSolutionCache.stack;
  assert.equal(cache?.typescript, typescript);
  assert.equal(cache?.python, python);
  assert.equal(cache?.cpp, cpp);
  assert.equal(cache?.java, java);
  assert.equal(cache?.c, c);
  useStore.getState().setSolutionLanguage('typescript');
  assert.equal(useStore.getState().userCode, typescript);
  useStore.getState().setSolutionLanguage('python');
  assert.equal(useStore.getState().userCode, python);
  useStore.getState().setSolutionLanguage('cpp');
  assert.equal(useStore.getState().userCode, cpp);
  useStore.getState().setSolutionLanguage('java');
  assert.equal(useStore.getState().userCode, java);
  useStore.getState().setSolutionLanguage('c');
  assert.equal(useStore.getState().userCode, c);
});

test('preserves editor drafts when switching languages without generating code', () => {
  useStore.setState({
    solutionLanguage: 'typescript',
    userCode: 'function original() {}',
    userCodeDrafts: { typescript: 'function original() {}' },
    currentSteps: steps,
    currentStepIndex: 0,
    isPlaying: true
  });

  useStore.getState().setUserCode('function edited() {}');
  useStore.getState().setSolutionLanguage('python');
  assert.equal(useStore.getState().userCode, '');
  assert.equal(useStore.getState().currentSteps.length, 0);
  assert.equal(useStore.getState().isPlaying, false);

  useStore.getState().setUserCode('def solve():\n    return True');
  useStore.getState().setSolutionLanguage('typescript');
  assert.equal(useStore.getState().userCode, 'function edited() {}');
  assert.equal(useStore.getState().userCodeDrafts.python, 'def solve():\n    return True');
});

test('Sync My Code traces existing code without generating an Ideal Logic solution', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  let solutionCalls = 0;
  let tracedCode = '';
  let tracedLanguage: string | undefined;
  let tracedLineCount: number | undefined;
  const provider = {
    id: 'openai',
    generateSolution: async () => {
      solutionCalls += 1;
      throw new Error('Ideal solution generation must not run for Sync My Code.');
    },
    generateSteps: async (
      _problem: unknown,
      code: string,
      _testCase: unknown,
      options?: { solutionLanguage?: string; sourceLineCount?: number }
    ) => {
      tracedCode = code;
      tracedLanguage = options?.solutionLanguage;
      tracedLineCount = options?.sourceLineCount;
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

  await DynamicStepGenerator.generateFromUserCode(problem, existingCode, problem.examples[0], 'typescript');

  assert.equal(solutionCalls, 0);
  assert.equal(tracedCode, existingCode);
  assert.equal(tracedLanguage, 'typescript');
  assert.equal(tracedLineCount, 3);
});

test('Sync My Code preserves manually edited Python without solution generation', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  let solutionCalls = 0;
  let tracedCode = '';
  let tracedLanguage: string | undefined;
  const provider = {
    id: 'openai',
    generateSolution: async () => {
      solutionCalls += 1;
      throw new Error('Python Sync My Code must not generate a replacement solution.');
    },
    generateSteps: async (
      _problem: unknown,
      code: string,
      _testCase: unknown,
      options?: { solutionLanguage?: string }
    ) => {
      tracedCode = code;
      tracedLanguage = options?.solutionLanguage;
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
  const editedPython = 'def is_valid(s: str) -> bool:\n    stack = []\n    return not stack';

  await DynamicStepGenerator.generateFromUserCode(
    problem,
    editedPython,
    problem.examples[0],
    'python'
  );

  assert.equal(solutionCalls, 0);
  assert.equal(tracedCode, editedPython);
  assert.equal(tracedLanguage, 'python');
});

test('Sync My Code preserves manually edited C++ without solution generation', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  let solutionCalls = 0;
  let tracedCode = '';
  let tracedLanguage: string | undefined;
  const provider = {
    id: 'openai',
    generateSolution: async () => {
      solutionCalls += 1;
      throw new Error('C++ Sync must not generate replacement code.');
    },
    generateSteps: async (_problem: unknown, code: string, _case: unknown, options?: { solutionLanguage?: string }) => {
      tracedCode = code;
      tracedLanguage = options?.solutionLanguage;
      return { data: steps };
    }
  } as unknown as AIProvider;
  const manager = getAIManager({
    defaultProvider: 'openai', fallbackProvider: 'openai',
    modelNames: { gemini: 'test', openai: 'test', claude: 'test' }, taskRouting: { steps: 'openai' }
  });
  const providers = (manager as unknown as { providers: Map<string, AIProvider> }).providers;
  providers.clear();
  providers.set('openai', provider);
  const editedCpp = 'class Solution {\npublic:\n  bool isValid(string s) { return !s.empty(); }\n};';
  await DynamicStepGenerator.generateFromUserCode(problem, editedCpp, problem.examples[0], 'cpp');
  assert.equal(solutionCalls, 0);
  assert.equal(tracedCode, editedCpp);
  assert.equal(tracedLanguage, 'cpp');
});

test('Sync My Code preserves manually edited Java without solution generation', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  let solutionCalls = 0;
  let tracedCode = '';
  let tracedLanguage: string | undefined;
  const provider = {
    id: 'openai',
    generateSolution: async () => {
      solutionCalls += 1;
      throw new Error('Java Sync must not generate replacement code.');
    },
    generateSteps: async (_problem: unknown, code: string, _case: unknown, options?: { solutionLanguage?: string }) => {
      tracedCode = code;
      tracedLanguage = options?.solutionLanguage;
      return { data: steps };
    }
  } as unknown as AIProvider;
  const manager = getAIManager({
    defaultProvider: 'openai', fallbackProvider: 'openai',
    modelNames: { gemini: 'test', openai: 'test', claude: 'test' }, taskRouting: { steps: 'openai' }
  });
  const providers = (manager as unknown as { providers: Map<string, AIProvider> }).providers;
  providers.clear();
  providers.set('openai', provider);
  const editedJava = 'class Solution {\n  public boolean isValid(String s) {\n    return !s.isEmpty();\n  }\n}';
  await DynamicStepGenerator.generateFromUserCode(problem, editedJava, problem.examples[0], 'java');
  assert.equal(solutionCalls, 0);
  assert.equal(tracedCode, editedJava);
  assert.equal(tracedLanguage, 'java');
});

test('Sync My Code preserves manually edited C without solution generation', async () => {
  process.env.VITE_OPENAI_API_KEY = 'test-openai-key';
  let solutionCalls = 0;
  let tracedCode = '';
  let tracedLanguage: string | undefined;
  const provider = {
    id: 'openai',
    generateSolution: async () => {
      solutionCalls += 1;
      throw new Error('C Sync must not generate replacement code.');
    },
    generateSteps: async (_problem: unknown, code: string, _case: unknown, options?: { solutionLanguage?: string }) => {
      tracedCode = code;
      tracedLanguage = options?.solutionLanguage;
      return { data: steps };
    }
  } as unknown as AIProvider;
  const manager = getAIManager({
    defaultProvider: 'openai', fallbackProvider: 'openai',
    modelNames: { gemini: 'test', openai: 'test', claude: 'test' }, taskRouting: { steps: 'openai' }
  });
  const providers = (manager as unknown as { providers: Map<string, AIProvider> }).providers;
  providers.clear();
  providers.set('openai', provider);
  const editedC = 'bool isValid(char *s) {\n  return s[0] != 0;\n}';
  await DynamicStepGenerator.generateFromUserCode(problem, editedC, problem.examples[0], 'c');
  assert.equal(solutionCalls, 0);
  assert.equal(tracedCode, editedC);
  assert.equal(tracedLanguage, 'c');
});
