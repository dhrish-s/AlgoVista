import { AIProviderID, AIRequestOperation, AIRequestPayloadMetrics } from './types';

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

const TELEMETRY_CAPACITY = 500;
const entries: AITelemetryEntry[] = [];

export const appendAITelemetry = (entry: AITelemetryEntry): void => {
  entries.push({ ...entry, payload: { ...entry.payload } });
  if (entries.length > TELEMETRY_CAPACITY) {
    entries.splice(0, entries.length - TELEMETRY_CAPACITY);
  }
};

export const getAITelemetryEntries = (): AITelemetryEntry[] => entries.map((entry) => ({
  ...entry,
  payload: { ...entry.payload }
}));

export const clearAITelemetry = (): void => {
  entries.length = 0;
};
