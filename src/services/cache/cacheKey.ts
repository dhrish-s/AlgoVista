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
