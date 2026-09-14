import {
  LinkedListNodeState,
  LinkedListTraceBase,
  LinkedListVisualDelta,
  LinkedListVisualState
} from '../types';

const cloneNode = (node: LinkedListNodeState): LinkedListNodeState => ({ ...node });

export const createLinkedListState = (
  base: LinkedListTraceBase
): LinkedListVisualState => ({
  nodes: base.nodes.map(cloneNode),
  headId: base.headId,
  highlightedNodeIds: []
});

export const applyLinkedListDelta = (
  previousState: LinkedListVisualState,
  delta: LinkedListVisualDelta
): LinkedListVisualState => {
  const nodes = new Map(
    previousState.nodes.map((node) => [node.id, cloneNode(node)])
  );

  for (const update of delta.nextUpdates || []) {
    const node = nodes.get(update.id);
    if (!node) continue;
    nodes.set(update.id, { ...node, nextId: update.nextId });
  }

  const headId = delta.headId === undefined
    ? previousState.headId
    : delta.headId;
  const activeNodeId = delta.activeNodeId === null
    ? undefined
    : delta.activeNodeId ?? previousState.activeNodeId;
  const highlightedNodeIds = delta.highlightedNodeIds === undefined
    ? [...(previousState.highlightedNodeIds || [])]
    : [...delta.highlightedNodeIds];

  return {
    nodes: [...nodes.values()],
    headId,
    ...(activeNodeId ? { activeNodeId } : {}),
    highlightedNodeIds
  };
};

export const foldLinkedListTrace = (
  base: LinkedListTraceBase,
  deltas: LinkedListVisualDelta[]
): LinkedListVisualState[] => {
  let currentState = createLinkedListState(base);
  return deltas.map((delta) => {
    currentState = applyLinkedListDelta(currentState, delta);
    return currentState;
  });
};
