export const canonicalizeProblemInput = (input: string): string => (
  input.trim().replace(/\s+/g, ' ')
);

const sortKeyValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeyValue);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) result[key] = sortKeyValue(child);
      return result;
    }, {});
};

export const stableSerializeKeyValue = (value: unknown): string => JSON.stringify(sortKeyValue(value));

export const hashCacheValue = async (value: unknown): Promise<string> => {
  const bytes = new TextEncoder().encode(stableSerializeKeyValue(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const createResultCacheIdentity = async (
  descriptor: ResultCacheKeyDescriptor
): Promise<ResultCacheIdentity> => {
  const { provider, model, versions, ...content } = descriptor;
  const prefix = `${descriptor.layer}:`;
  const [fullHash, compatibleHash, lineageHash] = await Promise.all([
    hashCacheValue(descriptor),
    hashCacheValue({ ...content, versions }),
    hashCacheValue(content)
  ]);
  return {
    fullKey: `${prefix}${fullHash}`,
    compatibleKey: `${prefix}${compatibleHash}`,
    lineageKey: `${prefix}${lineageHash}`
  };
};
import { ResultCacheIdentity, ResultCacheKeyDescriptor } from './cacheTypes';
