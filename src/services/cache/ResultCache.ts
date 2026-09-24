import { IndexedDBResultCacheStorage } from './IndexedDBResultCacheStorage';
import { MemoryResultCacheStorage } from './MemoryResultCacheStorage';
import { RESULT_CACHE_VERSIONS } from './cacheVersions';
import { ResultCacheEntry, ResultCacheStorage, ResultCacheVersionSet } from './cacheTypes';

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

  async clear(): Promise<void> {
    await this.ready();
    await this.activeStorage.clear();
  }
}
