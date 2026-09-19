import { AIProvider, AIProviderID, AIRequestOperation, AIRequestOptions, AIProviderSettings, AIResponse } from './types';
import { GeminiProvider } from './providers/GeminiProvider';
import { OpenAIProvider, ClaudeProvider } from './providers/AlternativeProviders';
import { getDefaultFallbackProvider, getDefaultModelNames, getDefaultProvider, getProviderAvailability } from './providerConfig';
import { validateExecutionSteps } from '../ExecutionStepValidator';
import { validateGeneratedSolution } from '../GeneratedSolutionValidator';
import { DEFAULT_SOLUTION_LANGUAGE } from './solutionLanguages';

export const AI_OPERATION_TIMEOUT_MS: Record<AIRequestOperation, number> = {
  'problem-parsing': 45_000,
  'solution-generation': 45_000,
  'step-generation': 180_000,
  'small-helper': 30_000
};

// Future improvement: AIRequestOptions.onStream is currently unused. Real provider streaming
// would allow an inactivity timeout between tokens instead of one wall-clock deadline for the
// entire response. Keep these hard deadlines until every provider supports that consistently.

export class AIProviderManager {
  private providers: Map<AIProviderID, AIProvider> = new Map();
  private providerFactories: Record<AIProviderID, () => AIProvider>;
  private settings: AIProviderSettings;

  constructor(settings: AIProviderSettings) {
    this.settings = settings;
    this.providerFactories = {
      gemini: () => new GeminiProvider(),
      openai: () => new OpenAIProvider(),
      claude: () => new ClaudeProvider()
    };
  }

  updateSettings(settings: AIProviderSettings) {
    this.settings = settings;
  }

  private getProviderId(options?: AIRequestOptions): AIProviderID {
    const taskId = options?.task;
    return options?.provider ||
      (taskId && this.settings.taskRouting?.[taskId]) ||
      this.settings.defaultProvider;
  }

  private isProviderUnavailable(providerId: AIProviderID): boolean {
    return !getProviderAvailability(providerId).available;
  }

  private getOrCreateProvider(providerId: AIProviderID): AIProvider | null {
    const existing = this.providers.get(providerId);
    if (existing) return existing;

    const factory = this.providerFactories[providerId];
    if (!factory) return null;

    const provider = factory();
    this.providers.set(providerId, provider);
    return provider;
  }

  private getFallbackChain(primaryId: AIProviderID): AIProviderID[] {
    const ids = [
      primaryId,
      this.settings.fallbackProvider || 'gemini',
      this.settings.defaultProvider,
      'gemini' as AIProviderID
    ];
    return ids.filter((id, index) => ids.indexOf(id) === index);
  }

  async parseProblem(input: string, options?: AIRequestOptions) {
    return this.executeWithRetry(
      (provider, providerOptions) => provider.parseProblem(input, providerOptions),
      { ...options, operation: 'problem-parsing' }
    );
  }

  async evaluateReasoning(problem: any, reasoning: string, options?: AIRequestOptions) {
    return this.executeWithRetry(
      (provider, providerOptions) => provider.evaluateReasoning(problem, reasoning, providerOptions),
      { ...options, operation: 'small-helper' }
    );
  }

  async generateHints(problem: any, userCode: string, options?: AIRequestOptions) {
    return this.executeWithRetry(
      (provider, providerOptions) => provider.generateHints(problem, userCode, providerOptions),
      { ...options, operation: 'small-helper' }
    );
  }

  async explainCode(problem: any, code: string, options?: AIRequestOptions) {
    return this.executeWithRetry(
      (provider, providerOptions) => provider.explainCode(problem, code, providerOptions),
      { ...options, operation: 'small-helper' }
    );
  }

  async generateSolution(problem: any, approach: any, options?: AIRequestOptions) {
    const solutionLanguage = options?.solutionLanguage || DEFAULT_SOLUTION_LANGUAGE;
    return this.executeWithRetry(async (provider, providerOptions) => {
      const response = await provider.generateSolution(problem, approach, providerOptions);
      const validation = validateGeneratedSolution(response.data, solutionLanguage);
      if ('error' in validation) {
        throw new Error(`Invalid generated solution: ${validation.error}`);
      }
      return { ...response, data: validation.solution };
    }, { ...options, operation: 'solution-generation' });
  }

  async generateSteps(problem: any, code: string, testCase: any, options?: AIRequestOptions) {
    return this.executeWithRetry(async (provider, providerOptions) => {
      const response = await provider.generateSteps(problem, code, testCase, providerOptions);
      const validation = validateExecutionSteps(response.data, { sourceLineCount: options?.sourceLineCount });
      if (!validation.valid) {
        throw new Error(`Invalid step trace: ${validation.error}`);
      }
      return response;
    }, { ...options, operation: 'step-generation' });
  }

  async coachMessage(problem: any, userMessage: string, chatHistory: Array<{ role: 'user' | 'ai'; content: string }>, userReasoning?: string, options?: AIRequestOptions) {
    return this.executeWithRetry(
      (provider, providerOptions) => provider.coachMessage(problem, userMessage, chatHistory, userReasoning, providerOptions),
      { ...options, operation: 'small-helper' }
    );
  }

  private async executeWithRetry<T>(
    task: (provider: AIProvider, options: AIRequestOptions) => Promise<AIResponse<T>>,
    options?: AIRequestOptions,
    retries: number = 1
  ): Promise<AIResponse<T>> {
    const primaryId = this.getProviderId(options);
    const chain = this.getFallbackChain(primaryId);
    let lastError: any = null;
    let lastAttemptedProviderId: AIProviderID | null = null;

    for (const providerId of chain) {
      if (this.isProviderUnavailable(providerId)) {
        const availability = getProviderAvailability(providerId);
        if (!lastAttemptedProviderId) {
          lastError = new Error(`${providerId} provider is unavailable: ${availability.reason}`);
        }
        continue;
      }

      const provider = this.getOrCreateProvider(providerId);
      if (!provider) continue;

      for (let attempt = 0; attempt <= retries; attempt++) {
        lastAttemptedProviderId = providerId;
        try {
          const providerOptions: AIRequestOptions = {
            ...options,
            model: options?.model || this.settings.modelNames[provider.id]
          };
          const response = await this.executeProviderAttempt(
            task,
            provider,
            providerOptions,
            Math.max(
              1,
              options?.timeoutMs ?? AI_OPERATION_TIMEOUT_MS[options?.operation || 'small-helper']
            )
          );
          return {
            ...response,
            meta: {
              ...response.meta,
              provider: provider.id,
              status: provider.id === primaryId ? 'success' : 'fallback',
              fallbackFrom: provider.id === primaryId ? undefined : primaryId,
              message: provider.id === primaryId
                ? `${provider.id} responded successfully.`
                : `${primaryId} was unavailable or failed, so ${provider.id} handled the request.`
            }
          };
        } catch (error: any) {
          if (options?.signal?.aborted || error.name === 'AbortError') {
            const cancelError: any = new Error('Request was cancelled');
            cancelError.name = 'AbortError';
            throw cancelError;
          }

          lastError = error;
          if (error.name === 'TimeoutError') {
            break;
          }
          if (attempt < retries) {
            console.warn(`AI Provider (${provider.id}) execution failed, retrying...`, error);
          }
        }
      }

      console.warn(`AI Provider (${provider.id}) unavailable after retry; checking fallback.`, lastError);
    }

    const failedProviderId = lastAttemptedProviderId || primaryId;
    const message = this.getFriendlyProviderFailure(failedProviderId, lastError);
    const error: any = new Error(message);
    error.provider = failedProviderId;
    error.requestedProvider = primaryId;
    error.status = 'unavailable';
    throw error;
  }

  private async executeProviderAttempt<T>(
    task: (provider: AIProvider, options: AIRequestOptions) => Promise<AIResponse<T>>,
    provider: AIProvider,
    options: AIRequestOptions,
    timeoutMs: number
  ): Promise<AIResponse<T>> {
    const controller = new AbortController();
    const callerSignal = options.signal;

    if (callerSignal?.aborted) {
      const error: any = new Error('Request was cancelled');
      error.name = 'AbortError';
      throw error;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let handleCallerAbort: (() => void) | undefined;
    const interruption = new Promise<never>((_, reject) => {
      handleCallerAbort = () => {
        const error: any = new Error('Request was cancelled');
        error.name = 'AbortError';
        reject(error);
        controller.abort();
      };
      callerSignal?.addEventListener('abort', handleCallerAbort, { once: true });

      timeoutId = setTimeout(() => {
        const error: any = new Error(`Provider request timed out after ${timeoutMs} ms.`);
        error.name = 'TimeoutError';
        reject(error);
        controller.abort();
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        task(provider, { ...options, signal: controller.signal }),
        interruption
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (handleCallerAbort) callerSignal?.removeEventListener('abort', handleCallerAbort);
    }
  }

  private getFriendlyProviderFailure(providerId: AIProviderID, error: any): string {
    const raw = String(error?.message || '').toLowerCase();
    if (error?.name === 'ProviderAPIError') {
      return error.message;
    }
    if (error?.name === 'ProviderTruncationError') {
      return error.message;
    }
    if (raw.includes('timed out')) {
      return `${providerId} provider timed out before completing the request. Try again or switch providers.`;
    }
    if (raw.includes('api key') || raw.includes('401') || raw.includes('403') || raw.includes('unavailable')) {
      return `${providerId} provider is unavailable. Check the API key or switch to an available provider.`;
    }
    if (raw.includes('messages api returned 404')) {
      return 'Claude Messages API returned 404. The endpoint is correct, so check that browser-direct access is allowed and the configured Claude model is available for your key.';
    }
    if (raw.includes('browser-direct') || raw.includes('failed to fetch')) {
      return `${providerId} request could not complete from the browser. Use a backend proxy if direct browser access is blocked.`;
    }
    if (raw.includes('not implemented') || raw.includes('not yet configured')) {
      return `${providerId} provider is not ready yet. Gemini is the supported provider for this build.`;
    }
    return `${providerId} provider could not complete the request. Try again or switch providers.`;
  }
}

// Singleton instance
let managerInstance: AIProviderManager | null = null;

export const getAIManager = (settings?: AIProviderSettings) => {
  if (!managerInstance) {
    const defaultSettings: AIProviderSettings = settings || {
      defaultProvider: getDefaultProvider(),
      modelNames: getDefaultModelNames(),
      fallbackProvider: getDefaultFallbackProvider(),
      taskRouting: {}
    };
    managerInstance = new AIProviderManager(defaultSettings);
  } else if (settings) {
    managerInstance.updateSettings(settings);
  }
  return managerInstance;
};
