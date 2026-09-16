import { ApproachOption, ExecutionStep, StructuredProblem } from '../types';
import { DynamicStepGenerator } from './DynamicStepGenerator';

export interface IdealVisualizationResult {
  code: string;
  steps: ExecutionStep[];
  reusedCode: boolean;
}

export const generateIdealVisualization = async (
  problem: StructuredProblem,
  approach: ApproachOption,
  cachedCode: string | undefined,
  testCase: { input: string; output: string },
  signal?: AbortSignal
): Promise<IdealVisualizationResult> => {
  const code = cachedCode || (await DynamicStepGenerator.generateSolution(problem, approach, signal)).code;
  const steps = await DynamicStepGenerator.generate(problem, approach, code, testCase, signal);
  return { code, steps, reusedCode: Boolean(cachedCode) };
};
