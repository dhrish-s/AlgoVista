import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeProblemInput, createResultCacheIdentity, stableSerializeKeyValue } from '../src/services/cache/cacheKey';
import { ResultCacheKeyDescriptor } from '../src/services/cache/cacheTypes';
import { measureSerializedBytes } from '../src/services/cache/cacheSizing';

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

const descriptor: ResultCacheKeyDescriptor = {
  layer: 'trace',
  canonicalProblemInput: 'Valid Parentheses',
  approachId: 'stack',
  language: 'typescript',
  generatedSourceHash: 'source-a',
  testCaseHash: 'case-a',
  traceMode: 'ideal',
  versions: { contract: 1, prompt: 1, validator: 1, schema: 1 },
  provider: 'claude',
  model: 'claude-sonnet-5'
};

test('derives exact, compatible, and lineage cache identities', async () => {
  const original = await createResultCacheIdentity(descriptor);
  const anotherProvider = await createResultCacheIdentity({
    ...descriptor, provider: 'openai', model: 'gpt-4o-mini'
  });
  const anotherVersion = await createResultCacheIdentity({
    ...descriptor, versions: { ...descriptor.versions, prompt: 2 }
  });

  assert.notEqual(original.fullKey, anotherProvider.fullKey);
  assert.equal(original.compatibleKey, anotherProvider.compatibleKey);
  assert.equal(original.lineageKey, anotherProvider.lineageKey);
  assert.notEqual(original.compatibleKey, anotherVersion.compatibleKey);
  assert.equal(original.lineageKey, anotherVersion.lineageKey);
});

test('changes trace identity for source, test case, or trace mode changes', async () => {
  const original = await createResultCacheIdentity(descriptor);
  const sourceChanged = await createResultCacheIdentity({ ...descriptor, generatedSourceHash: 'source-b' });
  const caseChanged = await createResultCacheIdentity({ ...descriptor, testCaseHash: 'case-b' });
  const modeChanged = await createResultCacheIdentity({ ...descriptor, traceMode: 'user-code' });

  assert.notEqual(original.lineageKey, sourceChanged.lineageKey);
  assert.notEqual(original.lineageKey, caseChanged.lineageKey);
  assert.notEqual(original.lineageKey, modeChanged.lineageKey);
});

test('measures serialized payload size in UTF-8 bytes', () => {
  const payload = { explanation: 'café' };
  assert.equal(measureSerializedBytes(payload), new TextEncoder().encode(JSON.stringify(payload)).byteLength);
  assert.ok(measureSerializedBytes(payload) > JSON.stringify(payload).length);
});
