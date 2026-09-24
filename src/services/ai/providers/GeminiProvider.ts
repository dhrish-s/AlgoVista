import { GoogleGenAI, Type } from "@google/genai";
import { AIProvider, AIProviderID, AIResponse, ReasoningEvaluation, HintGeneration, CodeExplanation, CoachMessage, AIRequestOptions } from '../types';
import { StructuredProblem, ExecutionStep, ApproachOption } from '../../../types';
import { GeneratedSolution } from '../types';
import { DEFAULT_SOLUTION_LANGUAGE, SOLUTION_LANGUAGE_METADATA } from '../solutionLanguages';
import { buildSolutionInstructions, buildSolutionRequest } from '../solutionPrompt';
import { getDefaultModelNames, getProviderApiKey, normalizeProblem } from '../providerConfig';

const geminiUsage = (response: any) => {
  const usage = response?.usageMetadata;
  const candidates = typeof usage?.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : 0;
  const thoughts = typeof usage?.thoughtsTokenCount === 'number' ? usage.thoughtsTokenCount : 0;
  return {
    inputTokens: typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : undefined,
    outputTokens: candidates || thoughts ? candidates + thoughts : undefined,
    cacheReadTokens: typeof usage?.cachedContentTokenCount === 'number' ? usage.cachedContentTokenCount : undefined
  };
};

export class GeminiProvider implements AIProvider {
  id: AIProviderID = 'gemini';
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: getProviderApiKey('gemini') });
  }

  async parseProblem(input: string, options?: AIRequestOptions): Promise<AIResponse<StructuredProblem>> {
    const response = await this.ai.models.generateContent({
      model: options?.model || getDefaultModelNames().gemini,
      contents: `Parse this LeetCode problem into structured JSON. 
      If the input is a URL, use your internal knowledge of the problem. 
      Set parsingConfidence from 0 to 1 based on how complete and specific the input is.
      Set requiresUserConfirmation to true when the title, statement, examples, or constraints are inferred from sparse input.
      CRITICAL: You MUST generate at least 2 distinct approaches (e.g., Brute Force and Optimal) in the 'approaches' field. 
      Each approach MUST include:
      - name (string)
      - explanation (string)
      - complexity.time (Big-O string)
      - complexity.space (Big-O string)
      - isOptimal (boolean)
      Do not omit complexity for any approach.
      \n\nInput: ${input}`,
      config: {
        abortSignal: options?.signal,
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
            parsingConfidence: { type: Type.NUMBER },
            requiresUserConfirmation: { type: Type.BOOLEAN },
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

    const data = JSON.parse(response.text || '{}');
    return {
      data: normalizeProblem({
        ...data,
        id: Math.random().toString(36).substr(2, 9),
        source: 'mixed',
        parsingConfidence: typeof data.parsingConfidence === 'number' ? data.parsingConfidence : 1,
        requiresUserConfirmation: Boolean(data.requiresUserConfirmation),
        inferredPatterns: []
      }),
      raw: response,
      usage: geminiUsage(response)
    };
  }

  async evaluateReasoning(problem: StructuredProblem, reasoning: string, options?: AIRequestOptions): Promise<AIResponse<ReasoningEvaluation>> {
    const response = await this.ai.models.generateContent({
      model: options?.model || getDefaultModelNames().gemini,
      contents: `Problem: ${problem.title}\nUser Reasoning: ${reasoning}\n\nEvaluate if this approach is correct and optimal.`,
      config: {
        abortSignal: options?.signal,
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

    return { data: JSON.parse(response.text || '{}'), raw: response, usage: geminiUsage(response) };
  }

  async generateHints(problem: StructuredProblem, userCode: string, options?: AIRequestOptions): Promise<AIResponse<HintGeneration>> {
    const response = await this.ai.models.generateContent({
      model: options?.model || getDefaultModelNames().gemini,
      contents: `Provide hints for this problem and code: ${problem.title}\nCode:\n${userCode}`,
      config: {
        abortSignal: options?.signal,
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

    return { data: JSON.parse(response.text || '{}'), raw: response, usage: geminiUsage(response) };
  }

  async explainCode(problem: StructuredProblem, code: string, options?: AIRequestOptions): Promise<AIResponse<CodeExplanation>> {
    const response = await this.ai.models.generateContent({
      model: options?.model || getDefaultModelNames().gemini,
      contents: `Explain this code for problem ${problem.title}:\n${code}`,
      config: {
        abortSignal: options?.signal,
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

    return { data: JSON.parse(response.text || '{}'), raw: response, usage: geminiUsage(response) };
  }

  async generateSteps(problem: StructuredProblem, code: string, testCase: any, options?: AIRequestOptions): Promise<AIResponse<ExecutionStep[]>> {
    const isUserCode = options?.sourceLineCount !== undefined;
    const sourceLanguage = SOLUTION_LANGUAGE_METADATA[
      options?.solutionLanguage || DEFAULT_SOLUTION_LANGUAGE
    ].label;
    const MAX_STEPS = 50; // Safety limit; must align with DynamicStepGenerator.MAX_STEPS
    
    const prompt = isUserCode 
      ? `Generate a visualization trace for this USER CODE (maybe partial/broken) for problem "${problem.title}". 
         Input: ${JSON.stringify(testCase.input)}.
         Source language: ${sourceLanguage}.
         Code: \n${code}\n
         ONLY visualize their actual logic.
         LIMIT the trace to EXACTLY ${MAX_STEPS} logical steps maximum. Do not exceed this.
         Every step MUST have: id (string), line (number), explanation (string), operationType (string), variables (object), visualState (object).
         operationType MUST be one of: init, compare, move-pointer, swap, insert-map, lookup-map, push-stack, pop-stack, enqueue, dequeue, visit-node, update-dp, recurse-call, recurse-return, window-expand, window-shrink, return, found, assign.
         For array algorithms, visualState MUST use array for values, indices for named numeric pointers, and highlights for numeric indices.
         For hash-based algorithms, visualState MUST use map as an object of key-value pairs.
         For stack algorithms, visualState MUST use stack as an array ordered from bottom to top.
         For queue algorithms, visualState MUST use queue as an array ordered from front to back.
         For tree algorithms, use a compact base-and-delta trace. The first tree step's visualState MUST contain treeBase with nodes shaped as { id, value, children } and rootId, plus treeDelta. Every later tree step MUST contain only treeDelta and MUST NOT repeat treeBase or a full tree snapshot. A treeDelta may use activeNodeId (string or null), highlightNodeIds, unhighlightNodeIds, rootId (string or null), addNodes, updateNodes shaped as { id, value?, children? }, and removeNodeIds. Use {} when a step changes no tree visualization fields. Keep node ids stable, make every reference valid in the resulting tree, and include structural fields only when they actually change.
         For graph algorithms, use a compact base-and-delta trace with no root concept. The first graph step's visualState MUST contain graphBase with nodes shaped as { id, value }, edges shaped as { id, source, target, weight }, and directed, plus graphDelta. Every later graph step MUST contain only graphDelta and MUST NOT repeat graphBase or a full graph snapshot. A graphDelta may use activeNodeId or activeEdgeId (string or null), visitNodeIds, unvisitNodeIds, traverseEdgeIds, untraverseEdgeIds, addNodes, removeNodeIds, addEdges, and removeEdgeIds. Most BFS, DFS, and path-finding steps should include only newly visited nodes, newly traversed edges, and active ids. Use structural fields only when the algorithm actually mutates the graph, and use {} when nothing changes visually. Keep node and edge ids stable and make every reference valid in the resulting graph. Cycles and disconnected components are valid graph structures.
         For dynamic programming algorithms, use a compact base-and-delta trace. The first DP table step's visualState MUST contain dpTableBase with rows, columns, optional initialCells shaped as { row, column, value }, and optional rowLabels and columnLabels, plus dpTableDelta. Every later DP table step MUST contain only dpTableDelta and MUST NOT repeat dpTableBase or a full values matrix. A dpTableDelta may use updates shaped as { row, column, value }, activeCell as { row, column } or null, and highlightedCells as an array of { row, column }. List only cells changed during that step, even when a step changes a full row, column, or diagonal. Do not repeat previously filled cells. Use {} when nothing changes visually, and keep every cell coordinate within the base dimensions.
         For linked-list algorithms and pointer traversal or manipulation over a linked list, use a compact base-and-delta trace. The first linked-list step's visualState MUST contain linkedListBase with nodes shaped as { id, value, nextId } and headId, plus linkedListDelta. Every later linked-list step MUST contain only linkedListDelta and MUST NOT repeat linkedListBase or a full linkedList snapshot. A linkedListDelta may use nextUpdates shaped as { id, nextId }, headId (string or null), activeNodeId (string or null), and highlightedNodeIds. Every nextId MUST be an existing stable node id or null. Keep headId synchronized with the CURRENT structure, use null explicitly for null-terminated tails, and make each visualization state match that step's explanation after its described operations. For reversal, removal, and merge algorithms, most structural steps should include the actual pointer change in nextUpdates; this is expected and MUST NOT be omitted merely to make the trace smaller. Represent a cycle by pointing nextId back to an existing node, never by duplicating nodes. Use {} only when nothing changes visually. Use another visualization type when a linked list is not the algorithm's meaningful state.
         Return a JSON array of step objects only. Do not generate fake or placeholder steps.
        `
      : `Generate a step-by-step execution trace for problem "${problem.title}" using approach "${code}". 
         Input: ${JSON.stringify(testCase.input)}.
         LIMIT the trace to EXACTLY ${MAX_STEPS} logical steps maximum. Do not exceed this.
         Every step MUST have: id (string), line (number), explanation (string), operationType (string), variables (object), visualState (object).
         operationType MUST be one of: init, compare, move-pointer, swap, insert-map, lookup-map, push-stack, pop-stack, enqueue, dequeue, visit-node, update-dp, recurse-call, recurse-return, window-expand, window-shrink, return, found, assign.
         For array algorithms, visualState MUST use array for values, indices for named numeric pointers, and highlights for numeric indices.
         For hash-based algorithms, visualState MUST use map as an object of key-value pairs.
         For stack algorithms, visualState MUST use stack as an array ordered from bottom to top.
         For queue algorithms, visualState MUST use queue as an array ordered from front to back.
         For tree algorithms, use a compact base-and-delta trace. The first tree step's visualState MUST contain treeBase with nodes shaped as { id, value, children } and rootId, plus treeDelta. Every later tree step MUST contain only treeDelta and MUST NOT repeat treeBase or a full tree snapshot. A treeDelta may use activeNodeId (string or null), highlightNodeIds, unhighlightNodeIds, rootId (string or null), addNodes, updateNodes shaped as { id, value?, children? }, and removeNodeIds. Use {} when a step changes no tree visualization fields. Keep node ids stable, make every reference valid in the resulting tree, and include structural fields only when they actually change.
         For graph algorithms, use a compact base-and-delta trace with no root concept. The first graph step's visualState MUST contain graphBase with nodes shaped as { id, value }, edges shaped as { id, source, target, weight }, and directed, plus graphDelta. Every later graph step MUST contain only graphDelta and MUST NOT repeat graphBase or a full graph snapshot. A graphDelta may use activeNodeId or activeEdgeId (string or null), visitNodeIds, unvisitNodeIds, traverseEdgeIds, untraverseEdgeIds, addNodes, removeNodeIds, addEdges, and removeEdgeIds. Most BFS, DFS, and path-finding steps should include only newly visited nodes, newly traversed edges, and active ids. Use structural fields only when the algorithm actually mutates the graph, and use {} when nothing changes visually. Keep node and edge ids stable and make every reference valid in the resulting graph. Cycles and disconnected components are valid graph structures.
         For dynamic programming algorithms, use a compact base-and-delta trace. The first DP table step's visualState MUST contain dpTableBase with rows, columns, optional initialCells shaped as { row, column, value }, and optional rowLabels and columnLabels, plus dpTableDelta. Every later DP table step MUST contain only dpTableDelta and MUST NOT repeat dpTableBase or a full values matrix. A dpTableDelta may use updates shaped as { row, column, value }, activeCell as { row, column } or null, and highlightedCells as an array of { row, column }. List only cells changed during that step, even when a step changes a full row, column, or diagonal. Do not repeat previously filled cells. Use {} when nothing changes visually, and keep every cell coordinate within the base dimensions.
         For linked-list algorithms and pointer traversal or manipulation over a linked list, use a compact base-and-delta trace. The first linked-list step's visualState MUST contain linkedListBase with nodes shaped as { id, value, nextId } and headId, plus linkedListDelta. Every later linked-list step MUST contain only linkedListDelta and MUST NOT repeat linkedListBase or a full linkedList snapshot. A linkedListDelta may use nextUpdates shaped as { id, nextId }, headId (string or null), activeNodeId (string or null), and highlightedNodeIds. Every nextId MUST be an existing stable node id or null. Keep headId synchronized with the CURRENT structure, use null explicitly for null-terminated tails, and make each visualization state match that step's explanation after its described operations. For reversal, removal, and merge algorithms, most structural steps should include the actual pointer change in nextUpdates; this is expected and MUST NOT be omitted merely to make the trace smaller. Represent a cycle by pointing nextId back to an existing node, never by duplicating nodes. Use {} only when nothing changes visually. Use another visualization type when a linked list is not the algorithm's meaningful state.
         Return a JSON array of step objects only. Do not generate fake or placeholder steps.
        `;

    const response = await this.ai.models.generateContent({
      model: options?.model || getDefaultModelNames().gemini,
      contents: prompt,
      config: {
        abortSignal: options?.signal,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              line: { type: Type.NUMBER },
              explanation: { type: Type.STRING },
              operationType: {
                type: Type.STRING,
                enum: [
                  'init', 'compare', 'move-pointer', 'swap', 'insert-map', 'lookup-map',
                  'push-stack', 'pop-stack', 'enqueue', 'dequeue', 'visit-node', 'update-dp',
                  'recurse-call', 'recurse-return', 'window-expand', 'window-shrink', 'return',
                  'found', 'assign'
                ]
              },
              variables: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } },
              visualState: {
                type: Type.OBJECT,
                properties: {
                  array: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  map: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } },
                  stack: { type: Type.ARRAY, items: { type: Type.STRING } },
                  queue: { type: Type.ARRAY, items: { type: Type.STRING } },
                  treeBase: {
                    type: Type.OBJECT,
                    properties: {
                      nodes: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            value: { type: Type.STRING },
                            children: { type: Type.ARRAY, items: { type: Type.STRING } }
                          }
                        }
                      },
                      rootId: { type: Type.STRING }
                    }
                  },
                  treeDelta: {
                    type: Type.OBJECT,
                    properties: {
                      activeNodeId: { type: Type.STRING, nullable: true },
                      highlightNodeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                      unhighlightNodeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                      rootId: { type: Type.STRING, nullable: true },
                      addNodes: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            value: { type: Type.STRING },
                            children: { type: Type.ARRAY, items: { type: Type.STRING } }
                          }
                        }
                      },
                      updateNodes: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            value: { type: Type.STRING },
                            children: { type: Type.ARRAY, items: { type: Type.STRING } }
                          }
                        }
                      },
                      removeNodeIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                  },
                  graphBase: {
                    type: Type.OBJECT,
                    properties: {
                      nodes: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            value: { type: Type.STRING }
                          }
                        }
                      },
                      edges: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            source: { type: Type.STRING },
                            target: { type: Type.STRING },
                            weight: { type: Type.STRING }
                          }
                        }
                      },
                      directed: { type: Type.BOOLEAN }
                    }
                  },
                  graphDelta: {
                    type: Type.OBJECT,
                    properties: {
                      activeNodeId: { type: Type.STRING, nullable: true },
                      activeEdgeId: { type: Type.STRING, nullable: true },
                      visitNodeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                      unvisitNodeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                      traverseEdgeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                      untraverseEdgeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                      addNodes: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            value: { type: Type.STRING }
                          }
                        }
                      },
                      removeNodeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                      addEdges: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            source: { type: Type.STRING },
                            target: { type: Type.STRING },
                            weight: { type: Type.STRING }
                          }
                        }
                      },
                      removeEdgeIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                  },
                  dpTableBase: {
                    type: Type.OBJECT,
                    properties: {
                      rows: { type: Type.INTEGER },
                      columns: { type: Type.INTEGER },
                      initialCells: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            row: { type: Type.INTEGER },
                            column: { type: Type.INTEGER },
                            value: { type: Type.STRING }
                          }
                        }
                      },
                      rowLabels: { type: Type.ARRAY, items: { type: Type.STRING } },
                      columnLabels: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                  },
                  dpTableDelta: {
                    type: Type.OBJECT,
                    properties: {
                      updates: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            row: { type: Type.INTEGER },
                            column: { type: Type.INTEGER },
                            value: { type: Type.STRING }
                          }
                        }
                      },
                      activeCell: {
                        type: Type.OBJECT,
                        nullable: true,
                        properties: {
                          row: { type: Type.INTEGER },
                          column: { type: Type.INTEGER }
                        }
                      },
                      highlightedCells: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            row: { type: Type.INTEGER },
                            column: { type: Type.INTEGER }
                          }
                        }
                      }
                    }
                  },
                  linkedListBase: {
                    type: Type.OBJECT,
                    properties: {
                      nodes: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            value: { type: Type.STRING },
                            nextId: { type: Type.STRING, nullable: true }
                          }
                        }
                      },
                      headId: { type: Type.STRING, nullable: true }
                    }
                  },
                  linkedListDelta: {
                    type: Type.OBJECT,
                    properties: {
                      nextUpdates: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            nextId: { type: Type.STRING, nullable: true }
                          }
                        }
                      },
                      headId: { type: Type.STRING, nullable: true },
                      activeNodeId: { type: Type.STRING, nullable: true },
                      highlightedNodeIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                  },
                  indices: { type: Type.OBJECT, additionalProperties: { type: Type.INTEGER } },
                  highlights: { type: Type.ARRAY, items: { type: Type.INTEGER } }
                }
              }
            }
          }
        }
      }
    });

    return { data: JSON.parse(response.text || '[]'), raw: response, usage: geminiUsage(response) };
  }

  async generateSolution(problem: StructuredProblem, approach: ApproachOption, options?: AIRequestOptions): Promise<AIResponse<GeneratedSolution>> {
    try {
      const language = options?.solutionLanguage || DEFAULT_SOLUTION_LANGUAGE;
      const response = await this.ai.models.generateContent({
        model: options?.model || getDefaultModelNames().gemini,
        contents: `${buildSolutionInstructions(language)}\n\n${buildSolutionRequest(problem, approach, language)}`,
        config: {
          abortSignal: options?.signal,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING },
              language: { type: Type.STRING, enum: [language] }
            },
            required: ['code', 'language']
          }
        }
      });

      const finishReason = (response as any)?.candidates?.[0]?.finishReason;
      if (finishReason === 'MAX_TOKENS') {
        const error: any = new Error('Gemini solution response was truncated after reaching the model output-token limit.');
        error.name = 'ProviderTruncationError';
        throw error;
      }

      return { data: JSON.parse(response.text || '{}'), raw: response, usage: geminiUsage(response) };
    } catch (error: any) {
      if (options?.signal?.aborted || error?.name === 'AbortError' || error?.name === 'ProviderTruncationError') {
        throw error;
      }
      const providerError: any = new Error(`Gemini solution generation failed. API error: ${error?.message || 'Unknown provider error'}`);
      providerError.name = 'ProviderAPIError';
      throw providerError;
    }
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
      model: options?.model || getDefaultModelNames().gemini,
      contents: prompt,
      config: {
        abortSignal: options?.signal
      }
    });

    return {
      data: {
        content: response.text || "I'm having trouble thinking today. Try again?",
        isError: false
      },
      raw: response,
      usage: geminiUsage(response)
    };
  }
}
