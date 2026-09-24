import { AIProviderID } from '../ai/types';
import { measureSerializedBytes } from './cacheSizing';
import { ResultCacheEntry, ResultCacheIdentity, ResultCacheLayer, ResultCacheVersionSet } from './cacheTypes';

export const createResultCacheEntry = <T>(options: {
  identity: ResultCacheIdentity;
  layer: ResultCacheLayer;
  versions: ResultCacheVersionSet;
  producerProvider: AIProviderID;
  producerModel: string;
  payload: T;
  now?: number;
}): ResultCacheEntry<T> => {
  const timestamp = options.now ?? Date.now();
  const entry: ResultCacheEntry<T> = {
    ...options.identity,
    layer: options.layer,
    versions: options.versions,
    producerProvider: options.producerProvider,
    producerModel: options.producerModel,
    payload: options.payload,
    byteSize: 0,
    createdAt: timestamp,
    lastAccessedAt: timestamp
  };

  let measuredBytes = measureSerializedBytes(entry);
  while (entry.byteSize !== measuredBytes) {
    entry.byteSize = measuredBytes;
    measuredBytes = measureSerializedBytes(entry);
  }
  return entry;
};
