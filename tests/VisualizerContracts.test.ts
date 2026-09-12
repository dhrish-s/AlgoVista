import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasSupportedVisualization, SUPPORTED_VISUAL_STATE_KEYS } from '../src/components/visualizer/VisualizerContainer';
import { validateDPTableState } from '../src/components/visualizers/DPTableVisualizer';
import { validateGraphState } from '../src/components/visualizers/GraphVisualizer';
import {
  buildLinkedListSegments,
  LinkedListVisualizer,
  validateLinkedListState
} from '../src/components/visualizers/LinkedListVisualizer';
import { validateTreeState } from '../src/components/visualizers/TreeVisualizer';
import { VisualState } from '../src/types';

test('accepts a connected tree and filters unknown traversal markers', () => {
  const result = validateTreeState({
    nodes: [
      { id: 'root', value: 4, children: ['left', 'right'] },
      { id: 'left', value: 2, children: [] },
      { id: 'right', value: 7, children: [] }
    ],
    rootId: 'root',
    activeNodeId: 'left',
    visitedNodeIds: ['root', 'missing']
  });

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.rootId, 'root');
    assert.deepEqual(result.state.visitedNodeIds, ['root']);
  }
});

test('rejects a tree that references a missing child', () => {
  const result = validateTreeState({
    nodes: [{ id: 'root', value: 4, children: ['missing'] }]
  });

  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.message, /missing child "missing"/);
  }
});

test('accepts an empty tree without inventing a root', () => {
  const result = validateTreeState({ nodes: [] });

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.rootId, undefined);
  }
});

test('accepts a graph and filters unknown traversal markers', () => {
  const result = validateGraphState({
    nodes: [
      { id: 'a', value: 'A' },
      { id: 'b', value: 'B' }
    ],
    edges: [{ id: 'a-b', source: 'a', target: 'b', weight: 3 }],
    activeNodeId: 'b',
    activeEdgeId: 'a-b',
    visitedNodeIds: ['a', 'missing']
  });

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.deepEqual(result.state.visitedNodeIds, ['a']);
    assert.equal(result.state.edges[0].weight, 3);
  }
});

test('rejects a graph edge that references a missing node', () => {
  const result = validateGraphState({
    nodes: [{ id: 'a', value: 'A' }],
    edges: [{ id: 'a-b', source: 'a', target: 'b' }]
  });

  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.message, /references a missing node/);
  }
});

test('rejects malformed graph traversal markers', () => {
  const result = validateGraphState({
    nodes: [{ id: 'a', value: 'A' }],
    edges: [],
    visitedNodeIds: 'a'
  });

  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.message, /visitedNodeIds must be a string array/);
  }
});

test('accepts an empty graph', () => {
  const result = validateGraphState({ nodes: [], edges: [] });
  assert.equal(result.valid, true);
});

test('accepts a rectangular DP table with labels and markers', () => {
  const result = validateDPTableState({
    values: [[0, 1, 1], [0, 1, 2]],
    rowLabels: ['none', 'a'],
    columnLabels: [0, 1, 2],
    activeCell: { row: 1, column: 2 },
    highlightedCells: [{ row: 1, column: 1 }]
  });

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.deepEqual(result.state.activeCell, { row: 1, column: 2 });
  }
});

test('rejects DP table rows with inconsistent lengths', () => {
  const result = validateDPTableState({ values: [[0, 1], [0]] });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.message, /same length/);
  }
});

test('rejects DP cell markers outside the table', () => {
  const result = validateDPTableState({
    values: [[0]],
    activeCell: { row: 1, column: 0 }
  });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.message, /outside the DP table/);
  }
});

test('accepts an empty DP table', () => {
  const result = validateDPTableState({ values: [] });
  assert.equal(result.valid, true);
});

test('accepts a multi-node linked list with current and highlighted nodes', () => {
  const result = validateLinkedListState({
    nodes: [
      { id: 'node-0', value: 1, nextId: 'node-1' },
      { id: 'node-1', value: 'two', nextId: 'node-2' },
      { id: 'node-2', value: 3, nextId: null }
    ],
    headId: 'node-0',
    activeNodeId: 'node-1',
    highlightedNodeIds: ['node-0', 'node-2', 'missing']
  });

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.state.nodes[2].nextId, null);
    assert.equal(result.state.activeNodeId, 'node-1');
    assert.deepEqual(result.state.highlightedNodeIds, ['node-0', 'node-2']);
  }
});

test('renders an empty linked list gracefully', () => {
  const markup = renderToStaticMarkup(React.createElement(LinkedListVisualizer, {
    data: { nodes: [], headId: null }
  }));

  assert.match(markup, /Empty Linked List/);
});

test('renders a single-node linked list with head and null termination', () => {
  const markup = renderToStaticMarkup(React.createElement(LinkedListVisualizer, {
    data: {
      nodes: [{ id: 'only', value: 'value', nextId: null }],
      headId: 'only'
    }
  }));

  assert.match(markup, /Head/);
  assert.match(markup, /value/);
  assert.match(markup, /null/);
});

test('rejects a linked-list node with an invalid next reference', () => {
  const result = validateLinkedListState({
    nodes: [{ id: 'head', value: 1, nextId: 'missing' }],
    headId: 'head'
  });

  assert.equal(result.valid, false);
  if (!result.valid) assert.match(result.message, /references missing next node "missing"/);
});

test('rejects missing and nonexistent linked-list heads', () => {
  const missingHead = validateLinkedListState({
    nodes: [{ id: 'node', value: 1, nextId: null }]
  });
  const unknownHead = validateLinkedListState({
    nodes: [{ id: 'node', value: 1, nextId: null }],
    headId: 'missing'
  });

  assert.equal(missingHead.valid, false);
  assert.equal(unknownHead.valid, false);
  if (!missingHead.valid) assert.match(missingHead.message, /must include a non-empty headId/);
  if (!unknownHead.valid) assert.match(unknownHead.message, /head "missing" does not exist/);
});

test('rejects duplicate and malformed linked-list node ids', () => {
  const duplicate = validateLinkedListState({
    nodes: [
      { id: 'same', value: 1, nextId: null },
      { id: 'same', value: 2, nextId: null }
    ],
    headId: 'same'
  });
  const malformed = validateLinkedListState({
    nodes: [{ id: '', value: 1, nextId: null }],
    headId: ''
  });

  assert.equal(duplicate.valid, false);
  assert.equal(malformed.valid, false);
});

test('rejects a linked-list node with a missing value', () => {
  const result = validateLinkedListState({
    nodes: [{ id: 'node', nextId: null }],
    headId: 'node'
  });

  assert.equal(result.valid, false);
  if (!result.valid) assert.match(result.message, /missing or unsupported value/);
});

test('bounds cyclic linked-list traversal and identifies the cycle target', () => {
  const validation = validateLinkedListState({
    nodes: [
      { id: 'a', value: 1, nextId: 'b' },
      { id: 'b', value: 2, nextId: 'c' },
      { id: 'c', value: 3, nextId: 'b' }
    ],
    headId: 'a'
  });

  assert.equal(validation.valid, true);
  if (validation.valid) {
    assert.deepEqual(buildLinkedListSegments(validation.state), [{
      nodeIds: ['a', 'b', 'c'],
      connectionTargetId: 'b'
    }]);
  }
});

test('preserves detached chains used by intermediate pointer states', () => {
  const validation = validateLinkedListState({
    nodes: [
      { id: 'one', value: 1, nextId: null },
      { id: 'two', value: 2, nextId: 'three' },
      { id: 'three', value: 3, nextId: null }
    ],
    headId: 'one'
  });

  assert.equal(validation.valid, true);
  if (validation.valid) {
    assert.deepEqual(buildLinkedListSegments(validation.state).map((segment) => segment.nodeIds), [
      ['one'], ['two', 'three']
    ]);
  }
});

test('routes every existing visual state and linked-list state safely', () => {
  const states: Record<(typeof SUPPORTED_VISUAL_STATE_KEYS)[number], VisualState> = {
    array: { array: [] },
    map: { map: {} },
    stack: { stack: [] },
    queue: { queue: [] },
    tree: { tree: { nodes: [] } },
    graph: { graph: { nodes: [], edges: [] } },
    dpTable: { dpTable: { values: [] } },
    linkedList: { linkedList: { nodes: [], headId: null } }
  };

  for (const key of SUPPORTED_VISUAL_STATE_KEYS) {
    assert.equal(hasSupportedVisualization(states[key]), true, `${String(key)} should be supported`);
  }
  assert.equal(hasSupportedVisualization({ indices: {} }), false);
});
