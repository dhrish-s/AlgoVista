import React from 'react';
import { motion } from 'motion/react';
import { Network } from 'lucide-react';
import { TreeNodeState, TreeVisualState } from '../../types';
import { cn } from '../../lib/utils';
import { formatVisualValue } from '../../lib/formatVisualValue';
import { VisualizerStateMessage } from './VisualizerStateMessage';
import { VisualizerShell } from './VisualizerShell';

type TreeValidationResult =
  | { valid: true; state: TreeVisualState; rootId?: string }
  | { valid: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isTreeValue = (value: unknown): boolean => (
  value === null || ['string', 'number', 'boolean'].includes(typeof value)
);

export const validateTreeState = (data: unknown): TreeValidationResult => {
  if (!isRecord(data)) {
    return { valid: false, message: 'Tree state must be an object.' };
  }
  if (!Array.isArray(data.nodes)) {
    return { valid: false, message: 'Tree state must include a nodes array.' };
  }
  if (data.nodes.length > 100) {
    return { valid: false, message: 'Tree state exceeds the 100-node display limit.' };
  }

  const nodes: TreeNodeState[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < data.nodes.length; index++) {
    const rawNode = data.nodes[index];
    if (!isRecord(rawNode)) {
      return { valid: false, message: `Tree node ${index + 1} must be an object.` };
    }
    if (typeof rawNode.id !== 'string' || !rawNode.id.trim()) {
      return { valid: false, message: `Tree node ${index + 1} needs a non-empty string id.` };
    }
    if (ids.has(rawNode.id)) {
      return { valid: false, message: `Tree contains duplicate node id "${rawNode.id}".` };
    }
    if (!isTreeValue(rawNode.value)) {
      return { valid: false, message: `Tree node "${rawNode.id}" has an unsupported value.` };
    }
    if (!Array.isArray(rawNode.children) || !rawNode.children.every((child) => typeof child === 'string')) {
      return { valid: false, message: `Tree node "${rawNode.id}" needs a string children array.` };
    }

    ids.add(rawNode.id);
    nodes.push({
      id: rawNode.id,
      value: rawNode.value as TreeNodeState['value'],
      children: [...rawNode.children]
    });
  }

  const requestedRoot = typeof data.rootId === 'string' ? data.rootId : undefined;
  if (requestedRoot && !ids.has(requestedRoot)) {
    return { valid: false, message: `Tree root "${requestedRoot}" does not exist.` };
  }

  const parentCounts = new Map(nodes.map((node) => [node.id, 0]));
  for (const node of nodes) {
    for (const childId of node.children) {
      if (!ids.has(childId)) {
        return { valid: false, message: `Tree node "${node.id}" references missing child "${childId}".` };
      }
      const parentCount = (parentCounts.get(childId) || 0) + 1;
      if (parentCount > 1) {
        return { valid: false, message: `Tree node "${childId}" has more than one parent.` };
      }
      parentCounts.set(childId, parentCount);
    }
  }

  const inferredRoots = nodes.filter((node) => parentCounts.get(node.id) === 0);
  const rootId = requestedRoot || inferredRoots[0]?.id;
  if (nodes.length > 0 && inferredRoots.length !== 1) {
    return { valid: false, message: 'Tree state must have exactly one root and contain no cycles.' };
  }
  if (requestedRoot && inferredRoots[0]?.id !== requestedRoot) {
    return { valid: false, message: `Tree root "${requestedRoot}" is referenced as a child.` };
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const pending = rootId ? [rootId] : [];
  while (pending.length > 0) {
    const nodeId = pending.shift() as string;
    if (visited.has(nodeId)) {
      return { valid: false, message: 'Tree state contains a cycle.' };
    }
    visited.add(nodeId);
    pending.push(...(nodeMap.get(nodeId)?.children || []));
  }
  if (visited.size !== nodes.length) {
    return { valid: false, message: 'Tree state contains disconnected nodes.' };
  }

  return {
    valid: true,
    rootId,
    state: {
      nodes,
      rootId,
      activeNodeId: typeof data.activeNodeId === 'string' && ids.has(data.activeNodeId)
        ? data.activeNodeId
        : undefined,
      visitedNodeIds: Array.isArray(data.visitedNodeIds)
        ? data.visitedNodeIds.filter((id): id is string => typeof id === 'string' && ids.has(id))
        : []
    }
  };
};

const TreeBranch: React.FC<{
  nodeId: string;
  nodes: Map<string, TreeNodeState>;
  activeNodeId?: string;
  visitedNodeIds: Set<string>;
}> = ({ nodeId, nodes, activeNodeId, visitedNodeIds }) => {
  const node = nodes.get(nodeId) as TreeNodeState;
  const isActive = activeNodeId === nodeId;
  const isVisited = visitedNodeIds.has(nodeId);

  return (
    <div className="flex flex-col items-center min-w-max">
      <motion.div
        layout
        initial={false}
        animate={{ scale: isActive ? 1.08 : 1 }}
        className={cn(
          'min-w-12 h-12 px-3 rounded-full border-2 flex items-center justify-center font-mono text-xs font-bold shadow-lg',
          isActive && 'bg-indigo-500 border-indigo-300 text-white shadow-indigo-500/30',
          !isActive && isVisited && 'bg-emerald-500/15 border-emerald-500 text-emerald-200',
          !isActive && !isVisited && 'bg-slate-900 border-slate-700 text-slate-200'
        )}
        title={`Node ${node.id}`}
      >
        {formatVisualValue(node.value)}
      </motion.div>

      {node.children.length > 0 && (
        <>
          <div className="h-5 w-px bg-slate-700" />
          <div className="flex border-t border-slate-700 pt-5 gap-6 px-3">
            {node.children.map((childId) => (
              <TreeBranch
                key={childId}
                nodeId={childId}
                nodes={nodes}
                activeNodeId={activeNodeId}
                visitedNodeIds={visitedNodeIds}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const TreeVisualizer: React.FC<{ data?: unknown }> = ({ data }) => {
  const validation = validateTreeState(data);
  if ('message' in validation) {
    return (
      <VisualizerStateMessage title="Tree visualization unavailable">
        {validation.message}
      </VisualizerStateMessage>
    );
  }

  if (!validation.rootId) {
    return (
      <div className="p-5 border border-dashed border-slate-700 rounded-xl text-xs text-slate-500 text-center">
        Empty Tree
      </div>
    );
  }

  const nodes = new Map(validation.state.nodes.map((node) => [node.id, node]));
  return (
    <VisualizerShell title="Tree" icon={<Network className="h-3.5 w-3.5 text-indigo-400" />}>
      <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max justify-center px-1">
        <TreeBranch
          nodeId={validation.rootId}
          nodes={nodes}
          activeNodeId={validation.state.activeNodeId}
          visitedNodeIds={new Set(validation.state.visitedNodeIds)}
        />
      </div>
      </div>
    </VisualizerShell>
  );
};
