import { StructuredProblem, ExecutionStep } from '../../types';
import { AIProviderID, CodeExplanation, HintGeneration, ReasoningEvaluation } from './types';

export interface ProviderAvailability {
  available: boolean;
  reason?: string;
}

const envValue = (key: string): string => {
  const env = (process.env as Record<string, string | undefined>) || {};
  return env[key]?.trim() || '';
};

export const getProviderApiKey = (providerId: AIProviderID): string => {
  if (providerId === 'gemini') {
    return envValue('VITE_GEMINI_API_KEY') || envValue('GEMINI_API_KEY');
  }
  if (providerId === 'openai') return envValue('VITE_OPENAI_API_KEY');
  if (providerId === 'claude') return envValue('VITE_CLAUDE_API_KEY');
  return '';
};

export const getDefaultProvider = (): AIProviderID => {
  const provider = envValue('VITE_AI_PROVIDER') as AIProviderID;
  return provider === 'openai' || provider === 'claude' || provider === 'gemini' ? provider : 'gemini';
};

export const getDefaultFallbackProvider = (): AIProviderID => {
  const provider = envValue('VITE_FALLBACK_AI_PROVIDER') as AIProviderID;
  return provider === 'openai' || provider === 'claude' || provider === 'gemini' ? provider : 'gemini';
};

export const getDefaultModelNames = (): Record<AIProviderID, string> => ({
  gemini: envValue('VITE_GEMINI_MODEL') || 'gemini-3-flash-preview',
  openai: envValue('VITE_OPENAI_MODEL') || 'gpt-4o-mini',
  claude: envValue('VITE_CLAUDE_MODEL') || 'claude-3-5-haiku-latest'
});

export const getProviderAvailability = (providerId: AIProviderID): ProviderAvailability => {
  if (!getProviderApiKey(providerId)) {
    return { available: false, reason: `${providerId} API key is missing.` };
  }
  return { available: true };
};

export const assertProviderAvailable = (providerId: AIProviderID) => {
  const availability = getProviderAvailability(providerId);
  if (!availability.available) {
    throw new Error(`${providerId} provider is unavailable: ${availability.reason}`);
  }
};

export const extractJson = <T>(text: string, fallback: T): T => {
  const trimmed = text.trim();
  if (!trimmed) return fallback;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1]) as T;
    }

    const firstArray = trimmed.indexOf('[');
    const lastArray = trimmed.lastIndexOf(']');
    const firstObject = trimmed.indexOf('{');
    const lastObject = trimmed.lastIndexOf('}');
    const arrayAppearsFirst = firstArray >= 0 && (firstObject < 0 || firstArray < firstObject);

    if (arrayAppearsFirst && lastArray > firstArray) {
      return JSON.parse(trimmed.slice(firstArray, lastArray + 1)) as T;
    }

    if (firstObject >= 0 && lastObject > firstObject) {
      return JSON.parse(trimmed.slice(firstObject, lastObject + 1)) as T;
    }

    if (firstArray >= 0 && lastArray > firstArray) {
      return JSON.parse(trimmed.slice(firstArray, lastArray + 1)) as T;
    }
  }

  throw new Error('Provider returned a malformed response.');
};

export const normalizeProblem = (data: Partial<StructuredProblem>): StructuredProblem => ({
  id: data.id || Math.random().toString(36).slice(2, 11),
  source: data.source || 'mixed',
  slug: data.slug,
  number: data.number,
  title: data.title || 'Untitled Problem',
  difficulty: data.difficulty,
  tags: data.tags || [],
  statement: data.statement || '',
  examples: Array.isArray(data.examples) ? data.examples : [],
  constraints: Array.isArray(data.constraints) ? data.constraints : [],
  inputFormat: data.inputFormat,
  outputFormat: data.outputFormat,
  inferredPatterns: Array.isArray(data.inferredPatterns) ? data.inferredPatterns : [],
  parsingConfidence: typeof data.parsingConfidence === 'number' ? Math.max(0, Math.min(1, data.parsingConfidence)) : 0.75,
  requiresUserConfirmation: Boolean(data.requiresUserConfirmation),
  starterCode: data.starterCode || '',
  approaches: Array.isArray(data.approaches) ? data.approaches : [],
  hints: data.hints || []
});

export const normalizeSteps = (data: unknown): ExecutionStep[] => {
  if (!Array.isArray(data)) {
    throw new Error('Provider returned malformed execution steps.');
  }
  return data as ExecutionStep[];
};

export const unsupportedReasoning = (): ReasoningEvaluation => ({
  isValid: false,
  score: 0,
  feedback: 'This provider does not support reasoning evaluation yet.',
  suggestedFocus: 'Use parsing, coaching, or step generation with this provider.'
});

export const unsupportedHints = (): HintGeneration => ({
  hints: ['This provider does not support hint generation yet.'],
  nextSmallStep: 'Ask the coach for a reasoning nudge instead.'
});

export const unsupportedCodeExplanation = (): CodeExplanation => ({
  summary: 'This provider does not support code explanation yet.',
  lineByLine: {},
  potentialBugs: []
});
