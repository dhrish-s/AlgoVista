import { StructuredProblem, ExecutionStep } from '../../types';

export type AIProviderID = 'gemini' | 'openai' | 'claude';

export interface AIProviderSettings {
  defaultProvider: AIProviderID;
  modelNames: Record<AIProviderID, string>;
  fallbackProvider?: AIProviderID;
  taskRouting?: Record<string, AIProviderID>;
}

export interface ReasoningEvaluation {
  isValid: boolean;
  score: number; // 0 to 1
  feedback: string;
  suggestedFocus?: string;
}

export interface HintGeneration {
  hints: string[];
  nextSmallStep: string;
}

export interface CodeExplanation {
  summary: string;
  lineByLine: Record<number, string>;
  potentialBugs: string[];
}

export interface AIResponse<T> {
  data: T;
  raw?: any;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AIProvider {
  id: AIProviderID;
  
  parseProblem(input: string, options?: AIRequestOptions): Promise<AIResponse<StructuredProblem>>;
  evaluateReasoning(problem: StructuredProblem, reasoning: string, options?: AIRequestOptions): Promise<AIResponse<ReasoningEvaluation>>;
  generateHints(problem: StructuredProblem, userCode: string, options?: AIRequestOptions): Promise<AIResponse<HintGeneration>>;
  explainCode(problem: StructuredProblem, code: string, options?: AIRequestOptions): Promise<AIResponse<CodeExplanation>>;
  generateSteps(problem: StructuredProblem, code: string, testCase: any, options?: AIRequestOptions): Promise<AIResponse<ExecutionStep[]>>;
}

export interface AIRequestOptions {
  provider?: AIProviderID;
  model?: string;
  task?: string;
  signal?: AbortSignal;
  onStream?: (chunk: string) => void;
}
