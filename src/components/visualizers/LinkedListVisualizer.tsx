import React from 'react';
import { ArrowRight, ListRestart, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { LinkedListNodeState, LinkedListVisualState, VisualPrimitive } from '../../types';
import { cn } from '../../lib/utils';
import { formatVisualValue } from '../../lib/formatVisualValue';

type LinkedListValidationResult =
  | { valid: true; state: LinkedListVisualState }
  | { valid: false; message: string };

export interface LinkedListSegment {
  nodeIds: string[];
  connectionTargetId?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNodeValue = (value: unknown): value is VisualPrimitive => (
  value === null || ['string', 'number', 'boolean'].includes(typeof value)
);

export const validateLinkedListState = (data: unknown): LinkedListValidationResult => {
  if (!isRecord(data)) {
    return { valid: false, message: 'Linked-list state must be an object.' };
  }
  if (!Array.isArray(data.nodes)) {
    return { valid: false, message: 'Linked-list state must include a nodes array.' };
  }
  if (data.nodes.length > 100) {
    return { valid: false, message: 'Linked list exceeds the 100-node display limit.' };
  }

  const nodes: LinkedListNodeState[] = [];
  const nodeIds = new Set<string>();
  for (let index = 0; index < data.nodes.length; index++) {
    const rawNode = data.nodes[index];
    if (!isRecord(rawNode)) {
      return { valid: false, message: `Linked-list node ${index + 1} must be an object.` };
    }
    if (typeof rawNode.id !== 'string' || !rawNode.id.trim()) {
      return { valid: false, message: `Linked-list node ${index + 1} needs a non-empty string id.` };
    }
    if (nodeIds.has(rawNode.id)) {
      return { valid: false, message: `Linked list contains duplicate node id "${rawNode.id}".` };
    }
    if (!isNodeValue(rawNode.value)) {
      return { valid: false, message: `Linked-list node "${rawNode.id}" has a missing or unsupported value.` };
    }
    if (rawNode.nextId !== null && typeof rawNode.nextId !== 'string') {
      return { valid: false, message: `Linked-list node "${rawNode.id}" needs a string or null nextId.` };
    }
    const nextId = rawNode.nextId as string | null;

    nodeIds.add(rawNode.id);
    nodes.push({
      id: rawNode.id,
      value: rawNode.value,
      nextId
    });
  }

  for (const node of nodes) {
    if (node.nextId !== null && !nodeIds.has(node.nextId)) {
      return { valid: false, message: `Linked-list node "${node.id}" references missing next node "${node.nextId}".` };
    }
  }

  const headId = data.headId === null ? null : typeof data.headId === 'string' && data.headId.trim()
    ? data.headId
    : undefined;
  if (nodes.length > 0 && headId === undefined) {
    return { valid: false, message: 'A non-empty linked list must include a non-empty headId.' };
  }
  if (headId !== null && headId !== undefined && !nodeIds.has(headId)) {
    return { valid: false, message: `Linked-list head "${headId}" does not exist.` };
  }
  if (nodes.length > 0 && headId === null) {
    return { valid: false, message: 'A non-empty linked list cannot have a null headId.' };
  }

  if (data.highlightedNodeIds !== undefined && (
    !Array.isArray(data.highlightedNodeIds)
    || !data.highlightedNodeIds.every((id) => typeof id === 'string')
  )) {
    return { valid: false, message: 'Linked-list highlightedNodeIds must be a string array.' };
  }

  return {
    valid: true,
    state: {
      nodes,
      headId,
      activeNodeId: typeof data.activeNodeId === 'string' && nodeIds.has(data.activeNodeId)
        ? data.activeNodeId
        : undefined,
      highlightedNodeIds: Array.isArray(data.highlightedNodeIds)
        ? data.highlightedNodeIds.filter((id) => nodeIds.has(id))
        : []
    }
  };
};

export const buildLinkedListSegments = (state: LinkedListVisualState): LinkedListSegment[] => {
  const nodeMap = new Map(state.nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const segments: LinkedListSegment[] = [];

  const walk = (startId: string) => {
    const nodeIds: string[] = [];
    let currentId: string | null = startId;
    let connectionTargetId: string | undefined;

    while (currentId !== null && nodeIds.length < state.nodes.length) {
      if (visited.has(currentId)) {
        connectionTargetId = currentId;
        break;
      }
      const node = nodeMap.get(currentId);
      if (!node) break;
      visited.add(currentId);
      nodeIds.push(currentId);
      currentId = node.nextId;
    }

    if (nodeIds.length > 0) segments.push({ nodeIds, connectionTargetId });
  };

  if (state.headId) walk(state.headId);

  while (visited.size < state.nodes.length) {
    const remaining = state.nodes.filter((node) => !visited.has(node.id));
    const remainingIds = new Set(remaining.map((node) => node.id));
    const referencedIds = new Set(
      remaining
        .map((node) => node.nextId)
        .filter((id): id is string => id !== null && remainingIds.has(id))
    );
    const nextStart = remaining.find((node) => !referencedIds.has(node.id)) || remaining[0];
    walk(nextStart.id);
  }

  return segments;
};

const ListNode: React.FC<{
  node: LinkedListNodeState;
  isHead: boolean;
  isActive: boolean;
  isHighlighted: boolean;
}> = ({ node, isHead, isActive, isHighlighted }) => (
  <div className="relative flex flex-col items-center pt-7">
    {isHead && (
      <div className="absolute top-0 flex flex-col items-center text-[9px] font-bold uppercase tracking-widest text-indigo-300">
        Head
        <span aria-hidden="true">↓</span>
      </div>
    )}
    <motion.div
      layout
      initial={false}
      animate={{ scale: isActive ? 1.06 : 1 }}
      className={cn(
        'flex min-w-16 items-stretch overflow-hidden rounded-lg border-2 font-mono text-xs font-bold shadow-lg',
        isActive && 'border-indigo-300 bg-indigo-500 text-white shadow-indigo-500/30',
        !isActive && isHighlighted && 'border-emerald-500 bg-emerald-500/15 text-emerald-200',
        !isActive && !isHighlighted && 'border-slate-700 bg-slate-900 text-slate-200'
      )}
      title={`Node ${node.id}`}
    >
      <span className="flex min-h-12 min-w-12 items-center justify-center px-3">
        {formatVisualValue(node.value)}
      </span>
      <span className="flex w-5 items-center justify-center border-l border-current/20 text-[9px] opacity-60">
        next
      </span>
    </motion.div>
    <span className="mt-1 max-w-24 truncate font-mono text-[9px] text-slate-600" title={node.id}>
      {node.id}
    </span>
  </div>
);

export const LinkedListVisualizer: React.FC<{ data?: unknown }> = ({ data }) => {
  const validation = validateLinkedListState(data);
  if ('message' in validation) {
    return (
      <div className="w-full max-w-xl rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-center">
        <p className="text-xs font-bold text-amber-300">Linked-list visualization unavailable</p>
        <p className="mt-1 text-[11px] text-amber-200/70">{validation.message}</p>
      </div>
    );
  }

  if (validation.state.nodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">
        Empty Linked List
      </div>
    );
  }

  const nodeMap = new Map(validation.state.nodes.map((node) => [node.id, node]));
  const highlighted = new Set(validation.state.highlightedNodeIds);
  const segments = buildLinkedListSegments(validation.state);

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
      <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        <ListRestart className="h-3.5 w-3.5 text-indigo-400" />
        Linked List
      </div>
      <div className="space-y-5 overflow-x-auto pb-2">
        {segments.map((segment, segmentIndex) => (
          <div key={segment.nodeIds[0]}>
            {segmentIndex > 0 && (
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                Detached chain
              </p>
            )}
            <div className="flex min-w-max items-center">
              {segment.nodeIds.map((nodeId, index) => {
                const node = nodeMap.get(nodeId) as LinkedListNodeState;
                return (
                  <React.Fragment key={nodeId}>
                    <ListNode
                      node={node}
                      isHead={nodeId === validation.state.headId}
                      isActive={nodeId === validation.state.activeNodeId}
                      isHighlighted={highlighted.has(nodeId)}
                    />
                    {index < segment.nodeIds.length - 1 && (
                      <ArrowRight aria-label="next" className="mx-2 mt-5 h-5 w-5 flex-none text-slate-500" />
                    )}
                  </React.Fragment>
                );
              })}
              <div className="ml-2 mt-5 flex items-center gap-1.5 font-mono text-xs text-slate-500">
                {segment.connectionTargetId ? (
                  <>
                    <RotateCcw aria-hidden="true" className="h-4 w-4 text-amber-400" />
                    <span className="text-amber-300">to {segment.connectionTargetId}</span>
                  </>
                ) : (
                  <>
                    <ArrowRight aria-hidden="true" className="h-5 w-5" />
                    <span>null</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
