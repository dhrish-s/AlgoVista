import { ApproachOption, StructuredProblem } from '../../types';
import { SolutionLanguage } from './types';
import { SOLUTION_LANGUAGE_METADATA } from './solutionLanguages';

export const buildSolutionInstructions = (language: SolutionLanguage): string => {
  const label = SOLUTION_LANGUAGE_METADATA[language].label;
  return `Generate a complete ${label} solution for the supplied algorithm problem and selected approach.
Return only a JSON object shaped as { "code": string, "language": "${language}" }.
Preserve the supplied starter signature when it is compatible with ${label}.
Do not include tests, example invocations, explanations, Markdown fences, TODOs, or placeholder code.
Use stable formatting with one statement per line because a later execution trace will reference exact source line numbers.`;
};

export const buildSolutionRequest = (
  problem: StructuredProblem,
  approach: ApproachOption,
  language: SolutionLanguage
): string => `Problem: ${problem.title}
Statement: ${problem.statement}
Constraints: ${problem.constraints.join('\n')}
Selected approach: ${approach.name}
Approach details: ${approach.explanation}
Requested language: ${SOLUTION_LANGUAGE_METADATA[language].label}
Starter signature, when compatible with the requested language:
${problem.starterCode || 'No starter signature was provided.'}`;
