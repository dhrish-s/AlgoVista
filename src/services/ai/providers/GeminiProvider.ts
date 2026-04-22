import { GoogleGenAI, Type } from "@google/genai";
import { AIProvider, AIProviderID, AIResponse, ReasoningEvaluation, HintGeneration, CodeExplanation, CoachMessage, AIRequestOptions } from '../types';
import { StructuredProblem, ExecutionStep } from '../../../types';

export class GeminiProvider implements AIProvider {
  id: AIProviderID = 'gemini';
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async parseProblem(input: string, options?: AIRequestOptions): Promise<AIResponse<StructuredProblem>> {
    const response = await this.ai.models.generateContent({
      model: options?.model || "gemini-3-flash-preview",
      contents: `Parse this LeetCode problem into structured JSON. 
      If the input is a URL, use your internal knowledge of the problem. 
      CRITICAL: You MUST generate at least 2 distinct approaches (e.g., Brute Force and Optimal) in the 'approaches' field. 
      Each approach must have a clear 'name', 'complexity' (time/space), and 'explanation'.
      \n\nInput: ${input}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
            statement: { type: Type.STRING },
            examples: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  input: { type: Type.STRING },
                  output: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                }
              }
            },
            constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
            starterCode: { type: Type.STRING },
            approaches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  complexity: {
                    type: Type.OBJECT,
                    properties: {
                      time: { type: Type.STRING },
                      space: { type: Type.STRING }
                    }
                  },
                  explanation: { type: Type.STRING },
                  isOptimal: { type: Type.BOOLEAN }
                }
              }
            }
          }
        }
      }
    });

    if (options?.signal?.aborted) {
      throw new Error('AbortError');
    }

    const data = JSON.parse(response.text || '{}');
    return { 
      data: {
        ...data,
        id: Math.random().toString(36).substr(2, 9),
        source: 'mixed',
        parsingConfidence: 1,
        inferredPatterns: []
      } 
    };
  }

  async evaluateReasoning(problem: StructuredProblem, reasoning: string, options?: AIRequestOptions): Promise<AIResponse<ReasoningEvaluation>> {
    const response = await this.ai.models.generateContent({
      model: options?.model || "gemini-3-flash-preview",
      contents: `Problem: ${problem.title}\nUser Reasoning: ${reasoning}\n\nEvaluate if this approach is correct and optimal.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            suggestedFocus: { type: Type.STRING }
          }
        }
      }
    });

    if (options?.signal?.aborted) {
      throw new Error('AbortError');
    }

    return { data: JSON.parse(response.text || '{}') };
  }

  async generateHints(problem: StructuredProblem, userCode: string, options?: AIRequestOptions): Promise<AIResponse<HintGeneration>> {
    const response = await this.ai.models.generateContent({
      model: options?.model || "gemini-3-flash-preview",
      contents: `Provide hints for this problem and code: ${problem.title}\nCode:\n${userCode}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hints: { type: Type.ARRAY, items: { type: Type.STRING } },
            nextSmallStep: { type: Type.STRING }
          }
        }
      }
    });

    if (options?.signal?.aborted) {
      throw new Error('AbortError');
    }

    return { data: JSON.parse(response.text || '{}') };
  }

  async explainCode(problem: StructuredProblem, code: string, options?: AIRequestOptions): Promise<AIResponse<CodeExplanation>> {
    const response = await this.ai.models.generateContent({
      model: options?.model || "gemini-3-flash-preview",
      contents: `Explain this code for problem ${problem.title}:\n${code}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            lineByLine: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } },
            potentialBugs: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    if (options?.signal?.aborted) {
      throw new Error('AbortError');
    }

    return { data: JSON.parse(response.text || '{}') };
  }

  async generateSteps(problem: StructuredProblem, code: string, testCase: any, options?: AIRequestOptions): Promise<AIResponse<ExecutionStep[]>> {
    const isUserCode = code.length > 50; 
    const MAX_STEPS = 30; // Safety limit
    
    const prompt = isUserCode 
      ? `Generate a visualization trace for this USER CODE (maybe partial/broken) for problem "${problem.title}". 
         Input: ${JSON.stringify(testCase.input)}. 
         Code: \n${code}\n
         ONLY visualize their actual logic.
         LIMIT the trace to a maximum of ${MAX_STEPS} logical steps to avoid overwhelming the system.
        `
      : `Generate a step-by-step execution trace for problem "${problem.title}" using approach "${code}". 
         Input: ${JSON.stringify(testCase.input)}.
         LIMIT the trace to a maximum of ${MAX_STEPS} logical steps.
        `;

    const response = await this.ai.models.generateContent({
      model: options?.model || "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              line: { type: Type.NUMBER },
              explanation: { type: Type.STRING },
              operationType: { type: Type.STRING },
              variables: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } },
              visualState: {
                type: Type.OBJECT,
                properties: {
                  array: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  map: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } },
                  stack: { type: Type.ARRAY, items: { type: Type.STRING } },
                  indices: { type: Type.OBJECT, additionalProperties: { type: Type.INTEGER } },
                  highlights: { type: Type.ARRAY, items: { type: Type.INTEGER } }
                }
              }
            }
          }
        }
      }
    });

    if (options?.signal?.aborted) {
      throw new Error('AbortError');
    }

    return { data: JSON.parse(response.text || '[]') };
  }

  async coachMessage(problem: StructuredProblem, userMessage: string, chatHistory: Array<{ role: 'user' | 'ai'; content: string }>, userReasoning?: string, options?: AIRequestOptions): Promise<AIResponse<CoachMessage>> {
    const historyText = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`).join('\n');
    
    const prompt = `You are a premium LeetCode Engineering Tutor.
User Objective: Learn to solve "${problem.title}".
Difficulty: ${problem.difficulty || 'Unknown'}.
${userReasoning ? `Context: The user has explained their reasoning as: "${userReasoning}".` : ''}

STRICT RULES:
1. NEVER provide direct code.
2. Focus on "Pattern Recognition".
3. Use the "Socratic Method": ask clarifying questions.
4. If the user is stuck, give a "Minimal Hint" (e.g., mention a data structure).
5. Evaluate their reasoning for logical gaps (edge cases, complexity).

Chat History:
${historyText}

New User Input: ${userMessage}`;

    const response = await this.ai.models.generateContent({
      model: options?.model || "gemini-3-flash-preview",
      contents: prompt
    });

    if (options?.signal?.aborted) {
      throw new Error('AbortError');
    }

    return {
      data: {
        content: response.text || "I'm having trouble thinking today. Try again?",
        isError: false
      }
    };
  }
}
