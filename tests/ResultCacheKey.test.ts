import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeProblemInput, stableSerializeKeyValue } from '../src/services/cache/cacheKey';

test('canonicalizes only problem-input whitespace', () => {
  assert.equal(
    canonicalizeProblemInput('  Two\n\tSum: nums + target?  '),
    'Two Sum: nums + target?'
  );
  assert.notEqual(canonicalizeProblemInput('Two Sum'), canonicalizeProblemInput('two sum'));
  assert.notEqual(canonicalizeProblemInput('Two Sum!'), canonicalizeProblemInput('Two Sum?'));
});

test('serializes cache key objects independently of insertion order', () => {
  const first = { provider: 'claude', versions: { prompt: 1, contract: 1 }, tags: ['graph', 'cycle'] };
  const second = { tags: ['graph', 'cycle'], versions: { contract: 1, prompt: 1 }, provider: 'claude' };

  assert.equal(stableSerializeKeyValue(first), stableSerializeKeyValue(second));
});
