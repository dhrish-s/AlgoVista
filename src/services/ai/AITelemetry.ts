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
