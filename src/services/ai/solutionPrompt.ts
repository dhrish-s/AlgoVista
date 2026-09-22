import { ApproachOption, StructuredProblem } from '../../types';
import { SolutionLanguage } from './types';
import { SOLUTION_LANGUAGE_METADATA } from './solutionLanguages';

export const buildSolutionInstructions = (language: SolutionLanguage): string => {
  const label = SOLUTION_LANGUAGE_METADATA[language].label;
  const languageGuidance = language === 'python'
    ? `
Use four-space indentation and conventional LeetCode-style Python signatures.
Use a top-level def or class Solution as appropriate for the supplied signature.
Do not compress multiple statements onto one line with semicolons.`
    : language === 'cpp'
      ? `
Use C++17 conventions and the standard library where appropriate.
Use a conventional class Solution with the expected public method signature.
Do not include an unnecessary main function.
Keep declarations and statements on stable separate lines for line-by-line tracing.`
      : language === 'java'
        ? `
Use a conventional class Solution with the expected method signature and explicit Java types.
Do not include an unnecessary runner or public static void main method.
Keep declarations and statements on stable separate lines for line-by-line tracing.`
        : language === 'c'
          ? `
Use C11-style functions with the expected explicit parameter and return types.
Represent data structures and memory handling explicitly, including allocation bounds and cleanup when dynamic memory is used.
Do not use C++ constructs such as classes, namespaces, templates, references, or STL containers.
Do not include an unnecessary main function.
Keep declarations and statements on stable separate lines for line-by-line tracing.`
      : '';
  return `Generate a complete ${label} solution for the supplied algorithm problem and selected approach.
Return only a JSON object shaped as { "code": string, "language": "${language}" }.
Preserve the supplied starter signature when it is compatible with ${label}.
Do not include tests, example invocations, explanations, Markdown fences, TODOs, or placeholder code.
Use stable formatting with one statement per line because a later execution trace will reference exact source line numbers.${languageGuidance}`;
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
