import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeProblemInput } from '../src/services/cache/cacheKey';

test('canonicalizes only problem-input whitespace', () => {
  assert.equal(
    canonicalizeProblemInput('  Two\n\tSum: nums + target?  '),
    'Two Sum: nums + target?'
  );
  assert.notEqual(canonicalizeProblemInput('Two Sum'), canonicalizeProblemInput('two sum'));
  assert.notEqual(canonicalizeProblemInput('Two Sum!'), canonicalizeProblemInput('Two Sum?'));
});
