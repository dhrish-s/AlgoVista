import { StructuredProblem, ExecutionStep, ApproachOption } from '../types';
import { getAIManager } from './ai/AIProviderManager';

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

    const { data } = await aiManager.generateSteps(problem, approach.explanation, testCase, { task: 'steps', signal });

    // Ignore if a newer request started
    if (DynamicStepGenerator.latestRequestMap[key] !== reqId) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    return data;
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

    const { data } = await aiManager.generateSteps(problem, userCode, testCase, { task: 'steps', signal });

    if (DynamicStepGenerator.latestRequestMap[key] !== reqId) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    return data;
  }
}
