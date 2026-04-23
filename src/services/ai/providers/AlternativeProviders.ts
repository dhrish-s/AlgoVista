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
import { StructuredProblem, ExecutionStep } from '../../../types';
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
Use no more than 50 logical steps. Do not include markdown.`;

const COACH_INSTRUCTIONS = `You are AlgoVista's reasoning coach.
Never provide direct code. Ask concise Socratic questions and give minimal hints focused on pattern recognition, constraints, edge cases, and complexity.`;

const asAbortError = () => {
  const err: any = new Error('Request was cancelled');
  err.name = 'AbortError';
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
        messages,
        temperature: 0.2
      })
    });

    if (options?.signal?.aborted) throw asAbortError();
    if (!response.ok) {
      throw new Error(this.safeHttpError(response.status));
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

  private async requestText(system: string, userContent: string, options?: AIRequestOptions): Promise<any> {
    assertProviderAvailable(this.id);
    const url = 'https://api.anthropic.com/v1/messages';
    const apiKey = getProviderApiKey(this.id);
    const model = options?.model || 'claude-sonnet-4-20250514';
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    const body = {
      model,
      max_tokens: 4096,
      temperature: 0.2,
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
      throw new Error(this.safeHttpError(response.status, bodyText));
    }

    const json = JSON.parse(bodyText);
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
      options
    );

    return {
      data: normalizeSteps(extractJson<ExecutionStep[]>(content, [])),
      raw
    };
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

  private safeHttpError(status: number, bodyText: string): string {
    if (status === 401 || status === 403) return 'Claude authentication failed. Check the API key.';
    if (status === 404) return `Claude Messages API returned 404. The endpoint is correct; check browser-direct access, API key permissions, and the configured model. Response body: ${bodyText}`;
    if (status === 429) return 'Claude rate limit reached. Try again later or use fallback.';
    if (status >= 500) return 'Claude service is temporarily unavailable.';
    return 'Claude request failed.';
  }
}
