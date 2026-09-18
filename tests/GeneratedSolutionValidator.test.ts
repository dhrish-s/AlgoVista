import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGeneratedSolution } from '../src/services/GeneratedSolutionValidator';

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
