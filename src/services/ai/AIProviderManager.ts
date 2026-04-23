import { AIProvider, AIProviderID, AIRequestOptions, AIProviderSettings, AIResponse } from './types';
import { GeminiProvider } from './providers/GeminiProvider';
import { OpenAIProvider, ClaudeProvider } from './providers/AlternativeProviders';

export class AIProviderManager {
  private providers: Map<AIProviderID, AIProvider> = new Map();
  private settings: AIProviderSettings;

  constructor(settings: AIProviderSettings) {
    this.settings = settings;
    this.providers.set('gemini', new GeminiProvider());
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('claude', new ClaudeProvider());
  }

  updateSettings(settings: AIProviderSettings) {
    this.settings = settings;
  }

  private getProvider(options?: AIRequestOptions): AIProvider {
    const taskId = options?.task;
    const requestedProviderId = options?.provider || 
                              (taskId && this.settings.taskRouting?.[taskId]) || 
                              this.settings.defaultProvider;

    const provider = this.providers.get(requestedProviderId);
    if (!provider) {
      // Fallback logic
      const fallbackId = this.settings.fallbackProvider || 'gemini';
      return this.providers.get(fallbackId)!;
    }
    return provider;
  }

  private getProviderId(options?: AIRequestOptions): AIProviderID {
    const taskId = options?.task;
    return options?.provider ||
      (taskId && this.settings.taskRouting?.[taskId]) ||
      this.settings.defaultProvider;
  }

  private isProviderUnavailable(providerId: AIProviderID): boolean {
    if (providerId === 'openai' || providerId === 'claude') return true;
    if (providerId === 'gemini') return !process.env.GEMINI_API_KEY;
    return true;
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
    return this.executeWithRetry((provider) => provider.parseProblem(input, options), options);
  }

  async evaluateReasoning(problem: any, reasoning: string, options?: AIRequestOptions) {
    return this.executeWithRetry((provider) => provider.evaluateReasoning(problem, reasoning, options), options);
  }

  async generateHints(problem: any, userCode: string, options?: AIRequestOptions) {
    return this.executeWithRetry((provider) => provider.generateHints(problem, userCode, options), options);
  }

  async explainCode(problem: any, code: string, options?: AIRequestOptions) {
    return this.executeWithRetry((provider) => provider.explainCode(problem, code, options), options);
  }

  async generateSteps(problem: any, code: string, testCase: any, options?: AIRequestOptions) {
     return this.executeWithRetry((provider) => provider.generateSteps(problem, code, testCase, options), options);
  }

  async coachMessage(problem: any, userMessage: string, chatHistory: Array<{ role: 'user' | 'ai'; content: string }>, userReasoning?: string, options?: AIRequestOptions) {
    return this.executeWithRetry((provider) => provider.coachMessage(problem, userMessage, chatHistory, userReasoning, options), options);
  }

  private async executeWithRetry<T>(
    task: (provider: AIProvider) => Promise<AIResponse<T>>,
    options?: AIRequestOptions,
    retries: number = 1
  ): Promise<AIResponse<T>> {
    const primaryId = this.getProviderId(options);
    const chain = this.getFallbackChain(primaryId);
    let lastError: any = null;

    for (const providerId of chain) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;

      if (this.isProviderUnavailable(providerId)) {
        lastError = new Error(`${providerId} provider is unavailable`);
        continue;
      }

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const response = await task(provider);
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
          if (attempt < retries) {
            console.warn(`AI Provider (${provider.id}) execution failed, retrying...`, error);
          }
        }
      }

      console.warn(`AI Provider (${provider.id}) unavailable after retry; checking fallback.`, lastError);
    }

    const message = this.getFriendlyProviderFailure(primaryId, lastError);
    const error: any = new Error(message);
    error.provider = primaryId;
    error.status = 'unavailable';
    throw error;
  }

  private getFriendlyProviderFailure(providerId: AIProviderID, error: any): string {
    const raw = String(error?.message || '').toLowerCase();
    if (raw.includes('api key') || raw.includes('401') || raw.includes('403') || raw.includes('unavailable')) {
      return `${providerId} provider is unavailable. Check the API key or switch to an available provider.`;
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
      defaultProvider: 'gemini',
      modelNames: {
        gemini: 'gemini-3-flash-preview',
        openai: 'gpt-4o',
        claude: 'claude-3-5-sonnet-latest'
      },
      fallbackProvider: 'gemini',
      taskRouting: {}
    };
    managerInstance = new AIProviderManager(defaultSettings);
  } else if (settings) {
    managerInstance.updateSettings(settings);
  }
  return managerInstance;
};
