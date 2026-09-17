import { ApproachOption, ExecutionStep, StructuredProblem } from '../types';
import { DynamicStepGenerator } from './DynamicStepGenerator';
import { SolutionLanguage } from './ai/types';

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
  language: SolutionLanguage,
  signal?: AbortSignal,
  onPhaseChange?: (phase: IdealGenerationPhase) => void
): Promise<IdealVisualizationResult> => {
  if (!cachedCode) onPhaseChange?.('solution');
  const code = cachedCode || (await DynamicStepGenerator.generateSolution(problem, approach, language, signal)).code;
  onPhaseChange?.('trace');
  const steps = await DynamicStepGenerator.generate(problem, approach, code, testCase, signal);
  return { code, steps, reusedCode: Boolean(cachedCode) };
};
