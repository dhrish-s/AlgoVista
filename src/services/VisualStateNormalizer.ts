import { VisualState } from '../types';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const normalizeIndices = (value: unknown): Record<string, number> => {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .map(([name, index]) => [name, typeof index === 'number' ? index : Number(index)] as const)
      .filter((entry): entry is [string, number] => Number.isInteger(entry[1]))
  );
};

const normalizeHighlights = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((index) => typeof index === 'number' ? index : Number(index))
    .filter((index): index is number => Number.isInteger(index));
};

const normalizeMap = (value: unknown): Record<string, unknown> | undefined => {
  if (isRecord(value)) return { ...value };
  if (!Array.isArray(value)) return undefined;

  const entries = value.filter(
    (entry): entry is [unknown, unknown] => Array.isArray(entry) && entry.length >= 2
  );
  if (entries.length !== value.length) return undefined;

  return Object.fromEntries(entries.map(([key, mapValue]) => [String(key), mapValue]));
};

const normalizeStack = (value: unknown): unknown[] | undefined => {
  if (Array.isArray(value)) return [...value];
  if (isRecord(value) && Array.isArray(value.items)) return [...value.items];
  return undefined;
};

const normalizeQueue = (value: unknown): unknown[] | undefined => {
  if (Array.isArray(value)) return [...value];
  if (isRecord(value) && Array.isArray(value.items)) return [...value.items];
  return undefined;
};

export const normalizeVisualState = (rawState: UnknownRecord): VisualState => {
  const normalized = { ...rawState } as VisualState;
  const arrayAliases = [rawState.array, rawState.nums, rawState.values];
  const array = arrayAliases.find(Array.isArray);
  const hasArrayField = ['array', 'nums', 'values'].some((key) => key in rawState);

  if (array) {
    normalized.array = [...array];
    normalized.indices = normalizeIndices(rawState.indices ?? rawState.pointers);
    normalized.highlights = normalizeHighlights(
      rawState.highlights ?? rawState.highlightedIndices ?? rawState.highlighted
    );
  } else if (hasArrayField) {
    delete normalized.array;
  }

  const mapAliases = [rawState.map, rawState.hashMap, rawState.hash_map, rawState.dictionary];
  const map = mapAliases.map(normalizeMap).find((candidate) => candidate !== undefined);
  const hasMapField = ['map', 'hashMap', 'hash_map', 'dictionary'].some((key) => key in rawState);

  if (map) {
    normalized.map = map;
  } else if (hasMapField) {
    delete normalized.map;
  }

  const stackAliases = [rawState.stack, rawState.callStack, rawState.call_stack, rawState.monotonicStack];
  const stack = stackAliases.map(normalizeStack).find((candidate) => candidate !== undefined);
  const hasStackField = ['stack', 'callStack', 'call_stack', 'monotonicStack'].some((key) => key in rawState);

  if (stack) {
    normalized.stack = stack;
  } else if (hasStackField) {
    delete normalized.stack;
  }

  const queueAliases = [rawState.queue, rawState.bfsQueue, rawState.workQueue, rawState.deque];
  const queue = queueAliases.map(normalizeQueue).find((candidate) => candidate !== undefined);
  const hasQueueField = ['queue', 'bfsQueue', 'workQueue', 'deque'].some((key) => key in rawState);

  if (queue) {
    normalized.queue = queue;
  } else if (hasQueueField) {
    delete normalized.queue;
  }

  return normalized;
};
