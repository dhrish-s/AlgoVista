import { IndexedDBResultCacheStorage } from './IndexedDBResultCacheStorage';
import { MemoryResultCacheStorage } from './MemoryResultCacheStorage';
import { RESULT_CACHE_VERSIONS } from './cacheVersions';
import { ResultCacheEntry, ResultCacheIdentity, ResultCacheLookup, ResultCacheStorage, ResultCacheVersionSet } from './cacheTypes';

const versionsMatch = (left: ResultCacheVersionSet, right: ResultCacheVersionSet): boolean => (
  left.contract === right.contract
  && left.prompt === right.prompt
  && left.validator === right.validator
  && left.schema === right.schema
);

const isQuotaError = (error: unknown): boolean => (
  error instanceof DOMException && error.name === 'QuotaExceededError'
);

export const CACHE_ACCESS_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

interface ResultCacheOptions {
  now?: () => number;
  touchIntervalMs?: number;
}

export class ResultCache {
  private activeStorage: ResultCacheStorage;
  private readonly initialization: Promise<void>;
  private readonly pendingWrites = new Set<Promise<void>>();

  constructor(
    primaryStorage: ResultCacheStorage = new IndexedDBResultCacheStorage(),
    private readonly fallbackStorage: ResultCacheStorage = new MemoryResultCacheStorage(),
    private readonly options: ResultCacheOptions = {}
  ) {
    this.activeStorage = primaryStorage;
    this.initialization = this.initialize(primaryStorage);
  }

  private async initialize(primaryStorage: ResultCacheStorage): Promise<void> {
    try {
      await this.initializeStorage(primaryStorage);
    } catch {
      this.activeStorage = this.fallbackStorage;
      await this.initializeStorage(this.fallbackStorage);
    }
  }

  private async initializeStorage(storage: ResultCacheStorage): Promise<void> {
    const metadata = await storage.getMetadata();
    if (!metadata || !versionsMatch(metadata.versions, RESULT_CACHE_VERSIONS)) {
      await storage.clear();
    }
    await storage.setMetadata({ id: 'versions', versions: RESULT_CACHE_VERSIONS });
  }

  async ready(): Promise<void> {
    await this.initialization;
  }

  async listEntries(): Promise<ResultCacheEntry[]> {
    await this.ready();
    return this.activeStorage.list();
  }

  async lookup<T>(identity: ResultCacheIdentity, bypass = false): Promise<ResultCacheLookup<T>> {
    await this.ready();
    if (bypass) return { hit: false, missReason: 'explicit-bypass' };

    const exact = await this.activeStorage.get(identity.fullKey);
    if (exact) {
      const touched = this.touchEntry(exact);
      return { hit: true, entry: touched as ResultCacheEntry<T>, matchType: 'exact-provider' };
    }

    const compatible = await this.activeStorage.findCompatible(identity.compatibleKey);
    compatible.sort((left, right) => (
      right.createdAt - left.createdAt || left.fullKey.localeCompare(right.fullKey)
    ));
    if (compatible[0]) {
      const touched = this.touchEntry(compatible[0]);
      return {
        hit: true,
        entry: touched as ResultCacheEntry<T>,
        matchType: 'compatible-provider'
      };
    }

    const obsolete = await this.activeStorage.findLineage(identity.lineageKey);
    if (obsolete.length > 0) {
      await Promise.all(obsolete.map((entry) => this.activeStorage.delete(entry.fullKey)));
      return { hit: false, missReason: 'version-mismatch' };
    }

    return { hit: false, missReason: 'absent' };
  }

  store(entry: ResultCacheEntry): void {
    this.trackWrite(this.ready().then(() => this.writeWithQuotaRecovery(entry)));
  }

  private async writeWithQuotaRecovery(entry: ResultCacheEntry): Promise<void> {
    try {
      await this.activeStorage.put(entry);
      return;
    } catch (error) {
      if (!isQuotaError(error)) throw error;
    }

    const entries = await this.activeStorage.list();
    entries.sort((left, right) => (
      left.lastAccessedAt - right.lastAccessedAt
      || left.createdAt - right.createdAt
      || left.fullKey.localeCompare(right.fullKey)
    ));
    if (entries[0]) await this.activeStorage.delete(entries[0].fullKey);

    try {
      await this.activeStorage.put(entry);
      return;
    } catch (error) {
      if (!isQuotaError(error) || this.activeStorage === this.fallbackStorage) throw error;
    }

    this.activeStorage = this.fallbackStorage;
    await this.initializeStorage(this.fallbackStorage);
    await this.fallbackStorage.put(entry);
  }

  private touchEntry(entry: ResultCacheEntry): ResultCacheEntry {
    const now = (this.options.now || Date.now)();
    const touchIntervalMs = this.options.touchIntervalMs ?? CACHE_ACCESS_TOUCH_INTERVAL_MS;
    if (now - entry.lastAccessedAt < touchIntervalMs) return entry;

    const touched = { ...entry, lastAccessedAt: now };
    this.trackWrite(this.ready().then(() => this.writeWithQuotaRecovery(touched)));
    return touched;
  }

  private trackWrite(write: Promise<void>): void {
    const tracked = write.finally(() => this.pendingWrites.delete(tracked));
    this.pendingWrites.add(tracked);
    void tracked.catch(() => undefined);
  }

  async settlePendingWrites(): Promise<void> {
    const results = await Promise.allSettled([...this.pendingWrites]);
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failure) throw failure.reason;
  }

  async clear(): Promise<void> {
    await this.ready();
    await this.activeStorage.clear();
  }
}
