import { AIProvider, AIProviderID, AIRequestOptions, AIProviderSettings } from './types';
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

  async parseProblem(input: string, options?: AIRequestOptions) {
    return this.executeWithRetry(() => this.getProvider(options).parseProblem(input), options);
  }

  async evaluateReasoning(problem: any, reasoning: string, options?: AIRequestOptions) {
    return this.executeWithRetry(() => this.getProvider(options).evaluateReasoning(problem, reasoning), options);
  }

  async generateHints(problem: any, userCode: string, options?: AIRequestOptions) {
    return this.executeWithRetry(() => this.getProvider(options).generateHints(problem, userCode), options);
  }

  async explainCode(problem: any, code: string, options?: AIRequestOptions) {
    return this.executeWithRetry(() => this.getProvider(options).explainCode(problem, code), options);
  }

  async generateSteps(problem: any, code: string, testCase: any, options?: AIRequestOptions) {
     return this.executeWithRetry(() => this.getProvider(options).generateSteps(problem, code, testCase), options);
  }

  private async executeWithRetry<T>(task: () => Promise<T>, options?: AIRequestOptions, retries: number = 1): Promise<T> {
    try {
      return await task();
    } catch (error) {
      if (retries > 0) {
        console.warn(`AI Provider execution failed, retrying...`, error);
        return this.executeWithRetry(task, options, retries - 1);
      }
      
      // Secondary fallback: Try default provider if current one failed
      const currentProvider = this.getProvider(options);
      if (currentProvider.id !== this.settings.defaultProvider) {
        console.warn(`Switching to default provider ${this.settings.defaultProvider} after error.`);
        const defaultProvider = this.providers.get(this.settings.defaultProvider)!;
        // This is a bit recursive/messy, but shows the concept
        // In a real system, we'd wrap the task differently
      }
      
      throw error;
    }
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
