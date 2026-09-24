import { StructuredProblem } from '../types';

export const LOW_PARSE_CONFIDENCE_THRESHOLD = 0.55;

export const getParseConfidence = (problem: Partial<StructuredProblem>): number => {
  const rawConfidence = typeof problem.parsingConfidence === 'number' ? problem.parsingConfidence : 0;
  const structuralSignals = [
    Boolean(problem.title),
    Boolean(problem.statement && problem.statement.length > 40),
    Boolean(problem.examples?.length),
    Boolean(problem.constraints?.length),
    Boolean(problem.approaches?.length)
  ];
  const structureScore = structuralSignals.filter(Boolean).length / structuralSignals.length;
  return Math.max(0, Math.min(1, rawConfidence || structureScore));
};

export const validateParsedProblem = (problem: Partial<StructuredProblem>): number => {
  const confidence = getParseConfidence(problem);

  if (!problem.title || !problem.statement || !Array.isArray(problem.examples) || problem.examples.length === 0) {
    const error = new Error('Parsing failed: missing required problem details') as Error & { confidence: number };
    error.confidence = confidence;
    throw error;
  }

  if (confidence < LOW_PARSE_CONFIDENCE_THRESHOLD || problem.requiresUserConfirmation) {
    const error = new Error('Low confidence parsing result') as Error & { confidence: number };
    error.confidence = confidence;
    throw error;
  }

  return confidence;
};
