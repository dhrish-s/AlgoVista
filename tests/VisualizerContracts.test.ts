import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDPTableState } from '../src/components/visualizers/DPTableVisualizer';
import { validateGraphState } from '../src/components/visualizers/GraphVisualizer';
import { validateTreeState } from '../src/components/visualizers/TreeVisualizer';

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
