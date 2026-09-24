import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryResultCacheStorage } from '../src/services/cache/MemoryResultCacheStorage';
import { ResultCache } from '../src/services/cache/ResultCache';
import { RESULT_CACHE_VERSIONS } from '../src/services/cache/cacheVersions';

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
