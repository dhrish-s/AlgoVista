import {
  AIProvider,
  AIProviderID,
  AIResponse,
  ReasoningEvaluation,
  HintGeneration,
  CodeExplanation,
  CoachMessage,
  AIRequestOptions
} from '../types';
import { GeneratedSolution } from '../types';
import { StructuredProblem, ExecutionStep, ApproachOption } from '../../../types';
import {
  assertProviderAvailable,
  extractJson,
  getProviderApiKey,
  normalizeProblem,
  normalizeSteps,
  unsupportedCodeExplanation,
  unsupportedHints,
  unsupportedReasoning
} from '../providerConfig';

const PARSE_INSTRUCTIONS = `Parse this LeetCode-style problem into JSON.
Return only JSON with: title, difficulty, statement, examples, constraints, starterCode, approaches, inferredPatterns, parsingConfidence, requiresUserConfirmation.
parsingConfidence must be 0 to 1. Set requiresUserConfirmation true when the prompt is sparse or inferred.
Create at least two approaches when enough information is available.
For every approach include:
- name (string)
- explanation (string)
- complexity: { time: "O(...)", space: "O(...)" }
- isOptimal (boolean)
Do not omit complexity.time or complexity.space.`;

const STEP_INSTRUCTIONS = `Return only a JSON array of execution steps.
Every step must include: id string, line number, explanation string, operationType string, variables object, visualState object.
operationType must be one of: init, compare, move-pointer, swap, insert-map, lookup-map, push-stack, pop-stack, enqueue, dequeue, visit-node, update-dp, recurse-call, recurse-return, window-expand, window-shrink, return, found, assign.
For array algorithms, visualState must use array for values, indices for named numeric pointers, and highlights for numeric indices.
For hash-based algorithms, visualState must use map as an object of key-value pairs.
For stack algorithms, visualState must use stack as an array ordered from bottom to top.
For queue algorithms, visualState must use queue as an array ordered from front to back.
For tree algorithms, use a compact base-and-delta trace. The first tree step's visualState must contain treeBase with nodes shaped as { id, value, children } and rootId, plus treeDelta. Every later tree step must contain only treeDelta and must not repeat treeBase or a full tree snapshot. A treeDelta may use activeNodeId (string or null), highlightNodeIds, unhighlightNodeIds, rootId (string or null), addNodes, updateNodes shaped as { id, value?, children? }, and removeNodeIds. Use {} when a step changes no tree visualization fields. Keep node ids stable, make every reference valid in the resulting tree, and include structural fields only when they actually change.
For graph algorithms, use a compact base-and-delta trace with no root concept. The first graph step's visualState must contain graphBase with nodes shaped as { id, value }, edges shaped as { id, source, target, weight }, and directed, plus graphDelta. Every later graph step must contain only graphDelta and must not repeat graphBase or a full graph snapshot. A graphDelta may use activeNodeId or activeEdgeId (string or null), visitNodeIds, unvisitNodeIds, traverseEdgeIds, untraverseEdgeIds, addNodes, removeNodeIds, addEdges, and removeEdgeIds. Most BFS, DFS, and path-finding steps should include only newly visited nodes, newly traversed edges, and active ids. Use structural fields only when the algorithm actually mutates the graph, and use {} when nothing changes visually. Keep node and edge ids stable and make every reference valid in the resulting graph. Cycles and disconnected components are valid graph structures.
For dynamic programming algorithms, use a compact base-and-delta trace. The first DP table step's visualState must contain dpTableBase with rows, columns, optional initialCells shaped as { row, column, value }, and optional rowLabels and columnLabels, plus dpTableDelta. Every later DP table step must contain only dpTableDelta and must not repeat dpTableBase or a full values matrix. A dpTableDelta may use updates shaped as { row, column, value }, activeCell as { row, column } or null, and highlightedCells as an array of { row, column }. List only cells changed during that step, even when a step changes a full row, column, or diagonal. Do not repeat previously filled cells. Use {} when nothing changes visually, and keep every cell coordinate within the base dimensions.
For linked-list algorithms and pointer traversal or manipulation over a linked list, use a compact base-and-delta trace. The first linked-list step's visualState must contain linkedListBase with nodes shaped as { id, value, nextId } and headId, plus linkedListDelta. Every later linked-list step must contain only linkedListDelta and must not repeat linkedListBase or a full linkedList snapshot. A linkedListDelta may use nextUpdates shaped as { id, nextId }, headId (string or null), activeNodeId (string or null), and highlightedNodeIds. Every nextId must be an existing stable node id or null. Keep headId synchronized with the current structure, use null explicitly for null-terminated tails, and make each visualization state match that step's explanation after its described operations. For reversal, removal, and merge algorithms, most structural steps should include the actual pointer change in nextUpdates; this is expected and must not be omitted merely to make the trace smaller. Represent a cycle by pointing nextId back to an existing node, never by duplicating nodes. Use {} only when nothing changes visually. Use another visualization type when a linked list is not the algorithm's meaningful state.
Use no more than 50 logical steps. Do not include markdown.`;

const COACH_INSTRUCTIONS = `You are AlgoVista's reasoning coach.
Never provide direct code. Ask concise Socratic questions and give minimal hints focused on pattern recognition, constraints, edge cases, and complexity.`;

const CLAUDE_DEFAULT_MAX_TOKENS = 4096;
const CLAUDE_STEP_MAX_TOKENS = 16384;

const asAbortError = () => {
  const err: any = new Error('Request was cancelled');
  err.name = 'AbortError';
  return err;
};

const extractApiErrorMessage = (bodyText: string): string => {
  try {
    const body = JSON.parse(bodyText);
    const message = body?.error?.message ?? body?.message;
    return typeof message === 'string' ? message.trim() : '';
  } catch {
    return '';
  }
};

const asProviderApiError = (fallbackMessage: string, status: number, bodyText: string) => {
  const detail = extractApiErrorMessage(bodyText);
  const err: any = new Error(detail ? `${fallbackMessage} API error: ${detail}` : fallbackMessage);
  err.name = 'ProviderAPIError';
  err.status = status;
  return err;
};

const asProviderTruncationError = (providerName: string, maxTokens: number) => {
  const err: any = new Error(
    `${providerName} response was truncated after reaching the ${maxTokens.toLocaleString()}-token output limit. Try again with a smaller trace.`
  );
  err.name = 'ProviderTruncationError';
  return err;
};

const safeUnsupported = <T>(providerId: AIProviderID, data: T): AIResponse<T> => ({
  data,
  meta: {
    provider: providerId,
    status: 'unavailable',
    message: `${providerId} does not support this action yet.`
  }
});

export class OpenAIProvider implements AIProvider {
  id: AIProviderID = 'openai';

  private async requestText(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, options?: AIRequestOptions): Promise<any> {
    assertProviderAvailable(this.id);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getProviderApiKey(this.id)}`
      },
      body: JSON.stringify({
        model: options?.model || 'gpt-4o-mini',
        messages
      })
    });

    if (options?.signal?.aborted) throw asAbortError();
    if (!response.ok) {
      const bodyText = await response.text();
      throw asProviderApiError(this.safeHttpError(response.status), response.status, bodyText);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('OpenAI returned an empty response.');
    }

    return { content, raw: json };
  }

  async parseProblem(input: string, options?: AIRequestOptions): Promise<AIResponse<StructuredProblem>> {
    const { content, raw } = await this.requestText([
      { role: 'system', content: PARSE_INSTRUCTIONS },
      { role: 'user', content: input }
    ], options);

    return {
      data: normalizeProblem(extractJson<Partial<StructuredProblem>>(content, {})),
      raw
    };
  }

  async evaluateReasoning(): Promise<AIResponse<ReasoningEvaluation>> {
    return safeUnsupported(this.id, unsupportedReasoning());
  }

  async generateHints(): Promise<AIResponse<HintGeneration>> {
    return safeUnsupported(this.id, unsupportedHints());
  }

  async explainCode(): Promise<AIResponse<CodeExplanation>> {
    return safeUnsupported(this.id, unsupportedCodeExplanation());
  }

  async generateSteps(problem: StructuredProblem, code: string, testCase: any, options?: AIRequestOptions): Promise<AIResponse<ExecutionStep[]>> {
    const { content, raw } = await this.requestText([
      { role: 'system', content: STEP_INSTRUCTIONS },
      {
        role: 'user',
        content: `Problem: ${problem.title}
Statement: ${problem.statement}
Input: ${JSON.stringify(testCase?.input)}
Expected output: ${JSON.stringify(testCase?.output)}
Approach or user code:
${code}`
      }
    ], options);

    return {
      data: normalizeSteps(extractJson<ExecutionStep[]>(content, [])),
      raw
    };
  }

  async generateSolution(_problem: StructuredProblem, _approach: ApproachOption, _options?: AIRequestOptions): Promise<AIResponse<GeneratedSolution>> {
    throw new Error('OpenAI solution generation is not implemented yet.');
  }

  async coachMessage(
    problem: StructuredProblem,
    userMessage: string,
    chatHistory: Array<{ role: 'user' | 'ai'; content: string }>,
    userReasoning?: string,
    options?: AIRequestOptions
  ): Promise<AIResponse<CoachMessage>> {
    const history = chatHistory.slice(-8).map((message) => ({
      role: message.role === 'user' ? 'user' as const : 'assistant' as const,
      content: message.content
    }));

    const { content, raw } = await this.requestText([
      { role: 'system', content: COACH_INSTRUCTIONS },
      ...history,
      {
        role: 'user',
        content: `Problem: ${problem.title}
Difficulty: ${problem.difficulty || 'Unknown'}
${userReasoning ? `Current reasoning: ${userReasoning}` : ''}
New user message: ${userMessage}`
      }
    ], options);

    return {
      data: { content, isError: false },
      raw
    };
  }

  private safeHttpError(status: number): string {
    if (status === 401 || status === 403) return 'OpenAI authentication failed. Check the API key.';
    if (status === 429) return 'OpenAI rate limit reached. Try again later or use fallback.';
    if (status >= 500) return 'OpenAI service is temporarily unavailable.';
    return 'OpenAI request failed.';
  }
}

export class ClaudeProvider implements AIProvider {
  id: AIProviderID = 'claude';

  private async requestText(
    system: string,
    userContent: string,
    options?: AIRequestOptions,
    maxTokens: number = CLAUDE_DEFAULT_MAX_TOKENS
  ): Promise<any> {
    assertProviderAvailable(this.id);
    const url = 'https://api.anthropic.com/v1/messages';
    const apiKey = getProviderApiKey(this.id);
    const model = options?.model || 'claude-sonnet-5';
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    const body = {
      model,
      max_tokens: maxTokens,
      system: system || undefined,
      messages: [{ role: 'user', content: userContent }]
    };

    console.debug('[ClaudeProvider] request', {
      keyPresent: Boolean(apiKey),
      model,
      url,
      method: 'POST',
      xApiKeyHeaderAttached: Boolean(headers['x-api-key'])
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: options?.signal,
        headers,
        body: JSON.stringify(body)
      });
    } catch (error: any) {
      if (options?.signal?.aborted || error.name === 'AbortError') throw asAbortError();
      console.debug('[ClaudeProvider] network error', {
        keyPresent: Boolean(apiKey),
        model,
        url,
        method: 'POST',
        xApiKeyHeaderAttached: Boolean(headers['x-api-key']),
        error: error?.message || 'Fetch failed'
      });
      throw new Error('Claude browser-direct request failed. A backend proxy may be required if the browser blocks direct Anthropic access.');
    }

    if (options?.signal?.aborted) throw asAbortError();
    const bodyText = await response.text();
    console.debug('[ClaudeProvider] response', {
      status: response.status,
      bodyText
    });

    if (!response.ok) {
      throw asProviderApiError(this.safeHttpError(response.status), response.status, bodyText);
    }

    const json = JSON.parse(bodyText);
    if (json?.stop_reason === 'max_tokens') {
      throw asProviderTruncationError('Claude', maxTokens);
    }
    const content = json?.content?.map((part: any) => part?.type === 'text' ? part.text : '').join('').trim();
    if (!content) {
      throw new Error('Claude returned an empty response.');
    }

    return { content, raw: json };
  }

  async parseProblem(input: string, options?: AIRequestOptions): Promise<AIResponse<StructuredProblem>> {
    const { content, raw } = await this.requestText(PARSE_INSTRUCTIONS, input, options);

    return {
      data: normalizeProblem(extractJson<Partial<StructuredProblem>>(content, {})),
      raw
    };
  }

  async evaluateReasoning(): Promise<AIResponse<ReasoningEvaluation>> {
    return safeUnsupported(this.id, unsupportedReasoning());
  }

  async generateHints(): Promise<AIResponse<HintGeneration>> {
    return safeUnsupported(this.id, unsupportedHints());
  }

  async explainCode(): Promise<AIResponse<CodeExplanation>> {
    return safeUnsupported(this.id, unsupportedCodeExplanation());
  }

  async generateSteps(problem: StructuredProblem, code: string, testCase: any, options?: AIRequestOptions): Promise<AIResponse<ExecutionStep[]>> {
    const { content, raw } = await this.requestText(
      STEP_INSTRUCTIONS,
      `Problem: ${problem.title}
Statement: ${problem.statement}
Input: ${JSON.stringify(testCase?.input)}
Expected output: ${JSON.stringify(testCase?.output)}
Approach or user code:
${code}`,
      options,
      CLAUDE_STEP_MAX_TOKENS
    );

    return {
      data: normalizeSteps(extractJson<ExecutionStep[]>(content, [])),
      raw
    };
  }

  async generateSolution(_problem: StructuredProblem, _approach: ApproachOption, _options?: AIRequestOptions): Promise<AIResponse<GeneratedSolution>> {
    throw new Error('Claude solution generation is not implemented yet.');
  }

  async coachMessage(
    problem: StructuredProblem,
    userMessage: string,
    chatHistory: Array<{ role: 'user' | 'ai'; content: string }>,
    userReasoning?: string,
    options?: AIRequestOptions
  ): Promise<AIResponse<CoachMessage>> {
    const historyText = chatHistory.slice(-8).map((message) => `${message.role === 'user' ? 'User' : 'Coach'}: ${message.content}`).join('\n');
    const { content, raw } = await this.requestText(
      COACH_INSTRUCTIONS,
      `Problem: ${problem.title}
Difficulty: ${problem.difficulty || 'Unknown'}
${userReasoning ? `Current reasoning: ${userReasoning}` : ''}
Chat history:
${historyText}

New user message: ${userMessage}`,
      options
    );

    return {
      data: { content, isError: false },
      raw
    };
  }

  private safeHttpError(status: number): string {
    if (status === 401 || status === 403) return 'Claude authentication failed. Check the API key.';
    if (status === 404) return 'Claude Messages API returned 404. The endpoint is correct; check browser-direct access, API key permissions, and the configured model.';
    if (status === 429) return 'Claude rate limit reached. Try again later or use fallback.';
    if (status >= 500) return 'Claude service is temporarily unavailable.';
    return 'Claude request failed.';
  }
}
