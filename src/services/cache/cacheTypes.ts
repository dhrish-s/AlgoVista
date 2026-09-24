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
