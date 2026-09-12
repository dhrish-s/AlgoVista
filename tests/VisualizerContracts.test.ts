import assert from 'node:assert/strict';
import test from 'node:test';
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
