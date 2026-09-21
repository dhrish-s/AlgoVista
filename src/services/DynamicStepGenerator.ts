import { StructuredProblem, ExecutionStep, ApproachOption } from '../types';
import { getAIManager } from './ai/AIProviderManager';
import { validateExecutionSteps } from './ExecutionStepValidator';
import { SolutionLanguage } from './ai/types';
import { DEFAULT_SOLUTION_LANGUAGE } from './ai/solutionLanguages';

export interface GeneratedExecutionSteps extends Array<ExecutionStep> {
  generationFeedback?: {
    truncated: boolean;
    rejectedStepCount: number;
    message?: string;
  };
  providerMeta?: {
    provider: string;
    status: string;
    message?: string;
  };
}

export interface GeneratedIdealSolution {
  code: string;
  providerMeta?: GeneratedExecutionSteps['providerMeta'];
}

export class DynamicStepGenerator {
  private static latestRequestMap: Record<string, number> = {};

  static async generateSolution(
    problem: StructuredProblem,
    approach: ApproachOption,
    language: SolutionLanguage = DEFAULT_SOLUTION_LANGUAGE,
    signal?: AbortSignal
  ): Promise<GeneratedIdealSolution> {
    const aiManager = getAIManager();
    if (!aiManager) throw new Error('AI Manager not initialized.');

    const key = `${problem.id}:${approach.id}:${language}:generateSolution`;
    DynamicStepGenerator.latestRequestMap[key] = (DynamicStepGenerator.latestRequestMap[key] || 0) + 1;
    const reqId = DynamicStepGenerator.latestRequestMap[key];
    const { data, meta } = await aiManager.generateSolution(problem, approach, {
      task: 'steps',
      signal,
      solutionLanguage: language
    });

    if (DynamicStepGenerator.latestRequestMap[key] !== reqId || signal?.aborted) {
      const error: any = new Error('AbortError');
      error.name = 'AbortError';
      throw error;
    }

    return { code: data.code, providerMeta: meta };
  }

  static async generate(
    problem: StructuredProblem,
    approach: ApproachOption,
    solutionCode: string,
    testCase: { input: string; output: string },
    language: SolutionLanguage = DEFAULT_SOLUTION_LANGUAGE,
    signal?: AbortSignal
  ): Promise<ExecutionStep[]> {
    const aiManager = getAIManager();
    if (!aiManager) throw new Error("AI Manager not initialized.");

    const key = `${problem.id}:generate`;
    DynamicStepGenerator.latestRequestMap[key] = (DynamicStepGenerator.latestRequestMap[key] || 0) + 1;
    const reqId = DynamicStepGenerator.latestRequestMap[key];

    if (signal?.aborted) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    const sourceLineCount = solutionCode.split(/\r?\n/).length;
    const { data: rawSteps, meta } = await aiManager.generateSteps(problem, solutionCode, testCase, {
      task: 'steps',
      signal,
      sourceLineCount,
      solutionLanguage: language
    });

    // Ignore if a newer request started
    if (DynamicStepGenerator.latestRequestMap[key] !== reqId) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    // Validate and sanitize returned steps
    const validation = validateExecutionSteps(rawSteps, { sourceLineCount });
    if (!validation.valid) {
      throw new Error(`Invalid step trace: ${validation.error}`);
    }

    if (validation.isTruncated) {
      console.warn(`Step trace truncated: ${validation.error}`);
    }

    const steps = validation.steps as GeneratedExecutionSteps;
    steps.generationFeedback = {
      truncated: validation.isTruncated,
      rejectedStepCount: validation.rejectedStepCount,
      message: [validation.error, validation.warning].filter(Boolean).join(' ') || undefined
    };
    steps.providerMeta = meta;
    return steps;
  }

  static async generateFromUserCode(
    problem: StructuredProblem,
    userCode: string,
    testCase: { input: string; output: string },
    language: SolutionLanguage = DEFAULT_SOLUTION_LANGUAGE,
    signal?: AbortSignal
  ): Promise<ExecutionStep[]> {
    const aiManager = getAIManager();
    if (!aiManager) throw new Error("AI Manager not initialized.");

    const key = `${problem.id}:${language}:generateFromUserCode`;
    DynamicStepGenerator.latestRequestMap[key] = (DynamicStepGenerator.latestRequestMap[key] || 0) + 1;
    const reqId = DynamicStepGenerator.latestRequestMap[key];

    if (signal?.aborted) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    const sourceLineCount = userCode.split(/\r?\n/).length;
    const { data: rawSteps, meta } = await aiManager.generateSteps(problem, userCode, testCase, {
      task: 'steps',
      signal,
      sourceLineCount,
      solutionLanguage: language
    });

    if (DynamicStepGenerator.latestRequestMap[key] !== reqId) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    // Validate and sanitize returned steps
    const validation = validateExecutionSteps(rawSteps, { sourceLineCount });
    if (!validation.valid) {
      throw new Error(`Invalid step trace: ${validation.error}`);
    }

    if (validation.isTruncated) {
      console.warn(`Step trace truncated: ${validation.error}`);
    }

    const steps = validation.steps as GeneratedExecutionSteps;
    steps.generationFeedback = {
      truncated: validation.isTruncated,
      rejectedStepCount: validation.rejectedStepCount,
      message: [validation.error, validation.warning].filter(Boolean).join(' ') || undefined
    };
    steps.providerMeta = meta;
    return steps;
  }
}
