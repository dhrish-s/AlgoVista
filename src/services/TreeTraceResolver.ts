import {
  TreeNodeState,
  TreeTraceBase,
  TreeVisualDelta,
  TreeVisualState
} from '../types';

const cloneNode = (node: TreeNodeState): TreeNodeState => ({
  ...node,
  children: [...node.children]
});

export const createTreeState = (base: TreeTraceBase): TreeVisualState => ({
  nodes: base.nodes.map(cloneNode),
  rootId: base.rootId,
  visitedNodeIds: []
});

export const applyTreeDelta = (
  previousState: TreeVisualState,
  delta: TreeVisualDelta
): TreeVisualState => {
  const nodes = new Map(previousState.nodes.map((node) => [node.id, cloneNode(node)]));
  const visitedNodeIds = new Set(previousState.visitedNodeIds || []);

  for (const nodeId of delta.removeNodeIds || []) {
    nodes.delete(nodeId);
    visitedNodeIds.delete(nodeId);
  }

  for (const node of delta.addNodes || []) {
    nodes.set(node.id, cloneNode(node));
  }

  for (const update of delta.updateNodes || []) {
    const node = nodes.get(update.id);
    if (!node) continue;
    nodes.set(update.id, {
      ...node,
      ...(update.value !== undefined ? { value: update.value } : {}),
      ...(update.children !== undefined ? { children: [...update.children] } : {})
    });
  }

  for (const nodeId of delta.unhighlightNodeIds || []) {
    visitedNodeIds.delete(nodeId);
  }
  for (const nodeId of delta.highlightNodeIds || []) {
    visitedNodeIds.add(nodeId);
  }

  const rootId = delta.rootId === null
    ? undefined
    : delta.rootId ?? previousState.rootId;
  const activeNodeId = delta.activeNodeId === null
    ? undefined
    : delta.activeNodeId ?? previousState.activeNodeId;

  return {
    nodes: [...nodes.values()],
    rootId,
    activeNodeId: activeNodeId && nodes.has(activeNodeId) ? activeNodeId : undefined,
    visitedNodeIds: [...visitedNodeIds].filter((nodeId) => nodes.has(nodeId))
  };
};

export const foldTreeTrace = (
  base: TreeTraceBase,
  deltas: TreeVisualDelta[]
): TreeVisualState[] => {
  let currentState = createTreeState(base);
  return deltas.map((delta) => {
    currentState = applyTreeDelta(currentState, delta);
    return currentState;
  });
};
