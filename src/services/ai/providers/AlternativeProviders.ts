import { AIProvider, AIProviderID, AIResponse, ReasoningEvaluation, HintGeneration, CodeExplanation, CoachMessage, AIRequestOptions } from '../types';
import { StructuredProblem, ExecutionStep } from '../../../types';

export class OpenAIProvider implements AIProvider {
  id: AIProviderID = 'openai';

  async parseProblem(input: string, options?: AIRequestOptions): Promise<AIResponse<StructuredProblem>> {
    throw new Error('OpenAI Provider not yet configured. Please add API Key.');
  }
  async evaluateReasoning(problem: StructuredProblem, reasoning: string, options?: AIRequestOptions): Promise<AIResponse<ReasoningEvaluation>> { throw new Error('Not implemented'); }
  async generateHints(problem: StructuredProblem, userCode: string, options?: AIRequestOptions): Promise<AIResponse<HintGeneration>> { throw new Error('Not implemented'); }
  async explainCode(problem: StructuredProblem, code: string, options?: AIRequestOptions): Promise<AIResponse<CodeExplanation>> { throw new Error('Not implemented'); }
  async generateSteps(problem: StructuredProblem, code: string, testCase: any, options?: AIRequestOptions): Promise<AIResponse<ExecutionStep[]>> { throw new Error('Not implemented'); }
  async coachMessage(problem: StructuredProblem, userMessage: string, chatHistory: Array<{ role: 'user' | 'ai'; content: string }>, userReasoning?: string, options?: AIRequestOptions): Promise<AIResponse<CoachMessage>> {
    return {
      data: {
        content: "OpenAI Provider coaching is not yet available. Please switch to Gemini or try again later.",
        isError: true
      }
    };
  }
}

export class ClaudeProvider implements AIProvider {
  id: AIProviderID = 'claude';

  async parseProblem(input: string, options?: AIRequestOptions): Promise<AIResponse<StructuredProblem>> {
    throw new Error('Claude Provider not yet configured. Please add API Key.');
  }
  async evaluateReasoning(problem: StructuredProblem, reasoning: string, options?: AIRequestOptions): Promise<AIResponse<ReasoningEvaluation>> { throw new Error('Not implemented'); }
  async generateHints(problem: StructuredProblem, userCode: string, options?: AIRequestOptions): Promise<AIResponse<HintGeneration>> { throw new Error('Not implemented'); }
  async explainCode(problem: StructuredProblem, code: string, options?: AIRequestOptions): Promise<AIResponse<CodeExplanation>> { throw new Error('Not implemented'); }
  async generateSteps(problem: StructuredProblem, code: string, testCase: any, options?: AIRequestOptions): Promise<AIResponse<ExecutionStep[]>> { throw new Error('Not implemented'); }
  async coachMessage(problem: StructuredProblem, userMessage: string, chatHistory: Array<{ role: 'user' | 'ai'; content: string }>, userReasoning?: string, options?: AIRequestOptions): Promise<AIResponse<CoachMessage>> {
    return {
      data: {
        content: "Claude Provider coaching is not yet available. Please switch to Gemini or try again later.",
        isError: true
      }
    };
  }
}
