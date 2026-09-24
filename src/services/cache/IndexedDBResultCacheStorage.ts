import { RESULT_CACHE_SCHEMA_VERSION } from './cacheVersions';
import { ResultCacheEntry, ResultCacheMetadata, ResultCacheStorage } from './cacheTypes';

export const RESULT_CACHE_DATABASE_NAME = `algovista-results-v${RESULT_CACHE_SCHEMA_VERSION}`;

const ENTRY_STORE = 'entries';
const METADATA_STORE = 'metadata';

const requestValue = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
});

const transactionDone = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'));
  transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction was aborted.'));
});

export class IndexedDBResultCacheStorage implements ResultCacheStorage {
  private databasePromise?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is unavailable.'));
        return;
      }
      const request = indexedDB.open(RESULT_CACHE_DATABASE_NAME, RESULT_CACHE_SCHEMA_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(ENTRY_STORE)) {
          const entries = database.createObjectStore(ENTRY_STORE, { keyPath: 'fullKey' });
          entries.createIndex('compatibleKey', 'compatibleKey', { unique: false });
          entries.createIndex('lineageKey', 'lineageKey', { unique: false });
          entries.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
        }
        if (!database.objectStoreNames.contains(METADATA_STORE)) {
          database.createObjectStore(METADATA_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Unable to open the result cache.'));
      request.onblocked = () => reject(new Error('The result cache database upgrade is blocked.'));
    });
    return this.databasePromise;
  }

  async get(fullKey: string): Promise<ResultCacheEntry | undefined> {
    const database = await this.open();
    return requestValue(database.transaction(ENTRY_STORE).objectStore(ENTRY_STORE).get(fullKey));
  }

  async findCompatible(compatibleKey: string): Promise<ResultCacheEntry[]> {
    const database = await this.open();
    return requestValue(database.transaction(ENTRY_STORE).objectStore(ENTRY_STORE).index('compatibleKey').getAll(compatibleKey));
  }

  async findLineage(lineageKey: string): Promise<ResultCacheEntry[]> {
    const database = await this.open();
    return requestValue(database.transaction(ENTRY_STORE).objectStore(ENTRY_STORE).index('lineageKey').getAll(lineageKey));
  }

  async list(): Promise<ResultCacheEntry[]> {
    const database = await this.open();
    return requestValue(database.transaction(ENTRY_STORE).objectStore(ENTRY_STORE).getAll());
  }

  async put(entry: ResultCacheEntry): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(ENTRY_STORE, 'readwrite');
    transaction.objectStore(ENTRY_STORE).put(entry);
    await transactionDone(transaction);
  }

  async delete(fullKey: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(ENTRY_STORE, 'readwrite');
    transaction.objectStore(ENTRY_STORE).delete(fullKey);
    await transactionDone(transaction);
  }

  async clear(): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(ENTRY_STORE, 'readwrite');
    transaction.objectStore(ENTRY_STORE).clear();
    await transactionDone(transaction);
  }

  async getMetadata(): Promise<ResultCacheMetadata | undefined> {
    const database = await this.open();
    return requestValue(database.transaction(METADATA_STORE).objectStore(METADATA_STORE).get('versions'));
  }

  async setMetadata(metadata: ResultCacheMetadata): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(METADATA_STORE, 'readwrite');
    transaction.objectStore(METADATA_STORE).put(metadata);
    await transactionDone(transaction);
  }
}
