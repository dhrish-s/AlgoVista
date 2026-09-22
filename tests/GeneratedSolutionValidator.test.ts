import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGeneratedSolution } from '../src/services/GeneratedSolutionValidator';
import { ENABLED_SOLUTION_LANGUAGES, SOLUTION_LANGUAGE_METADATA } from '../src/services/ai/solutionLanguages';

test('enables Python with matching Monaco mode and filename extension', () => {
  assert.equal(ENABLED_SOLUTION_LANGUAGES.includes('python'), true);
  assert.equal(SOLUTION_LANGUAGE_METADATA.python.monacoLanguage, 'python');
  assert.equal(SOLUTION_LANGUAGE_METADATA.python.fileExtension, 'py');
});

test('enables C++ with matching Monaco mode and filename extension', () => {
  assert.equal(ENABLED_SOLUTION_LANGUAGES.includes('cpp'), true);
  assert.equal(SOLUTION_LANGUAGE_METADATA.cpp.monacoLanguage, 'cpp');
  assert.equal(SOLUTION_LANGUAGE_METADATA.cpp.fileExtension, 'cpp');
});

test('enables Java with matching Monaco mode and filename extension', () => {
  assert.equal(ENABLED_SOLUTION_LANGUAGES.includes('java'), true);
  assert.equal(SOLUTION_LANGUAGE_METADATA.java.monacoLanguage, 'java');
  assert.equal(SOLUTION_LANGUAGE_METADATA.java.fileExtension, 'java');
});

test('enables C with matching Monaco mode and filename extension', () => {
  assert.equal(ENABLED_SOLUTION_LANGUAGES.includes('c'), true);
  assert.equal(SOLUTION_LANGUAGE_METADATA.c.monacoLanguage, 'c');
  assert.equal(SOLUTION_LANGUAGE_METADATA.c.fileExtension, 'c');
});

test('accepts a complete TypeScript solution', () => {
  const result = validateGeneratedSolution({
    language: 'typescript',
    code: 'function solve(value: number): number {\n  return value * 2;\n}'
  });

  assert.equal(result.valid, true);
  if (result.valid) assert.match(result.solution.code, /return value/);
});

test('rejects empty, fenced, placeholder, and non-TypeScript solutions', () => {
  const invalidSolutions = [
    { language: 'typescript', code: '' },
    { language: 'typescript', code: '```ts\nreturn 1;\n```' },
    { language: 'typescript', code: '// TODO: implement' },
    { language: 'javascript', code: 'return 1;' }
  ];

  for (const solution of invalidSolutions) {
    assert.equal(validateGeneratedSolution(solution).valid, false);
  }
});

test('accepts executable code in every registered solution language', () => {
  const solutions = [
    ['typescript', 'function solve(): boolean {\n  return true;\n}'],
    ['python', 'def solve():\n    return True'],
    ['cpp', 'bool solve() {\n  return true;\n}'],
    ['java', 'class Solution {\n  public boolean solve() { return true; }\n}'],
    ['c', 'int solve(void) {\n  return 1;\n}'],
    ['ruby', 'def solve\n  true\nend']
  ] as const;

  for (const [language, code] of solutions) {
    const result = validateGeneratedSolution({ language, code }, language);
    assert.equal(result.valid, true, `${language} should pass shared validation`);
  }
});

test('rejects a valid solution returned in a different language than requested', () => {
  const result = validateGeneratedSolution({
    language: 'typescript',
    code: 'function solve(): boolean { return true; }'
  }, 'python');

  assert.equal(result.valid, false);
  if (!result.valid) assert.match(result.error, /must be Python/);
});

test('accepts idiomatic Python and rejects TypeScript disguised as Python', () => {
  const python = validateGeneratedSolution({
    language: 'python',
    code: 'class Solution:\n    def isValid(self, s: str) -> bool:\n        return bool(s)'
  }, 'python');
  const disguisedTypeScript = validateGeneratedSolution({
    language: 'python',
    code: 'function isValid(s: string): boolean {\n  return true;\n}'
  }, 'python');

  assert.equal(python.valid, true);
  assert.equal(disguisedTypeScript.valid, false);
  if (!disguisedTypeScript.valid) assert.match(disguisedTypeScript.error, /executable Python/);
});

test('accepts idiomatic C++ and rejects TypeScript disguised as C++', () => {
  const cpp = validateGeneratedSolution({
    language: 'cpp',
    code: 'class Solution {\npublic:\n  bool isValid(const std::string& s) {\n    for (char c : s) {\n      if (c == \'(\') return true;\n    }\n    return false;\n  }\n};'
  }, 'cpp');
  const disguisedTypeScript = validateGeneratedSolution({
    language: 'cpp',
    code: 'class Solution {\n  isValid(s: string): boolean {\n    return true;\n  }\n}'
  }, 'cpp');

  assert.equal(cpp.valid, true);
  assert.equal(disguisedTypeScript.valid, false);
  if (!disguisedTypeScript.valid) assert.match(disguisedTypeScript.error, /incompatible with C\+\+/);
});

test('accepts idiomatic Java syntax and rejects TypeScript disguised as Java', () => {
  const java = validateGeneratedSolution({
    language: 'java',
    code: 'class Solution implements Validator {\n  private final Map<String, Integer> counts = new HashMap<>();\n\n  @Override\n  public boolean isValid(List<Integer> values) {\n    for (Integer value : values) {\n      counts.put(value.toString(), value);\n    }\n    return !counts.isEmpty();\n  }\n}'
  }, 'java');
  const disguisedTypeScript = validateGeneratedSolution({
    language: 'java',
    code: 'class Solution {\n  isValid(s: string): boolean {\n    return true;\n  }\n}'
  }, 'java');

  assert.equal(java.valid, true);
  assert.equal(disguisedTypeScript.valid, false);
  if (!disguisedTypeScript.valid) assert.match(disguisedTypeScript.error, /incompatible with Java/);
});
