import {
  ExecutionStep,
  GraphEdgeState,
  GraphNodeState,
  GraphTraceBase,
  GraphVisualDelta,
  GraphVisualState,
  VisualPrimitive
} from '../types';
import { applyGraphDelta, createGraphState } from './GraphTraceResolver';

type UnknownRecord = Record<string, unknown>;

export interface GraphTraceValidationResult {
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
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string' && entry.trim())) {
    throw new Error(`${field} must be an array of non-empty strings`);
  }
  return [...value];
};

const parseNode = (value: unknown, field: string): GraphNodeState => {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  if (typeof value.id !== 'string' || !value.id.trim()) {
    throw new Error(`${field}.id must be a non-empty string`);
  }
  if (!isVisualPrimitive(value.value)) {
    throw new Error(`${field}.value must be a string, number, boolean, or null`);
  }
  return { id: value.id, value: value.value };
};

const parseEdge = (value: unknown, field: string): GraphEdgeState => {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  if (typeof value.id !== 'string' || !value.id.trim()) {
    throw new Error(`${field}.id must be a non-empty string`);
  }
  if (typeof value.source !== 'string' || !value.source.trim()
    || typeof value.target !== 'string' || !value.target.trim()) {
    throw new Error(`${field} must have non-empty source and target ids`);
  }
  if (value.weight !== undefined && !isVisualPrimitive(value.weight)) {
    throw new Error(`${field}.weight is unsupported`);
  }
  return {
    id: value.id,
    source: value.source,
    target: value.target,
    ...(value.weight !== undefined ? { weight: value.weight as VisualPrimitive } : {})
  };
};

const parseGraphBase = (value: unknown): GraphTraceBase => {
  if (!isRecord(value)) throw new Error('graphBase must be an object');
  if (!Array.isArray(value.nodes)) throw new Error('graphBase.nodes must be an array');
  if (!Array.isArray(value.edges)) throw new Error('graphBase.edges must be an array');
  if (value.nodes.length > 100) throw new Error('graphBase exceeds the 100-node limit');
  if (value.edges.length > 300) throw new Error('graphBase exceeds the 300-edge limit');
  if (value.directed !== undefined && typeof value.directed !== 'boolean') {
    throw new Error('graphBase.directed must be a boolean when provided');
  }
  return {
    nodes: value.nodes.map((node, index) => parseNode(node, `graphBase.nodes[${index}]`)),
    edges: value.edges.map((edge, index) => parseEdge(edge, `graphBase.edges[${index}]`)),
    directed: value.directed === true
  };
};

const optionalStringArray = (value: unknown, field: string): string[] | undefined => (
  value === undefined ? undefined : parseStringArray(value, field)
);

const parseGraphDelta = (value: unknown): GraphVisualDelta => {
  if (!isRecord(value)) throw new Error('graphDelta must be an object');
  for (const field of ['activeNodeId', 'activeEdgeId'] as const) {
    const marker = value[field];
    if (marker !== undefined && marker !== null && (typeof marker !== 'string' || !marker.trim())) {
      throw new Error(`graphDelta.${field} must be a non-empty string or null`);
    }
  }
  if (value.addNodes !== undefined && !Array.isArray(value.addNodes)) {
    throw new Error('graphDelta.addNodes must be an array');
  }
  if (value.addEdges !== undefined && !Array.isArray(value.addEdges)) {
    throw new Error('graphDelta.addEdges must be an array');
  }
  return {
    activeNodeId: value.activeNodeId as string | null | undefined,
    activeEdgeId: value.activeEdgeId as string | null | undefined,
    visitNodeIds: optionalStringArray(value.visitNodeIds, 'graphDelta.visitNodeIds'),
    unvisitNodeIds: optionalStringArray(value.unvisitNodeIds, 'graphDelta.unvisitNodeIds'),
    traverseEdgeIds: optionalStringArray(value.traverseEdgeIds, 'graphDelta.traverseEdgeIds'),
    untraverseEdgeIds: optionalStringArray(value.untraverseEdgeIds, 'graphDelta.untraverseEdgeIds'),
    removeNodeIds: optionalStringArray(value.removeNodeIds, 'graphDelta.removeNodeIds'),
    removeEdgeIds: optionalStringArray(value.removeEdgeIds, 'graphDelta.removeEdgeIds'),
    addNodes: (value.addNodes as unknown[] | undefined)?.map((node, index) => (
      parseNode(node, `graphDelta.addNodes[${index}]`)
    )),
    addEdges: (value.addEdges as unknown[] | undefined)?.map((edge, index) => (
      parseEdge(edge, `graphDelta.addEdges[${index}]`)
    ))
  };
};

const validateGraphState = (state: GraphVisualState): string | undefined => {
  if (state.nodes.length > 100) return 'graph exceeds the 100-node limit';
  if (state.edges.length > 300) return 'graph exceeds the 300-edge limit';

  const nodeIds = new Set<string>();
  for (const node of state.nodes) {
    if (nodeIds.has(node.id)) return `duplicate graph node id "${node.id}"`;
    nodeIds.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of state.edges) {
    if (edgeIds.has(edge.id)) return `duplicate graph edge id "${edge.id}"`;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      return `graph edge "${edge.id}" references a missing node`;
    }
    edgeIds.add(edge.id);
  }

  if (state.activeNodeId && !nodeIds.has(state.activeNodeId)) {
    return `active graph node "${state.activeNodeId}" does not exist`;
  }
  if (state.activeEdgeId && !edgeIds.has(state.activeEdgeId)) {
    return `active graph edge "${state.activeEdgeId}" does not exist`;
  }
  for (const nodeId of state.visitedNodeIds || []) {
    if (!nodeIds.has(nodeId)) return `visited graph node "${nodeId}" does not exist`;
  }
  for (const edgeId of state.traversedEdgeIds || []) {
    if (!edgeIds.has(edgeId)) return `traversed graph edge "${edgeId}" does not exist`;
  }
  return undefined;
};

const validateDeltaReferences = (
  previousState: GraphVisualState,
  delta: GraphVisualDelta
): string | undefined => {
  const existingNodeIds = new Set(previousState.nodes.map((node) => node.id));
  const existingEdges = new Map(previousState.edges.map((edge) => [edge.id, edge]));
  for (const nodeId of delta.removeNodeIds || []) {
    if (!existingNodeIds.has(nodeId)) return `cannot remove missing graph node "${nodeId}"`;
  }
  for (const edgeId of delta.removeEdgeIds || []) {
    if (!existingEdges.has(edgeId)) return `cannot remove missing graph edge "${edgeId}"`;
  }

  const removedNodeIds = new Set(delta.removeNodeIds || []);
  const nextNodeIds = new Set([...existingNodeIds].filter((id) => !removedNodeIds.has(id)));
  for (const node of delta.addNodes || []) {
    if (nextNodeIds.has(node.id)) return `cannot add duplicate graph node "${node.id}"`;
    nextNodeIds.add(node.id);
  }

  const nextEdgeIds = new Set([...existingEdges.values()]
    .filter((edge) => !(delta.removeEdgeIds || []).includes(edge.id))
    .filter((edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target))
    .map((edge) => edge.id));
  for (const edge of delta.addEdges || []) {
    if (nextEdgeIds.has(edge.id)) return `cannot add duplicate graph edge "${edge.id}"`;
    if (!nextNodeIds.has(edge.source) || !nextNodeIds.has(edge.target)) {
      return `graph edge "${edge.id}" references a missing node`;
    }
    nextEdgeIds.add(edge.id);
  }

  for (const nodeId of [...(delta.visitNodeIds || []), ...(delta.unvisitNodeIds || [])]) {
    if (!nextNodeIds.has(nodeId)) return `graph delta references missing node "${nodeId}"`;
  }
  for (const edgeId of [...(delta.traverseEdgeIds || []), ...(delta.untraverseEdgeIds || [])]) {
    if (!nextEdgeIds.has(edgeId)) return `graph delta references missing edge "${edgeId}"`;
  }
  if (delta.activeNodeId && !nextNodeIds.has(delta.activeNodeId)) {
    return `active graph node "${delta.activeNodeId}" does not exist`;
  }
  if (delta.activeEdgeId && !nextEdgeIds.has(delta.activeEdgeId)) {
    return `active graph edge "${delta.activeEdgeId}" does not exist`;
  }
  return undefined;
};

const resolvedStep = (step: ExecutionStep, graph: GraphVisualState): ExecutionStep => {
  const { graphBase: _graphBase, graphDelta: _graphDelta, ...visualState } = step.visualState;
  return { ...step, visualState: { ...visualState, graph } };
};

export const resolveGraphTraceSteps = (steps: ExecutionStep[]): GraphTraceValidationResult => {
  const resolvedSteps: ExecutionStep[] = [];
  const errors: string[] = [];
  let currentState: GraphVisualState | undefined;

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    const hasBase = step.visualState.graphBase !== undefined;
    const hasDelta = step.visualState.graphDelta !== undefined;

    if (!hasBase && !hasDelta && !currentState) {
      resolvedSteps.push(step);
      continue;
    }

    try {
      if (!currentState) {
        if (!hasBase) throw new Error('graph delta appears before graphBase');
        if (!hasDelta) throw new Error('the first graph step must include graphDelta');
        const baseState = createGraphState(parseGraphBase(step.visualState.graphBase));
        const baseError = validateGraphState(baseState);
        if (baseError) throw new Error(`invalid graphBase: ${baseError}`);
        const delta = parseGraphDelta(step.visualState.graphDelta);
        const referenceError = validateDeltaReferences(baseState, delta);
        if (referenceError) throw new Error(referenceError);
        const nextState = applyGraphDelta(baseState, delta);
        const stateError = validateGraphState(nextState);
        if (stateError) throw new Error(stateError);
        currentState = nextState;
      } else {
        if (hasBase) throw new Error('graphBase may only appear on the first graph step');
        if (!hasDelta) throw new Error('graph step is missing graphDelta');
        const delta = parseGraphDelta(step.visualState.graphDelta);
        const referenceError = validateDeltaReferences(currentState, delta);
        if (referenceError) throw new Error(referenceError);
        const nextState = applyGraphDelta(currentState, delta);
        const stateError = validateGraphState(nextState);
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
