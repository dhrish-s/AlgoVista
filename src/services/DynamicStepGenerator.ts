import { StructuredProblem, ExecutionStep, ApproachOption, OperationType, VisualState } from '../types';
import { getAIManager } from './ai/AIProviderManager';

interface StepValidationResult {
  valid: boolean;
  steps: ExecutionStep[];
  isTruncated: boolean;
  error?: string;
}

export interface GeneratedExecutionSteps extends Array<ExecutionStep> {
  generationFeedback?: {
    truncated: boolean;
    message?: string;
  };
  providerMeta?: {
    provider: string;
    status: string;
    message?: string;
  };
}

export class DynamicStepGenerator {
  private static readonly MAX_STEPS = 50;
  private static readonly VALID_OPERATION_TYPES = new Set<OperationType>([
    'init', 'compare', 'move-pointer', 'swap', 'insert-map', 'lookup-map',
    'push-stack', 'pop-stack', 'enqueue', 'dequeue', 'visit-node',
    'update-dp', 'recurse-call', 'recurse-return', 'window-expand',
    'window-shrink', 'return', 'found', 'assign'
  ]);
  private static latestRequestMap: Record<string, number> = {};

  /**
   * Validate and sanitize execution steps from AI provider.
   * Enforces maxSteps limit, checks for malformed steps, and truncates safely.
   */
  private static validateSteps(rawSteps: any): StepValidationResult {
    // Check if rawSteps is an array
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

      // Enforce maxSteps limit
      if (validSteps.length >= DynamicStepGenerator.MAX_STEPS) {
        return {
          valid: true,
          steps: validSteps,
          isTruncated: true,
          error: `Trace truncated from ${rawSteps.length} steps to ${DynamicStepGenerator.MAX_STEPS} max limit`
        };
      }

      // Check required fields
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

      // Validate operationType
      if (!rawStep.operationType || !DynamicStepGenerator.VALID_OPERATION_TYPES.has(rawStep.operationType)) {
        errors.push(`Step ${i}: invalid operationType "${rawStep.operationType}"`);
        continue;
      }

      // Validate variables is an object
      if (typeof rawStep.variables !== 'object' || rawStep.variables === null) {
        errors.push(`Step ${i}: variables is not an object`);
        continue;
      }

      // Validate visualState is an object
      if (typeof rawStep.visualState !== 'object' || rawStep.visualState === null) {
        errors.push(`Step ${i}: visualState is not an object`);
        continue;
      }

      // Construct safe step with only expected fields
      const safeStep: ExecutionStep = {
        id: String(rawStep.id).substring(0, 100), // Cap id length
        line: Math.max(0, Math.min(10000, rawStep.line)), // Bound line number
        explanation: String(rawStep.explanation).substring(0, 500), // Cap explanation length
        operationType: rawStep.operationType as OperationType,
        variables: typeof rawStep.variables === 'object' ? rawStep.variables : {},
        visualState: typeof rawStep.visualState === 'object' ? rawStep.visualState : {}
      };

      validSteps.push(safeStep);
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
  }

  static async generate(
    problem: StructuredProblem,
    approach: ApproachOption,
    testCase: { input: string; output: string },
    signal?: AbortSignal
  ): Promise<ExecutionStep[]> {
    const aiManager = getAIManager();
    if (!aiManager) throw new Error("AI Manager not initialized.");

    const key = `${problem.id}:generate`;
    DynamicStepGenerator.latestRequestMap[key] = (DynamicStepGenerator.latestRequestMap[key] || 0) + 1;
    const reqId = DynamicStepGenerator.latestRequestMap[key];

    if (signal?.aborted) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    const { data: rawSteps, meta } = await aiManager.generateSteps(problem, approach.explanation, testCase, { task: 'steps', signal });

    // Ignore if a newer request started
    if (DynamicStepGenerator.latestRequestMap[key] !== reqId) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    // Validate and sanitize returned steps
    const validation = DynamicStepGenerator.validateSteps(rawSteps);
    if (!validation.valid) {
      throw new Error(`Invalid step trace: ${validation.error}`);
    }

    if (validation.isTruncated) {
      console.warn(`Step trace truncated: ${validation.error}`);
    }

    const steps = validation.steps as GeneratedExecutionSteps;
    steps.generationFeedback = {
      truncated: validation.isTruncated,
      message: validation.error
    };
    steps.providerMeta = meta;
    return steps;
  }

  static async generateFromUserCode(
    problem: StructuredProblem,
    userCode: string,
    testCase: { input: string; output: string },
    signal?: AbortSignal
  ): Promise<ExecutionStep[]> {
    const aiManager = getAIManager();
    if (!aiManager) throw new Error("AI Manager not initialized.");

    const key = `${problem.id}:generateFromUserCode`;
    DynamicStepGenerator.latestRequestMap[key] = (DynamicStepGenerator.latestRequestMap[key] || 0) + 1;
    const reqId = DynamicStepGenerator.latestRequestMap[key];

    if (signal?.aborted) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    const { data: rawSteps, meta } = await aiManager.generateSteps(problem, userCode, testCase, { task: 'steps', signal });

    if (DynamicStepGenerator.latestRequestMap[key] !== reqId) {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }

    // Validate and sanitize returned steps
    const validation = DynamicStepGenerator.validateSteps(rawSteps);
    if (!validation.valid) {
      throw new Error(`Invalid step trace: ${validation.error}`);
    }

    if (validation.isTruncated) {
      console.warn(`Step trace truncated: ${validation.error}`);
    }

    const steps = validation.steps as GeneratedExecutionSteps;
    steps.generationFeedback = {
      truncated: validation.isTruncated,
      message: validation.error
    };
    steps.providerMeta = meta;
    return steps;
  }
}
