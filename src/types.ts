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

export type VisualPrimitive = string | number | boolean | null;

export interface TreeNodeState {
  id: string;
  value: VisualPrimitive;
  children: string[];
}

export interface TreeVisualState {
  nodes: TreeNodeState[];
  rootId?: string;
  activeNodeId?: string;
  visitedNodeIds?: string[];
}

export interface TreeTraceBase {
  nodes: TreeNodeState[];
  rootId?: string;
}

export interface TreeNodeUpdate {
  id: string;
  value?: VisualPrimitive;
  children?: string[];
}

export interface TreeVisualDelta {
  activeNodeId?: string | null;
  highlightNodeIds?: string[];
  unhighlightNodeIds?: string[];
  rootId?: string | null;
  addNodes?: TreeNodeState[];
  updateNodes?: TreeNodeUpdate[];
  removeNodeIds?: string[];
}

export interface GraphNodeState {
  id: string;
  value: VisualPrimitive;
}

export interface GraphEdgeState {
  id: string;
  source: string;
  target: string;
  weight?: VisualPrimitive;
}

export interface GraphVisualState {
  nodes: GraphNodeState[];
  edges: GraphEdgeState[];
  directed?: boolean;
  activeNodeId?: string;
  activeEdgeId?: string;
  visitedNodeIds?: string[];
  traversedEdgeIds?: string[];
}

export interface GraphTraceBase {
  nodes: GraphNodeState[];
  edges: GraphEdgeState[];
  directed?: boolean;
}

export interface GraphVisualDelta {
  activeNodeId?: string | null;
  activeEdgeId?: string | null;
  visitNodeIds?: string[];
  unvisitNodeIds?: string[];
  traverseEdgeIds?: string[];
  untraverseEdgeIds?: string[];
  addNodes?: GraphNodeState[];
  removeNodeIds?: string[];
  addEdges?: GraphEdgeState[];
  removeEdgeIds?: string[];
}

export interface DPCellPosition {
  row: number;
  column: number;
}

export interface DPCellUpdate extends DPCellPosition {
  value: VisualPrimitive;
}

export interface DPTableVisualState {
  values: VisualPrimitive[][];
  rowLabels?: VisualPrimitive[];
  columnLabels?: VisualPrimitive[];
  activeCell?: DPCellPosition;
  highlightedCells?: DPCellPosition[];
}

export interface DPTableTraceBase {
  rows: number;
  columns: number;
  initialCells?: DPCellUpdate[];
  rowLabels?: VisualPrimitive[];
  columnLabels?: VisualPrimitive[];
}

export interface DPTableVisualDelta {
  updates?: DPCellUpdate[];
  activeCell?: DPCellPosition | null;
  highlightedCells?: DPCellPosition[];
}

export interface LinkedListNodeState {
  id: string;
  value: VisualPrimitive;
  nextId: string | null;
}

export interface LinkedListVisualState {
  nodes: LinkedListNodeState[];
  headId?: string | null;
  activeNodeId?: string;
  highlightedNodeIds?: string[];
}

export interface LinkedListNextUpdate {
  id: string;
  nextId: string | null;
}

export interface LinkedListTraceBase {
  nodes: LinkedListNodeState[];
  headId: string | null;
}

export interface LinkedListVisualDelta {
  nextUpdates?: LinkedListNextUpdate[];
  headId?: string | null;
  activeNodeId?: string | null;
  highlightedNodeIds?: string[];
}

export interface VisualState {
  array?: unknown[];
  map?: Record<string, unknown>;
  stack?: unknown[];
  queue?: unknown[];
  tree?: TreeVisualState;
  treeBase?: TreeTraceBase;
  treeDelta?: TreeVisualDelta;
  graph?: GraphVisualState;
  graphBase?: GraphTraceBase;
  graphDelta?: GraphVisualDelta;
  dpTable?: DPTableVisualState;
  dpTableBase?: DPTableTraceBase;
  dpTableDelta?: DPTableVisualDelta;
  linkedList?: LinkedListVisualState;
  linkedListBase?: LinkedListTraceBase;
  linkedListDelta?: LinkedListVisualDelta;
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
  sourceInput?: string;
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
