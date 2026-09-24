import { ResultCacheEntry, ResultCacheMetadata, ResultCacheStorage } from './cacheTypes';

export class MemoryResultCacheStorage implements ResultCacheStorage {
  private entries = new Map<string, ResultCacheEntry>();
  private metadata?: ResultCacheMetadata;

  constructor(private readonly maximumBytes = Number.POSITIVE_INFINITY) {}

  async get(fullKey: string): Promise<ResultCacheEntry | undefined> {
    return this.entries.get(fullKey);
  }

  async findCompatible(compatibleKey: string): Promise<ResultCacheEntry[]> {
    return [...this.entries.values()].filter((entry) => entry.compatibleKey === compatibleKey);
  }

  async findLineage(lineageKey: string): Promise<ResultCacheEntry[]> {
    return [...this.entries.values()].filter((entry) => entry.lineageKey === lineageKey);
  }

  async list(): Promise<ResultCacheEntry[]> {
    return [...this.entries.values()];
  }

  async put(entry: ResultCacheEntry): Promise<void> {
    const replacedBytes = this.entries.get(entry.fullKey)?.byteSize || 0;
    const nextBytes = [...this.entries.values()].reduce((total, current) => total + current.byteSize, 0)
      - replacedBytes
      + entry.byteSize;
    if (nextBytes > this.maximumBytes) {
      throw new DOMException('The result cache quota was exceeded.', 'QuotaExceededError');
    }
    this.entries.set(entry.fullKey, entry);
  }

  async delete(fullKey: string): Promise<void> {
    this.entries.delete(fullKey);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  async getMetadata(): Promise<ResultCacheMetadata | undefined> {
    return this.metadata;
  }

  async setMetadata(metadata: ResultCacheMetadata): Promise<void> {
    this.metadata = metadata;
  }
}
