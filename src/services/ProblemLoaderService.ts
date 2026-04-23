import { StructuredProblem, ProblemSource } from '../types';
import { getAIManager } from './ai/AIProviderManager';

export class ProblemLoaderService {
  private static latestParseRequest = 0;
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

    // Track request id so we can ignore stale responses.
    const reqId = ++ProblemLoaderService.latestParseRequest;

    if (signal?.aborted) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    const { data } = await aiManager.parseProblem(text, { task: 'parse', signal });

    // If another parse started after this one, treat this result as stale.
    if (reqId !== ProblemLoaderService.latestParseRequest) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    const source: ProblemSource = text.startsWith('http') ? 'leetcode-link' : 'pasted-text';
    return {
      ...data,
      source
    };
  }
}
