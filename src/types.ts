/**
 * Global types for the AlgoVista Dynamic Learning System
 */

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type ProblemSource = 'leetcode-link' | 'leetcode-number' | 'pasted-text' | 'mixed';

export interface ExampleCase {
  input: string;
  output: string;
  explanation?: string;
}

export interface PatternSuggestion {
  name: string;
  confidence: number;
}

export interface VisualState {
  array?: any[];
  map?: Record<string, any>;
  stack?: any[];
  queue?: any[];
  tree?: any;
  graph?: any;
  dpTable?: any[][];
  indices?: Record<string, number>;
  highlights?: (number | string)[];
}

export type OperationType =
  | "init"
  | "compare"
  | "move-pointer"
  | "swap"
  | "insert-map"
  | "lookup-map"
  | "push-stack"
  | "pop-stack"
  | "enqueue"
  | "dequeue"
  | "visit-node"
  | "update-dp"
  | "recurse-call"
  | "recurse-return"
  | "window-expand"
  | "window-shrink"
  | "return"
  | "found"
  | "assign";

export interface ExecutionStep {
  id: string;
  line: number;
  explanation: string;
  operationType: OperationType;
  variables: Record<string, any>;
  visualState: VisualState;
}

export interface ApproachOption {
  id: string;
  name: string;
  complexity: {
    time: string;
    space: string;
  };
  explanation: string;
  isOptimal: boolean;
}

export interface StructuredProblem {
  id: string;
  source: ProblemSource;
  slug?: string;
  number?: string;
  title: string;
  difficulty?: Difficulty;
  tags?: string[];
  statement: string;
  examples: ExampleCase[];
  constraints: string[];
  inputFormat?: string;
  outputFormat?: string;
  inferredPatterns: PatternSuggestion[];
  parsingConfidence: number; // 0 to 1
  requiresUserConfirmation?: boolean;
  starterCode?: string;
  approaches?: ApproachOption[];
  hints?: string[];
}

export interface MasteryData {
  patternId: string;
  count: number;
  lastMistake?: string;
  confidence: number;
}

export interface UserState {
  streak: number;
  totalSolved: number;
  mastery: MasteryData[];
  points: number;
}
