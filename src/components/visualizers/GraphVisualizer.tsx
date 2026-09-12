import React from 'react';
import { Waypoints } from 'lucide-react';
import { GraphNodeState, GraphVisualState } from '../../types';
import { cn } from '../../lib/utils';
import { formatVisualValue } from '../../lib/formatVisualValue';
import { VisualizerStateMessage } from './VisualizerStateMessage';
import { VisualizerShell } from './VisualizerShell';
import { VisualizerEmptyState } from './VisualizerEmptyState';

type GraphValidationResult =
  | { valid: true; state: GraphVisualState }
  | { valid: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isGraphValue = (value: unknown): boolean => (
  value === null || ['string', 'number', 'boolean'].includes(typeof value)
);

export const validateGraphState = (data: unknown): GraphValidationResult => {
  if (!isRecord(data)) {
    return { valid: false, message: 'Graph state must be an object.' };
  }
  if (!Array.isArray(data.nodes)) {
    return { valid: false, message: 'Graph state must include a nodes array.' };
  }
  if (!Array.isArray(data.edges)) {
    return { valid: false, message: 'Graph state must include an edges array.' };
  }
  if (data.nodes.length > 100) {
    return { valid: false, message: 'Graph state exceeds the 100-node display limit.' };
  }
  if (data.edges.length > 300) {
    return { valid: false, message: 'Graph state exceeds the 300-edge display limit.' };
  }

  const nodes: GraphNodeState[] = [];
  const nodeIds = new Set<string>();
  for (let index = 0; index < data.nodes.length; index++) {
    const rawNode = data.nodes[index];
    if (!isRecord(rawNode)) {
      return { valid: false, message: `Graph node ${index + 1} must be an object.` };
    }
    if (typeof rawNode.id !== 'string' || !rawNode.id.trim()) {
      return { valid: false, message: `Graph node ${index + 1} needs a non-empty string id.` };
    }
    if (nodeIds.has(rawNode.id)) {
      return { valid: false, message: `Graph contains duplicate node id "${rawNode.id}".` };
    }
    if (!isGraphValue(rawNode.value)) {
      return { valid: false, message: `Graph node "${rawNode.id}" has an unsupported value.` };
    }
    nodeIds.add(rawNode.id);
    nodes.push({ id: rawNode.id, value: rawNode.value as GraphNodeState['value'] });
  }

  const edgeIds = new Set<string>();
  const edges: GraphVisualState['edges'] = [];
  for (let index = 0; index < data.edges.length; index++) {
    const rawEdge = data.edges[index];
    if (!isRecord(rawEdge)) {
      return { valid: false, message: `Graph edge ${index + 1} must be an object.` };
    }
    if (typeof rawEdge.id !== 'string' || !rawEdge.id.trim()) {
      return { valid: false, message: `Graph edge ${index + 1} needs a non-empty string id.` };
    }
    if (edgeIds.has(rawEdge.id)) {
      return { valid: false, message: `Graph contains duplicate edge id "${rawEdge.id}".` };
    }
    if (typeof rawEdge.source !== 'string' || typeof rawEdge.target !== 'string') {
      return { valid: false, message: `Graph edge "${rawEdge.id}" needs string source and target ids.` };
    }
    if (!nodeIds.has(rawEdge.source) || !nodeIds.has(rawEdge.target)) {
      return { valid: false, message: `Graph edge "${rawEdge.id}" references a missing node.` };
    }
    if (rawEdge.weight !== undefined && !isGraphValue(rawEdge.weight)) {
      return { valid: false, message: `Graph edge "${rawEdge.id}" has an unsupported weight.` };
    }
    edgeIds.add(rawEdge.id);
    edges.push({
      id: rawEdge.id,
      source: rawEdge.source,
      target: rawEdge.target,
      weight: rawEdge.weight as GraphVisualState['edges'][number]['weight']
    });
  }

  if (data.visitedNodeIds !== undefined && (
    !Array.isArray(data.visitedNodeIds) || !data.visitedNodeIds.every((id) => typeof id === 'string')
  )) {
    return { valid: false, message: 'Graph visitedNodeIds must be a string array.' };
  }

  return {
    valid: true,
    state: {
      nodes,
      edges,
      directed: data.directed === true,
      activeNodeId: typeof data.activeNodeId === 'string' && nodeIds.has(data.activeNodeId)
        ? data.activeNodeId
        : undefined,
      activeEdgeId: typeof data.activeEdgeId === 'string' && edgeIds.has(data.activeEdgeId)
        ? data.activeEdgeId
        : undefined,
      visitedNodeIds: Array.isArray(data.visitedNodeIds)
        ? data.visitedNodeIds.filter((id) => nodeIds.has(id))
        : []
    }
  };
};

export const GraphVisualizer: React.FC<{ data?: unknown }> = ({ data }) => {
  const validation = validateGraphState(data);
  const arrowId = React.useId().replace(/:/g, '');
  if ('message' in validation) {
    return (
      <VisualizerStateMessage title="Graph visualization unavailable">
        {validation.message}
      </VisualizerStateMessage>
    );
  }

  if (validation.state.nodes.length === 0) {
    return (
      <VisualizerShell title="Graph" icon={<Waypoints className="h-3.5 w-3.5 text-indigo-400" />}>
        <VisualizerEmptyState label="Empty Graph" />
      </VisualizerShell>
    );
  }

  const width = 640;
  const height = validation.state.nodes.length === 1 ? 180 : 380;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(145, 45 + validation.state.nodes.length * 12);
  const positions = new Map(validation.state.nodes.map((node, index) => {
    const angle = validation.state.nodes.length === 1
      ? 0
      : (Math.PI * 2 * index) / validation.state.nodes.length - Math.PI / 2;
    return [node.id, {
      x: validation.state.nodes.length === 1 ? centerX : centerX + Math.cos(angle) * radius,
      y: validation.state.nodes.length === 1 ? centerY : centerY + Math.sin(angle) * radius
    }];
  }));
  const visited = new Set(validation.state.visitedNodeIds);

  return (
    <VisualizerShell
      title={validation.state.directed ? 'Directed Graph' : 'Graph'}
      icon={<Waypoints className="h-3.5 w-3.5 text-indigo-400" />}
    >
      <div className="overflow-x-auto pb-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[560px] w-full" role="img" aria-label="Algorithm graph state">
        <defs>
          <marker id={arrowId} viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-500" />
          </marker>
        </defs>
        {validation.state.edges.map((edge) => {
          const source = positions.get(edge.source) as { x: number; y: number };
          const target = positions.get(edge.target) as { x: number; y: number };
          const isActive = edge.id === validation.state.activeEdgeId;
          return (
            <g key={edge.id}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={cn(isActive ? 'stroke-indigo-400' : 'stroke-slate-600')}
                strokeWidth={isActive ? 3 : 2}
                markerEnd={validation.state.directed ? `url(#${arrowId})` : undefined}
              />
              {edge.weight !== undefined && (
                <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 7} textAnchor="middle" className="fill-slate-400 text-[11px] font-mono">
                  {formatVisualValue(edge.weight)}
                </text>
              )}
            </g>
          );
        })}
        {validation.state.nodes.map((node) => {
          const position = positions.get(node.id) as { x: number; y: number };
          const isActive = node.id === validation.state.activeNodeId;
          const isVisited = visited.has(node.id);
          return (
            <g key={node.id} transform={`translate(${position.x} ${position.y})`}>
              <circle
                r="24"
                className={cn(
                  'stroke-2',
                  isActive && 'fill-indigo-500 stroke-indigo-300',
                  !isActive && isVisited && 'fill-emerald-950 stroke-emerald-500',
                  !isActive && !isVisited && 'fill-slate-900 stroke-slate-600'
                )}
              />
              <text textAnchor="middle" dominantBaseline="central" className="fill-slate-100 text-xs font-bold font-mono">
                {formatVisualValue(node.value)}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
    </VisualizerShell>
  );
};
