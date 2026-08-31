import { StructuredProblem, ExecutionStep, ApproachOption } from '../types';
import { getAIManager } from './ai/AIProviderManager';
import { validateExecutionSteps } from './ExecutionStepValidator';

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

export class DynamicStepGenerator {
  private static latestRequestMap: Record<string, number> = {};

  static async generate(
    problem: StructuredProblem,
    approach: ApproachOption,
    testCase: { input: string; output: string },
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

    const { data: rawSteps, meta } = await aiManager.generateSteps(problem, approach.explanation, testCase, { task: 'steps', signal });

    // Ignore if a newer request started
    if (DynamicStepGenerator.latestRequestMap[key] !== reqId) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    // Validate and sanitize returned steps
    const validation = validateExecutionSteps(rawSteps);
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
    signal?: AbortSignal
  ): Promise<ExecutionStep[]> {
    const aiManager = getAIManager();
    if (!aiManager) throw new Error("AI Manager not initialized.");

    const key = `${problem.id}:generateFromUserCode`;
    DynamicStepGenerator.latestRequestMap[key] = (DynamicStepGenerator.latestRequestMap[key] || 0) + 1;
    const reqId = DynamicStepGenerator.latestRequestMap[key];

    if (signal?.aborted) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    const { data: rawSteps, meta } = await aiManager.generateSteps(problem, userCode, testCase, { task: 'steps', signal });

    if (DynamicStepGenerator.latestRequestMap[key] !== reqId) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    // Validate and sanitize returned steps
    const validation = validateExecutionSteps(rawSteps);
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
