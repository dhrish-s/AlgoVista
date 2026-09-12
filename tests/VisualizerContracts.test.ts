import assert from 'node:assert/strict';
import test from 'node:test';
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
