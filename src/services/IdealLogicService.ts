import { ApproachOption, ExecutionStep, StructuredProblem } from '../types';
import { DynamicStepGenerator } from './DynamicStepGenerator';

export interface IdealVisualizationResult {
  code: string;
  steps: ExecutionStep[];
  reusedCode: boolean;
}

export type IdealGenerationPhase = 'solution' | 'trace';

export const generateIdealVisualization = async (
  problem: StructuredProblem,
  approach: ApproachOption,
  cachedCode: string | undefined,
  testCase: { input: string; output: string },
  signal?: AbortSignal,
  onPhaseChange?: (phase: IdealGenerationPhase) => void
): Promise<IdealVisualizationResult> => {
  if (!cachedCode) onPhaseChange?.('solution');
  const code = cachedCode || (await DynamicStepGenerator.generateSolution(problem, approach, signal)).code;
  onPhaseChange?.('trace');
  const steps = await DynamicStepGenerator.generate(problem, approach, code, testCase, signal);
  return { code, steps, reusedCode: Boolean(cachedCode) };
};
