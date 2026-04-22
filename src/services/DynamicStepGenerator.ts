import { StructuredProblem, ExecutionStep, ApproachOption } from '../types';
import { getAIManager } from './ai/AIProviderManager';

export class DynamicStepGenerator {
  static async generate(
    problem: StructuredProblem,
    approach: ApproachOption,
    testCase: { input: string; output: string },
    signal?: AbortSignal
  ): Promise<ExecutionStep[]> {
    const aiManager = getAIManager();
    if (!aiManager) throw new Error("AI Manager not initialized.");

    const { data } = await aiManager.generateSteps(problem, approach.explanation, testCase, { task: 'steps', signal });
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

    const { data } = await aiManager.generateSteps(problem, userCode, testCase, { task: 'steps', signal });
    return data;
  }
}
