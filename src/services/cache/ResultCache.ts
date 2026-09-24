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

export class ResultCache {
  private activeStorage: ResultCacheStorage;
  private readonly initialization: Promise<void>;

  constructor(
    primaryStorage: ResultCacheStorage = new IndexedDBResultCacheStorage(),
    private readonly fallbackStorage: ResultCacheStorage = new MemoryResultCacheStorage()
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
    if (exact) return { hit: true, entry: exact as ResultCacheEntry<T>, matchType: 'exact-provider' };

    const compatible = await this.activeStorage.findCompatible(identity.compatibleKey);
    compatible.sort((left, right) => (
      right.createdAt - left.createdAt || left.fullKey.localeCompare(right.fullKey)
    ));
    if (compatible[0]) {
      return {
        hit: true,
        entry: compatible[0] as ResultCacheEntry<T>,
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

  async clear(): Promise<void> {
    await this.ready();
    await this.activeStorage.clear();
  }
}
