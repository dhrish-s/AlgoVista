import {
  ExecutionStep,
  TreeNodeState,
  TreeNodeUpdate,
  TreeTraceBase,
  TreeVisualDelta,
  TreeVisualState,
  VisualPrimitive
} from '../types';
import { applyTreeDelta, createTreeState } from './TreeTraceResolver';

type UnknownRecord = Record<string, unknown>;

export interface TreeTraceValidationResult {
  steps: ExecutionStep[];
  errors: string[];
}

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isVisualPrimitive = (value: unknown): value is VisualPrimitive => (
  value === null || ['string', 'number', 'boolean'].includes(typeof value)
);

const parseStringArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`${field} must be a string array`);
  }
  return [...value];
};

const parseNode = (value: unknown, field: string): TreeNodeState => {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  if (typeof value.id !== 'string' || !value.id.trim()) {
    throw new Error(`${field}.id must be a non-empty string`);
  }
  if (!isVisualPrimitive(value.value)) {
    throw new Error(`${field}.value must be a string, number, boolean, or null`);
  }
  return {
    id: value.id,
    value: value.value,
    children: parseStringArray(value.children, `${field}.children`)
  };
};

const parseTreeBase = (value: unknown): TreeTraceBase => {
  if (!isRecord(value)) throw new Error('treeBase must be an object');
  if (!Array.isArray(value.nodes)) throw new Error('treeBase.nodes must be an array');
  if (value.nodes.length > 100) throw new Error('treeBase exceeds the 100-node limit');
  if (value.rootId !== undefined && (typeof value.rootId !== 'string' || !value.rootId.trim())) {
    throw new Error('treeBase.rootId must be a non-empty string when provided');
  }
  return {
    nodes: value.nodes.map((node, index) => parseNode(node, `treeBase.nodes[${index}]`)),
    rootId: value.rootId as string | undefined
  };
};

const parseNodeUpdate = (value: unknown, index: number): TreeNodeUpdate => {
  if (!isRecord(value)) throw new Error(`treeDelta.updateNodes[${index}] must be an object`);
  if (typeof value.id !== 'string' || !value.id.trim()) {
    throw new Error(`treeDelta.updateNodes[${index}].id must be a non-empty string`);
  }
  if (value.value !== undefined && !isVisualPrimitive(value.value)) {
    throw new Error(`treeDelta.updateNodes[${index}].value is unsupported`);
  }
  return {
    id: value.id,
    ...(value.value !== undefined ? { value: value.value as VisualPrimitive } : {}),
    ...(value.children !== undefined
      ? { children: parseStringArray(value.children, `treeDelta.updateNodes[${index}].children`) }
      : {})
  };
};

const optionalStringArray = (value: unknown, field: string): string[] | undefined => (
  value === undefined ? undefined : parseStringArray(value, field)
);

const parseTreeDelta = (value: unknown): TreeVisualDelta => {
  if (!isRecord(value)) throw new Error('treeDelta must be an object');
  if (value.activeNodeId !== undefined && value.activeNodeId !== null
    && (typeof value.activeNodeId !== 'string' || !value.activeNodeId.trim())) {
    throw new Error('treeDelta.activeNodeId must be a non-empty string or null');
  }
  if (value.rootId !== undefined && value.rootId !== null
    && (typeof value.rootId !== 'string' || !value.rootId.trim())) {
    throw new Error('treeDelta.rootId must be a non-empty string or null');
  }
  if (value.addNodes !== undefined && !Array.isArray(value.addNodes)) {
    throw new Error('treeDelta.addNodes must be an array');
  }
  if (value.updateNodes !== undefined && !Array.isArray(value.updateNodes)) {
    throw new Error('treeDelta.updateNodes must be an array');
  }
  return {
    activeNodeId: value.activeNodeId as string | null | undefined,
    rootId: value.rootId as string | null | undefined,
    highlightNodeIds: optionalStringArray(value.highlightNodeIds, 'treeDelta.highlightNodeIds'),
    unhighlightNodeIds: optionalStringArray(value.unhighlightNodeIds, 'treeDelta.unhighlightNodeIds'),
    removeNodeIds: optionalStringArray(value.removeNodeIds, 'treeDelta.removeNodeIds'),
    addNodes: (value.addNodes as unknown[] | undefined)?.map((node, index) => (
      parseNode(node, `treeDelta.addNodes[${index}]`)
    )),
    updateNodes: (value.updateNodes as unknown[] | undefined)?.map(parseNodeUpdate)
  };
};

const validateTreeState = (state: TreeVisualState): string | undefined => {
  if (state.nodes.length > 100) return 'tree exceeds the 100-node limit';
  const ids = new Set<string>();
  for (const node of state.nodes) {
    if (ids.has(node.id)) return `duplicate tree node id "${node.id}"`;
    ids.add(node.id);
  }
  if (state.rootId && !ids.has(state.rootId)) return `tree root "${state.rootId}" does not exist`;
  if (state.activeNodeId && !ids.has(state.activeNodeId)) {
    return `active tree node "${state.activeNodeId}" does not exist`;
  }
  for (const nodeId of state.visitedNodeIds || []) {
    if (!ids.has(nodeId)) return `highlighted tree node "${nodeId}" does not exist`;
  }

  const parentCounts = new Map(state.nodes.map((node) => [node.id, 0]));
  for (const node of state.nodes) {
    for (const childId of node.children) {
      if (!ids.has(childId)) return `tree node "${node.id}" references missing child "${childId}"`;
      const count = (parentCounts.get(childId) || 0) + 1;
      if (count > 1) return `tree node "${childId}" has more than one parent`;
      parentCounts.set(childId, count);
    }
  }

  const roots = state.nodes.filter((node) => parentCounts.get(node.id) === 0);
  if (state.nodes.length === 0) {
    return state.rootId ? `empty tree cannot use root "${state.rootId}"` : undefined;
  }
  if (roots.length !== 1) return 'tree must have exactly one root and contain no cycles';
  if (state.rootId && roots[0].id !== state.rootId) {
    return `tree root "${state.rootId}" is referenced as a child`;
  }

  const nodeMap = new Map(state.nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const pending = [state.rootId || roots[0].id];
  while (pending.length > 0) {
    const nodeId = pending.shift() as string;
    if (visited.has(nodeId)) return 'tree contains a cycle';
    visited.add(nodeId);
    pending.push(...(nodeMap.get(nodeId)?.children || []));
  }
  return visited.size === state.nodes.length ? undefined : 'tree contains disconnected nodes';
};

const validateDeltaReferences = (
  previousState: TreeVisualState,
  delta: TreeVisualDelta
): string | undefined => {
  const existingIds = new Set(previousState.nodes.map((node) => node.id));
  const removeIds = delta.removeNodeIds || [];
  for (const nodeId of removeIds) {
    if (!existingIds.has(nodeId)) return `cannot remove missing tree node "${nodeId}"`;
  }

  const nextIds = new Set([...existingIds].filter((nodeId) => !removeIds.includes(nodeId)));
  for (const node of delta.addNodes || []) {
    if (nextIds.has(node.id)) return `cannot add duplicate tree node "${node.id}"`;
    nextIds.add(node.id);
  }
  for (const update of delta.updateNodes || []) {
    if (!nextIds.has(update.id)) return `cannot update missing tree node "${update.id}"`;
  }
  for (const nodeId of [
    ...(delta.highlightNodeIds || []),
    ...(delta.unhighlightNodeIds || [])
  ]) {
    if (!nextIds.has(nodeId)) return `tree delta references missing node "${nodeId}"`;
  }
  if (delta.activeNodeId && !nextIds.has(delta.activeNodeId)) {
    return `active tree node "${delta.activeNodeId}" does not exist`;
  }
  if (delta.rootId && !nextIds.has(delta.rootId)) {
    return `tree root "${delta.rootId}" does not exist`;
  }
  return undefined;
};

const resolvedStep = (step: ExecutionStep, tree: TreeVisualState): ExecutionStep => {
  const { treeBase: _treeBase, treeDelta: _treeDelta, ...visualState } = step.visualState;
  return { ...step, visualState: { ...visualState, tree } };
};

export const resolveTreeTraceSteps = (steps: ExecutionStep[]): TreeTraceValidationResult => {
  const resolvedSteps: ExecutionStep[] = [];
  const errors: string[] = [];
  let currentState: TreeVisualState | undefined;

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    const hasBase = step.visualState.treeBase !== undefined;
    const hasDelta = step.visualState.treeDelta !== undefined;

    if (!hasBase && !hasDelta && !currentState) {
      resolvedSteps.push(step);
      continue;
    }

    try {
      if (!currentState) {
        if (!hasBase) throw new Error('tree delta appears before treeBase');
        if (!hasDelta) throw new Error('the first tree step must include treeDelta');
        const base = parseTreeBase(step.visualState.treeBase);
        const baseState = createTreeState(base);
        const baseError = validateTreeState(baseState);
        if (baseError) throw new Error(`invalid treeBase: ${baseError}`);
        const delta = parseTreeDelta(step.visualState.treeDelta);
        const referenceError = validateDeltaReferences(baseState, delta);
        if (referenceError) throw new Error(referenceError);
        const nextState = applyTreeDelta(baseState, delta);
        const stateError = validateTreeState(nextState);
        if (stateError) throw new Error(stateError);
        currentState = nextState;
      } else {
        if (hasBase) throw new Error('treeBase may only appear on the first tree step');
        if (!hasDelta) throw new Error('tree step is missing treeDelta');
        const delta = parseTreeDelta(step.visualState.treeDelta);
        const referenceError = validateDeltaReferences(currentState, delta);
        if (referenceError) throw new Error(referenceError);
        const nextState = applyTreeDelta(currentState, delta);
        const stateError = validateTreeState(nextState);
        if (stateError) throw new Error(stateError);
        currentState = nextState;
      }
      resolvedSteps.push(resolvedStep(step, currentState));
    } catch (error) {
      const message = `Step ${index}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(message);
      if (!currentState) {
        return { steps: [], errors };
      }
    }
  }

  return { steps: resolvedSteps, errors };
};
