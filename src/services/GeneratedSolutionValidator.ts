import { GeneratedSolution } from './ai/types';

const MAX_SOLUTION_CHARACTERS = 30_000;
const MAX_SOLUTION_LINES = 500;
const PLACEHOLDER_PATTERN = /\b(?:TODO|FIXME|your code here|not implemented)\b/i;

export type GeneratedSolutionValidation =
  | { valid: true; solution: GeneratedSolution }
  | { valid: false; error: string };

export const validateGeneratedSolution = (value: unknown): GeneratedSolutionValidation => {
  if (!value || typeof value !== 'object') {
    return { valid: false, error: 'Generated solution is not an object.' };
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.language !== 'typescript') {
    return { valid: false, error: 'Generated solution language must be TypeScript.' };
  }

  if (typeof candidate.code !== 'string' || !candidate.code.trim()) {
    return { valid: false, error: 'Generated solution code is empty.' };
  }

  const code = candidate.code.trim();
  if (code.includes('```')) {
    return { valid: false, error: 'Generated solution code must not contain Markdown fences.' };
  }
  if (code.length > MAX_SOLUTION_CHARACTERS) {
    return { valid: false, error: `Generated solution exceeds ${MAX_SOLUTION_CHARACTERS} characters.` };
  }

  const lineCount = code.split(/\r?\n/).length;
  if (lineCount > MAX_SOLUTION_LINES) {
    return { valid: false, error: `Generated solution exceeds ${MAX_SOLUTION_LINES} lines.` };
  }
  if (PLACEHOLDER_PATTERN.test(code)) {
    return { valid: false, error: 'Generated solution contains placeholder text.' };
  }

  return {
    valid: true,
    solution: { code, language: 'typescript' }
  };
};
