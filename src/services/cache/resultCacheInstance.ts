import { ResultCache } from './ResultCache';

let resultCache: ResultCache | null = null;

// A high-cost measured graph case used about 43 KiB for one parse plus two-language
// solution and trace entries. 25 MiB retains roughly 590 comparable problem sets.
export const RESULT_CACHE_MAXIMUM_BYTES = 25 * 1024 * 1024;

export const getResultCache = (): ResultCache => {
  if (!resultCache) {
    resultCache = new ResultCache(undefined, undefined, {
      maximumBytes: RESULT_CACHE_MAXIMUM_BYTES
    });
  }
  return resultCache;
};

export const setResultCacheForTests = (cache: ResultCache | null): void => {
  resultCache = cache;
};
