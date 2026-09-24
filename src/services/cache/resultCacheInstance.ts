import { ResultCache } from './ResultCache';

let resultCache: ResultCache | null = null;

export const getResultCache = (): ResultCache => {
  if (!resultCache) resultCache = new ResultCache();
  return resultCache;
};

export const setResultCacheForTests = (cache: ResultCache | null): void => {
  resultCache = cache;
};
