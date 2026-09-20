import { GeneratedSolution, SolutionLanguage } from './ai/types';
import { DEFAULT_SOLUTION_LANGUAGE, SOLUTION_LANGUAGE_METADATA, SOLUTION_LANGUAGES } from './ai/solutionLanguages';

const MAX_SOLUTION_CHARACTERS = 30_000;
const MAX_SOLUTION_LINES = 500;
const PLACEHOLDER_PATTERN = /\b(?:TODO|FIXME|your code here|not implemented)\b/i;
const EXECUTABLE_CODE_PATTERNS: Record<SolutionLanguage, RegExp> = {
  typescript: /\b(?:function|class|const|let|interface)\b|=>/,
  python: /^\s*(?:def|class)\s+\w+/m,
  cpp: /\b(?:class|struct)\s+\w+|\b(?:bool|int|long|double|float|string|void|auto)\s+\w+\s*\(/,
  java: /\b(?:class|interface)\s+\w+|\b(?:public|private|protected|static)\b[^\n{;]*\w+\s*\(/,
  c: /\b(?:void|char|short|int|long|float|double|bool|size_t)\s+\**\s*\w+\s*\(/,
  ruby: /^\s*(?:def|class|module)\s+\w+/m
};
const INVALID_LANGUAGE_PATTERNS: Partial<Record<SolutionLanguage, RegExp>> = {
  cpp: /\bfunction\b|:\s*(?:string|boolean|number)\b|=>|^\s*def\s+\w+/m
};

export type GeneratedSolutionValidation =
  | { valid: true; solution: GeneratedSolution }
  | { valid: false; error: string };

export const validateGeneratedSolution = (
  value: unknown,
  expectedLanguage: SolutionLanguage = DEFAULT_SOLUTION_LANGUAGE
): GeneratedSolutionValidation => {
  if (!value || typeof value !== 'object') {
    return { valid: false, error: 'Generated solution is not an object.' };
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.language !== 'string' || !SOLUTION_LANGUAGES.includes(candidate.language as SolutionLanguage)) {
    return { valid: false, error: 'Generated solution language is unsupported.' };
  }
  if (candidate.language !== expectedLanguage) {
    return {
      valid: false,
      error: `Generated solution language must be ${SOLUTION_LANGUAGE_METADATA[expectedLanguage].label}.`
    };
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
  if (!EXECUTABLE_CODE_PATTERNS[expectedLanguage].test(code)) {
    return {
      valid: false,
      error: `Generated solution does not appear to contain executable ${SOLUTION_LANGUAGE_METADATA[expectedLanguage].label} code.`
    };
  }
  if (INVALID_LANGUAGE_PATTERNS[expectedLanguage]?.test(code)) {
    return {
      valid: false,
      error: `Generated solution contains syntax that is incompatible with ${SOLUTION_LANGUAGE_METADATA[expectedLanguage].label}.`
    };
  }

  return {
    valid: true,
    solution: { code, language: expectedLanguage }
  };
};
