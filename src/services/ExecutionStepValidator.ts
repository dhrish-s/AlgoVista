import { ExecutionStep, OperationType } from '../types';

export interface StepValidationResult {
  valid: boolean;
  steps: ExecutionStep[];
  isTruncated: boolean;
  error?: string;
}

const MAX_STEPS = 50;
const VALID_OPERATION_TYPES = new Set<OperationType>([
  'init', 'compare', 'move-pointer', 'swap', 'insert-map', 'lookup-map',
  'push-stack', 'pop-stack', 'enqueue', 'dequeue', 'visit-node',
  'update-dp', 'recurse-call', 'recurse-return', 'window-expand',
  'window-shrink', 'return', 'found', 'assign'
]);

export const validateExecutionSteps = (rawSteps: unknown): StepValidationResult => {
  if (!Array.isArray(rawSteps)) {
    return {
      valid: false,
      steps: [],
      isTruncated: false,
      error: 'Step trace is not an array'
    };
  }

  const validSteps: ExecutionStep[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rawSteps.length; i++) {
    const rawStep = rawSteps[i];

    if (validSteps.length >= MAX_STEPS) {
      return {
        valid: true,
        steps: validSteps,
        isTruncated: true,
        error: `Trace truncated from ${rawSteps.length} steps to ${MAX_STEPS} max limit`
      };
    }

    if (!rawStep || typeof rawStep !== 'object') {
      errors.push(`Step ${i}: not an object`);
      continue;
    }

    if (typeof rawStep.id !== 'string' || !rawStep.id.trim()) {
      errors.push(`Step ${i}: missing or invalid id`);
      continue;
    }

    if (typeof rawStep.line !== 'number' || rawStep.line < 0) {
      errors.push(`Step ${i}: invalid line number`);
      continue;
    }

    if (typeof rawStep.explanation !== 'string' || !rawStep.explanation.trim()) {
      errors.push(`Step ${i}: missing or invalid explanation`);
      continue;
    }

    if (!rawStep.operationType || !VALID_OPERATION_TYPES.has(rawStep.operationType as OperationType)) {
      errors.push(`Step ${i}: invalid operationType "${rawStep.operationType}"`);
      continue;
    }

    if (typeof rawStep.variables !== 'object' || rawStep.variables === null) {
      errors.push(`Step ${i}: variables is not an object`);
      continue;
    }

    if (typeof rawStep.visualState !== 'object' || rawStep.visualState === null) {
      errors.push(`Step ${i}: visualState is not an object`);
      continue;
    }

    validSteps.push({
      id: rawStep.id.substring(0, 100),
      line: Math.max(0, Math.min(10000, rawStep.line)),
      explanation: rawStep.explanation.substring(0, 500),
      operationType: rawStep.operationType as OperationType,
      variables: rawStep.variables as Record<string, unknown>,
      visualState: rawStep.visualState
    });
  }

  if (validSteps.length === 0) {
    return {
      valid: false,
      steps: [],
      isTruncated: false,
      error: `No valid steps found. Errors: ${errors.slice(0, 3).join('; ')}`
    };
  }

  return {
    valid: true,
    steps: validSteps,
    isTruncated: false
  };
};
