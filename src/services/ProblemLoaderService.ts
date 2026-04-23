import { StructuredProblem, ProblemSource } from '../types';
import { getAIManager } from './ai/AIProviderManager';

export class ProblemLoaderService {
  private static latestParseRequest = 0;
  private static readonly LOW_CONFIDENCE_THRESHOLD = 0.55;
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

    const { data, meta } = await aiManager.parseProblem(text, { task: 'parse', signal });

    // If another parse started after this one, treat this result as stale.
    if (reqId !== ProblemLoaderService.latestParseRequest) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    const source: ProblemSource = metadata?.source || (text.startsWith('http') ? 'leetcode-link' : 'pasted-text');
    const confidence = ProblemLoaderService.getParseConfidence(data);

    if (!data?.title || !data?.statement || !Array.isArray(data.examples) || data.examples.length === 0) {
      const err: any = new Error('Parsing failed: missing required problem details');
      err.confidence = confidence;
      throw err;
    }

    if (confidence < ProblemLoaderService.LOW_CONFIDENCE_THRESHOLD || data.requiresUserConfirmation) {
      const err: any = new Error('Low confidence parsing result');
      err.confidence = confidence;
      throw err;
    }

    const parsedProblem = {
      ...data,
      slug: metadata?.slug,
      source,
      parsingConfidence: confidence,
      __providerMeta: meta
    } as StructuredProblem & { __providerMeta?: typeof meta };

    return parsedProblem;
  }

  private static getParseConfidence(problem: Partial<StructuredProblem>): number {
    const rawConfidence = typeof problem.parsingConfidence === 'number' ? problem.parsingConfidence : 0;
    const structuralSignals = [
      Boolean(problem.title),
      Boolean(problem.statement && problem.statement.length > 40),
      Boolean(problem.examples?.length),
      Boolean(problem.constraints?.length),
      Boolean(problem.approaches?.length)
    ];
    const structureScore = structuralSignals.filter(Boolean).length / structuralSignals.length;
    return Math.max(0, Math.min(1, rawConfidence || structureScore));
  }
}
