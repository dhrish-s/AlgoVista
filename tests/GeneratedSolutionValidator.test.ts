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
