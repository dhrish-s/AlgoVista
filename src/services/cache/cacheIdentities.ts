import { ApproachOption, StructuredProblem } from '../../types';
import { AIProviderID, SolutionLanguage } from '../ai/types';
import { RESULT_CACHE_VERSIONS } from './cacheVersions';
import { canonicalizeProblemInput, createResultCacheIdentity, hashCacheValue } from './cacheKey';
import { ResultCacheIdentity, TraceCacheMode } from './cacheTypes';

export interface ResultCacheProviderTarget {
  provider: AIProviderID;
  model: string;
}

const problemInput = (problem: StructuredProblem): string => (
  canonicalizeProblemInput(problem.sourceInput || problem.statement)
);

export const createParseCacheIdentity = (
  input: string,
  target: ResultCacheProviderTarget
): Promise<ResultCacheIdentity> => createResultCacheIdentity({
  layer: 'parse',
  canonicalProblemInput: canonicalizeProblemInput(input),
  approachId: null,
  language: null,
  generatedSourceHash: null,
  testCaseHash: null,
  traceMode: null,
  versions: RESULT_CACHE_VERSIONS,
  ...target
});

export const createSolutionCacheIdentity = (
  problem: StructuredProblem,
  approach: ApproachOption,
  language: SolutionLanguage,
  target: ResultCacheProviderTarget
): Promise<ResultCacheIdentity> => createResultCacheIdentity({
  layer: 'solution',
  canonicalProblemInput: problemInput(problem),
  approachId: approach.id,
  language,
  generatedSourceHash: null,
  testCaseHash: null,
  traceMode: null,
  versions: RESULT_CACHE_VERSIONS,
  ...target
});

export const createTraceCacheIdentity = async (
  problem: StructuredProblem,
  approachId: string | null,
  language: SolutionLanguage,
  source: string,
  testCase: unknown,
  traceMode: TraceCacheMode,
  target: ResultCacheProviderTarget
): Promise<ResultCacheIdentity> => createResultCacheIdentity({
  layer: 'trace',
  canonicalProblemInput: problemInput(problem),
  approachId,
  language,
  generatedSourceHash: await hashCacheValue(source),
  testCaseHash: await hashCacheValue(testCase),
  traceMode,
  versions: RESULT_CACHE_VERSIONS,
  ...target
});
