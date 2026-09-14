import {
  ExecutionStep,
  LinkedListNextUpdate,
  LinkedListNodeState,
  LinkedListTraceBase,
  LinkedListVisualDelta,
  LinkedListVisualState,
  VisualPrimitive
} from '../types';
import {
  applyLinkedListDelta,
  createLinkedListState
} from './LinkedListTraceResolver';

type UnknownRecord = Record<string, unknown>;

export interface LinkedListTraceValidationResult {
  steps: ExecutionStep[];
  errors: string[];
}

const MAX_LINKED_LIST_NODES = 100;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isVisualPrimitive = (value: unknown): value is VisualPrimitive => (
  value === null || ['string', 'number', 'boolean'].includes(typeof value)
);

const parseNodeId = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
};

const parseNextId = (value: unknown, field: string): string | null => (
  value === null ? null : parseNodeId(value, field)
);

const parseNode = (value: unknown, field: string): LinkedListNodeState => {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  const id = parseNodeId(value.id, `${field}.id`);
  if (!isVisualPrimitive(value.value)) {
    throw new Error(`${field}.value must be a string, number, boolean, or null`);
  }
  return {
    id,
    value: value.value,
    nextId: parseNextId(value.nextId, `${field}.nextId`)
  };
};

const parseLinkedListBase = (value: unknown): LinkedListTraceBase => {
  if (!isRecord(value)) throw new Error('linkedListBase must be an object');
  if (!Array.isArray(value.nodes)) throw new Error('linkedListBase.nodes must be an array');
  if (value.nodes.length > MAX_LINKED_LIST_NODES) {
    throw new Error(`linkedListBase exceeds the ${MAX_LINKED_LIST_NODES}-node limit`);
  }
  return {
    nodes: value.nodes.map((node, index) => (
      parseNode(node, `linkedListBase.nodes[${index}]`)
    )),
    headId: parseNextId(value.headId, 'linkedListBase.headId')
  };
};

const parseStringArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const ids = value.map((id, index) => parseNodeId(id, `${field}[${index}]`));
  if (new Set(ids).size !== ids.length) throw new Error(`${field} contains duplicate node ids`);
  return ids;
};

const parseNextUpdate = (value: unknown, index: number): LinkedListNextUpdate => {
  const field = `linkedListDelta.nextUpdates[${index}]`;
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  return {
    id: parseNodeId(value.id, `${field}.id`),
    nextId: parseNextId(value.nextId, `${field}.nextId`)
  };
};

const parseLinkedListDelta = (value: unknown): LinkedListVisualDelta => {
  if (!isRecord(value)) throw new Error('linkedListDelta must be an object');
  if (value.nextUpdates !== undefined && !Array.isArray(value.nextUpdates)) {
    throw new Error('linkedListDelta.nextUpdates must be an array');
  }
  const nextUpdates = (value.nextUpdates as unknown[] | undefined)?.map(parseNextUpdate);
  if (nextUpdates && new Set(nextUpdates.map((update) => update.id)).size !== nextUpdates.length) {
    throw new Error('linkedListDelta.nextUpdates contains duplicate node ids');
  }
  return {
    nextUpdates,
    headId: value.headId === undefined
      ? undefined
      : parseNextId(value.headId, 'linkedListDelta.headId'),
    activeNodeId: value.activeNodeId === undefined || value.activeNodeId === null
      ? value.activeNodeId as null | undefined
      : parseNodeId(value.activeNodeId, 'linkedListDelta.activeNodeId'),
    highlightedNodeIds: value.highlightedNodeIds === undefined
      ? undefined
      : parseStringArray(value.highlightedNodeIds, 'linkedListDelta.highlightedNodeIds')
  };
};

const validateLinkedListState = (state: LinkedListVisualState): string | undefined => {
  if (state.nodes.length > MAX_LINKED_LIST_NODES) {
    return `linked list exceeds the ${MAX_LINKED_LIST_NODES}-node limit`;
  }
  const nodeIds = new Set<string>();
  for (const node of state.nodes) {
    if (nodeIds.has(node.id)) return `duplicate linked-list node id "${node.id}"`;
    nodeIds.add(node.id);
  }
  for (const node of state.nodes) {
    if (node.nextId !== null && !nodeIds.has(node.nextId)) {
      return `linked-list node "${node.id}" references missing next node "${node.nextId}"`;
    }
  }
  if (state.nodes.length > 0 && !state.headId) {
    return 'a non-empty linked list must have a head';
  }
  if (state.headId && !nodeIds.has(state.headId)) {
    return `linked-list head "${state.headId}" does not exist`;
  }
  if (state.activeNodeId && !nodeIds.has(state.activeNodeId)) {
    return `active linked-list node "${state.activeNodeId}" does not exist`;
  }
  for (const nodeId of state.highlightedNodeIds || []) {
    if (!nodeIds.has(nodeId)) return `highlighted linked-list node "${nodeId}" does not exist`;
  }
  return undefined;
};

const validateDeltaReferences = (
  baseNodeIds: Set<string>,
  delta: LinkedListVisualDelta
): string | undefined => {
  for (const update of delta.nextUpdates || []) {
    if (!baseNodeIds.has(update.id)) {
      return `cannot update missing linked-list node "${update.id}"`;
    }
    if (update.nextId !== null && !baseNodeIds.has(update.nextId)) {
      return `linked-list pointer update for "${update.id}" references missing next node "${update.nextId}"`;
    }
  }
  if (delta.headId && !baseNodeIds.has(delta.headId)) {
    return `linked-list head "${delta.headId}" does not exist`;
  }
  if (delta.activeNodeId && !baseNodeIds.has(delta.activeNodeId)) {
    return `active linked-list node "${delta.activeNodeId}" does not exist`;
  }
  for (const nodeId of delta.highlightedNodeIds || []) {
    if (!baseNodeIds.has(nodeId)) {
      return `highlighted linked-list node "${nodeId}" does not exist`;
    }
  }
  return undefined;
};

const resolvedStep = (
  step: ExecutionStep,
  linkedList: LinkedListVisualState
): ExecutionStep => {
  const {
    linkedListBase: _linkedListBase,
    linkedListDelta: _linkedListDelta,
    ...visualState
  } = step.visualState;
  return { ...step, visualState: { ...visualState, linkedList } };
};

export const resolveLinkedListTraceSteps = (
  steps: ExecutionStep[]
): LinkedListTraceValidationResult => {
  const resolvedSteps: ExecutionStep[] = [];
  const errors: string[] = [];
  let currentState: LinkedListVisualState | undefined;
  let baseNodeIds: Set<string> | undefined;

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    const hasBase = step.visualState.linkedListBase !== undefined;
    const hasDelta = step.visualState.linkedListDelta !== undefined;

    if (!hasBase && !hasDelta && !currentState) {
      resolvedSteps.push(step);
      continue;
    }

    try {
      if (!currentState) {
        if (!hasBase) throw new Error('linked-list delta appears before linkedListBase');
        if (!hasDelta) throw new Error('the first linked-list step must include linkedListDelta');
        const base = parseLinkedListBase(step.visualState.linkedListBase);
        const baseState = createLinkedListState(base);
        const baseError = validateLinkedListState(baseState);
        if (baseError) throw new Error(`invalid linkedListBase: ${baseError}`);
        const delta = parseLinkedListDelta(step.visualState.linkedListDelta);
        const nodeIds = new Set(base.nodes.map((node) => node.id));
        const referenceError = validateDeltaReferences(nodeIds, delta);
        if (referenceError) throw new Error(referenceError);
        const nextState = applyLinkedListDelta(baseState, delta);
        const stateError = validateLinkedListState(nextState);
        if (stateError) throw new Error(stateError);
        currentState = nextState;
        baseNodeIds = nodeIds;
      } else {
        if (hasBase) throw new Error('linkedListBase may only appear on the first linked-list step');
        if (!hasDelta) throw new Error('linked-list step is missing linkedListDelta');
        if (!baseNodeIds) throw new Error('linked-list base node ids are unavailable');
        const delta = parseLinkedListDelta(step.visualState.linkedListDelta);
        const referenceError = validateDeltaReferences(baseNodeIds, delta);
        if (referenceError) throw new Error(referenceError);
        const nextState = applyLinkedListDelta(currentState, delta);
        const stateError = validateLinkedListState(nextState);
        if (stateError) throw new Error(stateError);
        currentState = nextState;
      }
      resolvedSteps.push(resolvedStep(step, currentState));
    } catch (error) {
      errors.push(`Step ${index}: ${error instanceof Error ? error.message : String(error)}`);
      if (!currentState) return { steps: [], errors };
    }
  }

  return { steps: resolvedSteps, errors };
};
