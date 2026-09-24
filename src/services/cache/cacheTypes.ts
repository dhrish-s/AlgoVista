import { AIProviderID, SolutionLanguage } from '../ai/types';

export type ResultCacheLayer = 'parse' | 'solution' | 'trace';
export type TraceCacheMode = 'ideal' | 'user-code';

export interface ResultCacheVersionSet {
  contract: number;
  prompt: number;
  validator: number;
  schema: number;
}

export interface ResultCacheKeyDescriptor {
  layer: ResultCacheLayer;
  canonicalProblemInput: string;
  approachId: string | null;
  language: SolutionLanguage | null;
  generatedSourceHash: string | null;
  testCaseHash: string | null;
  traceMode: TraceCacheMode | null;
  versions: ResultCacheVersionSet;
  provider: AIProviderID;
  model: string;
}

export interface ResultCacheIdentity {
  fullKey: string;
  compatibleKey: string;
  lineageKey: string;
}

export interface ResultCacheEntry<T = unknown> extends ResultCacheIdentity {
  layer: ResultCacheLayer;
  versions: ResultCacheVersionSet;
  producerProvider: AIProviderID;
  producerModel: string;
  payload: T;
  byteSize: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface ResultCacheMetadata {
  id: 'versions';
  versions: ResultCacheVersionSet;
}

export interface ResultCacheStorage {
  get(fullKey: string): Promise<ResultCacheEntry | undefined>;
  findCompatible(compatibleKey: string): Promise<ResultCacheEntry[]>;
  findLineage(lineageKey: string): Promise<ResultCacheEntry[]>;
  list(): Promise<ResultCacheEntry[]>;
  put(entry: ResultCacheEntry): Promise<void>;
  delete(fullKey: string): Promise<void>;
  clear(): Promise<void>;
  getMetadata(): Promise<ResultCacheMetadata | undefined>;
  setMetadata(metadata: ResultCacheMetadata): Promise<void>;
}
