import { StructuredProblem, ProblemSource } from '../types';
import { getAIManager } from './ai/AIProviderManager';

export class ProblemLoaderService {
  static detectSource(input: string): ProblemSource {
    const trimmed = input.trim();
    if (trimmed.startsWith('http') && trimmed.includes('leetcode.com')) {
       return 'leetcode-link';
    }
    if (/^\d+$/.test(trimmed)) {
       return 'leetcode-number';
    }
    if (trimmed.length > 100 || (trimmed.includes('Example') && trimmed.includes('Input'))) {
       return 'pasted-text';
    }
    return 'mixed';
  }

  static parseLink(url: string): { slug: string; number?: string } {
    try {
      const path = new URL(url).pathname;
      const parts = path.split('/').filter(Boolean);
      const slug = parts[1] || '';
      return { slug };
    } catch {
      return { slug: '' };
    }
  }

  static async parseProblemText(text: string, metadata?: any, signal?: AbortSignal): Promise<StructuredProblem> {
    const aiManager = getAIManager();
    if (!aiManager) {
      throw new Error("AI Manager not initialized.");
    }

    const { data } = await aiManager.parseProblem(text, { task: 'parse', signal });
    const source: ProblemSource = text.startsWith('http') ? 'leetcode-link' : 'pasted-text';
    
    return {
      ...data,
      source
    };
  }
}
