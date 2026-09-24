import assert from 'node:assert/strict';
import test from 'node:test';
import { clearAITelemetry, getAICacheTelemetryEntries } from '../src/services/ai/AITelemetry';
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

test('keeps cache writes off the caller critical path and exposes settlement', async () => {
  let releaseWrite: (() => void) | undefined;
  class DelayedStorage extends MemoryResultCacheStorage {
    override async put(value: ResultCacheEntry): Promise<void> {
      await new Promise<void>((resolve) => { releaseWrite = resolve; });
      await super.put(value);
    }
  }
  const storage = new DelayedStorage();
  const cache = new ResultCache(storage);
  await cache.ready();

  cache.store(entry());
  assert.deepEqual(await cache.listEntries(), []);
  releaseWrite?.();
  await cache.settlePendingWrites();

  assert.equal((await cache.listEntries()).length, 1);
});

test('throttles LRU timestamp writes to one per access interval', async () => {
  class CountingStorage extends MemoryResultCacheStorage {
    writes = 0;
    override async put(value: ResultCacheEntry): Promise<void> {
      this.writes += 1;
      await super.put(value);
    }
  }
  const storage = new CountingStorage();
  await storage.setMetadata({ id: 'versions', versions: RESULT_CACHE_VERSIONS });
  await storage.put(entry({ lastAccessedAt: 1 }));
  storage.writes = 0;
  let now = 100;
  const cache = new ResultCache(storage, undefined, { now: () => now, touchIntervalMs: 1_000 });

  await cache.lookup(entry());
  await cache.settlePendingWrites();
  assert.equal(storage.writes, 0);

  now = 2_000;
  await cache.lookup(entry());
  await cache.settlePendingWrites();
  assert.equal(storage.writes, 1);

  now = 2_500;
  await cache.lookup(entry());
  await cache.settlePendingWrites();
  assert.equal(storage.writes, 1);
});

test('fills quota, evicts the oldest entry, and retries once', async () => {
  const storage = new MemoryResultCacheStorage(30);
  const cache = new ResultCache(storage);
  await cache.ready();
  cache.store(entry({ fullKey: 'trace:old', byteSize: 20, lastAccessedAt: 1 }));
  await cache.settlePendingWrites();

  cache.store(entry({ fullKey: 'trace:new', byteSize: 20, lastAccessedAt: 2 }));
  await cache.settlePendingWrites();

  assert.deepEqual((await cache.listEntries()).map((value) => value.fullKey), ['trace:new']);
});

test('degrades to memory storage when quota retry still fails', async () => {
  const primary = new MemoryResultCacheStorage(5);
  const fallback = new MemoryResultCacheStorage();
  const cache = new ResultCache(primary, fallback);
  await cache.ready();

  cache.store(entry({ byteSize: 20 }));
  await cache.settlePendingWrites();

  assert.equal((await cache.listEntries()).length, 1);
  assert.equal((await fallback.list()).length, 1);
});

test('enforces a configured byte cap with LRU eviction', async () => {
  const storage = new MemoryResultCacheStorage();
  const cache = new ResultCache(storage, undefined, { maximumBytes: 30 });
  await cache.ready();
  cache.store(entry({ fullKey: 'trace:old', byteSize: 20, lastAccessedAt: 1 }));
  await cache.settlePendingWrites();

  cache.store(entry({ fullKey: 'trace:new', byteSize: 20, lastAccessedAt: 2 }));
  await cache.settlePendingWrites();

  assert.deepEqual((await cache.listEntries()).map((value) => value.fullKey), ['trace:new']);
});

test('records cache hit provenance and explicit miss reasons', async () => {
  const previousFlag = process.env.VITE_AI_TELEMETRY;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.VITE_AI_TELEMETRY = 'true';
  process.env.NODE_ENV = 'development';
  clearAITelemetry();

  try {
    const storage = new MemoryResultCacheStorage();
    await storage.setMetadata({ id: 'versions', versions: RESULT_CACHE_VERSIONS });
    await storage.put(entry());
    const cache = new ResultCache(storage);

    await cache.lookup(entry());
    await cache.lookup({
      fullKey: 'parse:missing', compatibleKey: 'parse:missing-compatible', lineageKey: 'parse:missing-lineage'
    });
    await cache.lookup({
      fullKey: 'solution:bypass', compatibleKey: 'solution:bypass-compatible', lineageKey: 'solution:bypass-lineage'
    }, true);

    assert.deepEqual(getAICacheTelemetryEntries().map(({ timestamp: _timestamp, ...record }) => record), [
      {
        layer: 'trace', result: 'hit', matchType: 'exact-provider', bytesServed: 20,
        producerProvider: 'claude', producerModel: 'claude-sonnet-5'
      },
      { layer: 'parse', result: 'miss', missReason: 'absent', bytesServed: 0 },
      { layer: 'solution', result: 'miss', missReason: 'explicit-bypass', bytesServed: 0 }
    ]);
  } finally {
    clearAITelemetry();
    if (previousFlag === undefined) delete process.env.VITE_AI_TELEMETRY;
    else process.env.VITE_AI_TELEMETRY = previousFlag;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
