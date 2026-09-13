import {
  GraphEdgeState,
  GraphNodeState,
  GraphTraceBase,
  GraphVisualDelta,
  GraphVisualState
} from '../types';

const cloneNode = (node: GraphNodeState): GraphNodeState => ({ ...node });
const cloneEdge = (edge: GraphEdgeState): GraphEdgeState => ({ ...edge });

export const createGraphState = (base: GraphTraceBase): GraphVisualState => ({
  nodes: base.nodes.map(cloneNode),
  edges: base.edges.map(cloneEdge),
  directed: base.directed === true,
  visitedNodeIds: [],
  traversedEdgeIds: []
});

export const applyGraphDelta = (
  previousState: GraphVisualState,
  delta: GraphVisualDelta
): GraphVisualState => {
  const nodes = new Map(previousState.nodes.map((node) => [node.id, cloneNode(node)]));
  const edges = new Map(previousState.edges.map((edge) => [edge.id, cloneEdge(edge)]));
  const visitedNodeIds = new Set(previousState.visitedNodeIds || []);
  const traversedEdgeIds = new Set(previousState.traversedEdgeIds || []);

  for (const edgeId of delta.removeEdgeIds || []) {
    edges.delete(edgeId);
    traversedEdgeIds.delete(edgeId);
  }

  for (const nodeId of delta.removeNodeIds || []) {
    nodes.delete(nodeId);
    visitedNodeIds.delete(nodeId);
    for (const edge of edges.values()) {
      if (edge.source === nodeId || edge.target === nodeId) {
        edges.delete(edge.id);
        traversedEdgeIds.delete(edge.id);
      }
    }
  }

  for (const node of delta.addNodes || []) {
    nodes.set(node.id, cloneNode(node));
  }
  for (const edge of delta.addEdges || []) {
    edges.set(edge.id, cloneEdge(edge));
  }

  for (const nodeId of delta.unvisitNodeIds || []) visitedNodeIds.delete(nodeId);
  for (const nodeId of delta.visitNodeIds || []) visitedNodeIds.add(nodeId);
  for (const edgeId of delta.untraverseEdgeIds || []) traversedEdgeIds.delete(edgeId);
  for (const edgeId of delta.traverseEdgeIds || []) traversedEdgeIds.add(edgeId);

  const activeNodeId = delta.activeNodeId === null
    ? undefined
    : delta.activeNodeId ?? previousState.activeNodeId;
  const activeEdgeId = delta.activeEdgeId === null
    ? undefined
    : delta.activeEdgeId ?? previousState.activeEdgeId;

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    directed: previousState.directed === true,
    activeNodeId: activeNodeId && nodes.has(activeNodeId) ? activeNodeId : undefined,
    activeEdgeId: activeEdgeId && edges.has(activeEdgeId) ? activeEdgeId : undefined,
    visitedNodeIds: [...visitedNodeIds].filter((nodeId) => nodes.has(nodeId)),
    traversedEdgeIds: [...traversedEdgeIds].filter((edgeId) => edges.has(edgeId))
  };
};

export const foldGraphTrace = (
  base: GraphTraceBase,
  deltas: GraphVisualDelta[]
): GraphVisualState[] => {
  let currentState = createGraphState(base);
  return deltas.map((delta) => {
    currentState = applyGraphDelta(currentState, delta);
    return currentState;
  });
};
