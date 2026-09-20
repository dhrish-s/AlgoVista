import { SolutionLanguage } from './types';

export interface SolutionLanguageMetadata {
  label: string;
  monacoLanguage: string;
  fileExtension: string;
}

export const DEFAULT_SOLUTION_LANGUAGE: SolutionLanguage = 'typescript';

export const SOLUTION_LANGUAGE_METADATA: Record<SolutionLanguage, SolutionLanguageMetadata> = {
  typescript: { label: 'TypeScript', monacoLanguage: 'typescript', fileExtension: 'ts' },
  python: { label: 'Python', monacoLanguage: 'python', fileExtension: 'py' },
  cpp: { label: 'C++', monacoLanguage: 'cpp', fileExtension: 'cpp' },
  java: { label: 'Java', monacoLanguage: 'java', fileExtension: 'java' },
  c: { label: 'C', monacoLanguage: 'c', fileExtension: 'c' },
  ruby: { label: 'Ruby', monacoLanguage: 'ruby', fileExtension: 'rb' }
};

export const SOLUTION_LANGUAGES = Object.keys(SOLUTION_LANGUAGE_METADATA) as SolutionLanguage[];

export const ENABLED_SOLUTION_LANGUAGES: SolutionLanguage[] = [DEFAULT_SOLUTION_LANGUAGE, 'python', 'cpp'];
