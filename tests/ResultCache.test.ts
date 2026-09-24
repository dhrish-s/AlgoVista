import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryResultCacheStorage } from '../src/services/cache/MemoryResultCacheStorage';
import { ResultCache } from '../src/services/cache/ResultCache';
import { RESULT_CACHE_VERSIONS } from '../src/services/cache/cacheVersions';
import { ResultCacheEntry } from '../src/services/cache/cacheTypes';

const entry = (overrides: Partial<ResultCacheEntry> = {}): ResultCacheEntry => ({
  fullKey: 'trace:full',
  compatibleKey: 'trace:compatible',
  lineageKey: 'trace:lineage',
  layer: 'trace',
  versions: RESULT_CACHE_VERSIONS,
  producerProvider: 'claude',
  producerModel: 'claude-sonnet-5',
  payload: { steps: [] },
  byteSize: 20,
  createdAt: 10,
  lastAccessedAt: 10,
  ...overrides
});

test('sweeps cached entries when stored version metadata is outdated', async () => {
  const storage = new MemoryResultCacheStorage();
  await storage.setMetadata({
    id: 'versions',
    versions: { ...RESULT_CACHE_VERSIONS, prompt: RESULT_CACHE_VERSIONS.prompt - 1 }
  });
  await storage.put({
    fullKey: 'parse:old', compatibleKey: 'parse:old-compatible', lineageKey: 'parse:lineage',
    layer: 'parse', versions: { ...RESULT_CACHE_VERSIONS, prompt: RESULT_CACHE_VERSIONS.prompt - 1 },
    producerProvider: 'claude', producerModel: 'old-model', payload: { title: 'Old' },
    byteSize: 10, createdAt: 1, lastAccessedAt: 1
  });

  const cache = new ResultCache(storage);
  await cache.ready();

  assert.deepEqual(await cache.listEntries(), []);
  assert.deepEqual((await storage.getMetadata())?.versions, RESULT_CACHE_VERSIONS);
});

test('prefers an exact provider match over compatible entries', async () => {
  const storage = new MemoryResultCacheStorage();
  await storage.setMetadata({ id: 'versions', versions: RESULT_CACHE_VERSIONS });
  const exact = entry();
  await storage.put(exact);
  await storage.put(entry({ fullKey: 'trace:other', producerProvider: 'openai', createdAt: 20 }));
  const cache = new ResultCache(storage);

  const result = await cache.lookup(exact);

  assert.equal(result.hit, true);
  if (result.hit) {
    assert.equal(result.matchType, 'exact-provider');
    assert.equal(result.entry.fullKey, exact.fullKey);
  }
});

test('selects the newest compatible entry with a deterministic key tie-break', async () => {
  const storage = new MemoryResultCacheStorage();
  await storage.setMetadata({ id: 'versions', versions: RESULT_CACHE_VERSIONS });
  await storage.put(entry({ fullKey: 'trace:z', createdAt: 20 }));
  await storage.put(entry({ fullKey: 'trace:a', createdAt: 20, producerProvider: 'openai' }));
  const cache = new ResultCache(storage);

  const result = await cache.lookup({
    fullKey: 'trace:missing', compatibleKey: 'trace:compatible', lineageKey: 'trace:lineage'
  });

  assert.equal(result.hit, true);
  if (result.hit) {
    assert.equal(result.matchType, 'compatible-provider');
    assert.equal(result.entry.fullKey, 'trace:a');
  }
});

test('evicts obsolete lineage entries when versions no longer match', async () => {
  const storage = new MemoryResultCacheStorage();
  await storage.setMetadata({ id: 'versions', versions: RESULT_CACHE_VERSIONS });
  await storage.put(entry({ compatibleKey: 'trace:old-compatible' }));
  const cache = new ResultCache(storage);

  const result = await cache.lookup({
    fullKey: 'trace:new', compatibleKey: 'trace:new-compatible', lineageKey: 'trace:lineage'
  });

  assert.deepEqual(result, { hit: false, missReason: 'version-mismatch' });
  assert.deepEqual(await cache.listEntries(), []);
});
