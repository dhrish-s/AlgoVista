import { AIProviderID, AIRequestOperation, AIRequestPayloadMetrics, AIUsage } from './types';
import { ResultCacheLayer, ResultCacheMatchType, ResultCacheMissReason } from '../cache/cacheTypes';

export type AITelemetryOutcome = 'success' | 'fallback' | 'rejected' | 'timeout' | 'failed' | 'cancelled';

export interface AITelemetryEntry {
  timestamp: string;
  operation: AIRequestOperation;
  provider: AIProviderID;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  latencyMs: number;
  payload: AIRequestPayloadMetrics;
  outcome: AITelemetryOutcome;
  message?: string;
}

export interface AICacheTelemetryEntry {
  timestamp: string;
  layer: ResultCacheLayer;
  result: 'hit' | 'miss';
  missReason?: ResultCacheMissReason;
  matchType?: ResultCacheMatchType;
  bytesServed: number;
  producerProvider?: AIProviderID;
  producerModel?: string;
}

const TELEMETRY_CAPACITY = 500;
const entries: AITelemetryEntry[] = [];
const cacheEntries: AICacheTelemetryEntry[] = [];

const env = (): Record<string, unknown> => {
  const viteEnv = ((import.meta as any).env || {}) as Record<string, unknown>;
  const processEnv = typeof process !== 'undefined' ? process.env : {};
  return { ...processEnv, ...viteEnv };
};

export const isAITelemetryEnabled = (): boolean => {
  const values = env();
  const isDevelopment = typeof values.DEV === 'boolean'
    ? values.DEV
    : values.NODE_ENV !== 'production';
  return isDevelopment && values.VITE_AI_TELEMETRY === 'true';
};

export const appendAITelemetry = (entry: AITelemetryEntry): void => {
  entries.push({ ...entry, payload: { ...entry.payload } });
  if (entries.length > TELEMETRY_CAPACITY) {
    entries.splice(0, entries.length - TELEMETRY_CAPACITY);
  }
};

export const recordAITelemetry = (entry: {
  operation: AIRequestOperation;
  provider: AIProviderID;
  model: string;
  usage?: AIUsage;
  latencyMs: number;
  payload?: AIRequestPayloadMetrics;
  outcome: AITelemetryOutcome;
  message?: string;
}): void => {
  if (!isAITelemetryEnabled()) return;
  appendAITelemetry({
    timestamp: new Date().toISOString(),
    operation: entry.operation,
    provider: entry.provider,
    model: entry.model,
    inputTokens: entry.usage?.inputTokens,
    outputTokens: entry.usage?.outputTokens,
    cacheReadTokens: entry.usage?.cacheReadTokens,
    cacheWriteTokens: entry.usage?.cacheWriteTokens,
    latencyMs: entry.latencyMs,
    payload: entry.payload || { staticCharacters: 0, variableCharacters: 0, totalCharacters: 0 },
    outcome: entry.outcome,
    message: entry.message
  });
};

export const getAITelemetryEntries = (): AITelemetryEntry[] => entries.map((entry) => ({
  ...entry,
  payload: { ...entry.payload }
}));

export const exportAITelemetryJSON = (): string => JSON.stringify(getAITelemetryEntries(), null, 2);

export const recordAICacheTelemetry = (entry: Omit<AICacheTelemetryEntry, 'timestamp'>): void => {
  if (!isAITelemetryEnabled()) return;
  cacheEntries.push({
    timestamp: new Date().toISOString(),
    layer: entry.layer,
    result: entry.result,
    bytesServed: entry.bytesServed,
    ...(entry.missReason === undefined ? {} : { missReason: entry.missReason }),
    ...(entry.matchType === undefined ? {} : { matchType: entry.matchType }),
    ...(entry.producerProvider === undefined ? {} : { producerProvider: entry.producerProvider }),
    ...(entry.producerModel === undefined ? {} : { producerModel: entry.producerModel })
  });
  if (cacheEntries.length > TELEMETRY_CAPACITY) {
    cacheEntries.splice(0, cacheEntries.length - TELEMETRY_CAPACITY);
  }
};

export const getAICacheTelemetryEntries = (): AICacheTelemetryEntry[] => cacheEntries.map((entry) => ({ ...entry }));

export const exportAICacheTelemetryJSON = (): string => JSON.stringify(getAICacheTelemetryEntries(), null, 2);

export const clearAITelemetry = (): void => {
  entries.length = 0;
  cacheEntries.length = 0;
};
