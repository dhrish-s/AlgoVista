import assert from 'node:assert/strict';
import test from 'node:test';
import { ExecutionStep, OperationType } from '../src/types';
import { validateExecutionSteps } from '../src/services/ExecutionStepValidator';

const createStep = (id: string, operationType: OperationType): ExecutionStep => ({
  id,
  line: 1,
  explanation: `Execute ${id}`,
  operationType,
  variables: {},
  visualState: { array: [1, 2, 3] }
});

test('rejects an empty execution trace', () => {
  const result = validateExecutionSteps([]);

  assert.equal(result.valid, false);
  assert.equal(result.steps.length, 0);
  assert.match(result.error || '', /No valid steps found/);
});

test('rejects a trace where every step is malformed', () => {
  const result = validateExecutionSteps([
    null,
    { id: '', line: 0, explanation: 'Missing an id', operationType: 'init', variables: {}, visualState: {} },
    { id: 'bad-operation', line: 1, explanation: 'Unknown operation', operationType: 'unknown', variables: {}, visualState: {} }
  ]);

  assert.equal(result.valid, false);
  assert.equal(result.steps.length, 0);
  assert.match(result.error || '', /No valid steps found/);
});

test('accepts a legitimately short three-step trace', () => {
  const result = validateExecutionSteps([
    createStep('initialize', 'init'),
    createStep('compare', 'compare'),
    createStep('finish', 'return')
  ]);

  assert.equal(result.valid, true);
  assert.equal(result.steps.length, 3);
  assert.equal(result.isTruncated, false);
  assert.equal(result.rejectedStepCount, 0);
  assert.deepEqual(result.steps.map((step) => step.id), ['initialize', 'compare', 'finish']);
});

test('reports malformed steps retained alongside a usable partial trace', () => {
  const result = validateExecutionSteps([
    createStep('initialize', 'init'),
    { id: '', line: 2, explanation: 'Missing an id', operationType: 'compare', variables: {}, visualState: {} },
    createStep('finish', 'return')
  ]);

  assert.equal(result.valid, true);
  assert.equal(result.steps.length, 2);
  assert.equal(result.rejectedStepCount, 1);
  assert.match(result.warning || '', /Step 1: missing or invalid id/);
});

test('rejects generated trace lines outside the known source range', () => {
  const result = validateExecutionSteps([
    createStep('initialize', 'init'),
    { ...createStep('outside-source', 'compare'), line: 4 }
  ], { sourceLineCount: 3 });

  assert.equal(result.valid, true);
  assert.deepEqual(result.steps.map((step) => step.id), ['initialize']);
  assert.equal(result.rejectedStepCount, 1);
  assert.match(result.warning || '', /outside the generated source range 1-3/);
});

test('rejects a generated trace when every line is outside the source range', () => {
  const result = validateExecutionSteps([
    { ...createStep('zero', 'init'), line: 0 },
    { ...createStep('too-large', 'return'), line: 5 }
  ], { sourceLineCount: 3 });

  assert.equal(result.valid, false);
  assert.equal(result.steps.length, 0);
  assert.match(result.error || '', /No valid steps found/);
});

test('bounds Python trace lines to the installed source', () => {
  const pythonCode = 'class Solution:\n    def solve(self):\n        value = True\n        return value';
  const result = validateExecutionSteps([
    { ...createStep('assign', 'assign'), line: 3 },
    { ...createStep('outside-python', 'return'), line: 5 }
  ], { sourceLineCount: pythonCode.split(/\r?\n/).length });

  assert.equal(result.valid, true);
  assert.deepEqual(result.steps.map((step) => step.id), ['assign']);
  assert.match(result.warning || '', /outside the generated source range 1-4/);
});

test('normalizes array values, pointers, and highlighted indices', () => {
  const step = createStep('scan', 'move-pointer');
  const result = validateExecutionSteps([{
    ...step,
    visualState: {
      nums: [3, { value: 1 }, 2],
      pointers: { left: '0', right: 2, invalid: 'end' },
      highlightedIndices: ['0', 2, 'right']
    }
  }]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.steps[0].visualState.array, [3, { value: 1 }, 2]);
  assert.deepEqual(result.steps[0].visualState.indices, { left: 0, right: 2 });
  assert.deepEqual(result.steps[0].visualState.highlights, [0, 2]);
});

test('normalizes hash map aliases and entry-pair arrays', () => {
  const step = createStep('lookup', 'lookup-map');
  const result = validateExecutionSteps([{
    ...step,
    visualState: {
      dictionary: [['first', 1], [2, { seen: true }]]
    }
  }]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.steps[0].visualState.map, {
    first: 1,
    '2': { seen: true }
  });
});

test('normalizes stack aliases and item wrappers', () => {
  const step = createStep('push', 'push-stack');
  const result = validateExecutionSteps([{
    ...step,
    visualState: {
      callStack: { items: ['main', { frame: 'scan' }] }
    }
  }]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.steps[0].visualState.stack, ['main', { frame: 'scan' }]);
});

test('normalizes queue aliases and item wrappers', () => {
  const step = createStep('enqueue', 'enqueue');
  const result = validateExecutionSteps([{
    ...step,
    visualState: {
      bfsQueue: { items: [0, { node: 1 }] }
    }
  }]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.steps[0].visualState.queue, [0, { node: 1 }]);
});

const treeNodes = [
  { id: 'root', value: 5, children: ['left', 'right'] },
  { id: 'left', value: 2, children: [] },
  { id: 'right', value: 8, children: [] }
];

const createTreeStep = (id: string, visualState: ExecutionStep['visualState']): ExecutionStep => ({
  id,
  line: 1,
  explanation: `Execute ${id}`,
  operationType: 'visit-node',
  variables: {},
  visualState
});

test('precomputes immutable tree snapshots for direct step-index access', () => {
  const result = validateExecutionSteps([
    createTreeStep('visit-root', {
      treeBase: { nodes: treeNodes, rootId: 'root' },
      treeDelta: { activeNodeId: 'root', highlightNodeIds: ['root'] }
    }),
    createTreeStep('visit-left', {
      treeDelta: { activeNodeId: 'left', highlightNodeIds: ['left'] }
    }),
    createTreeStep('update-and-visit-right', {
      treeDelta: {
        activeNodeId: 'right',
        highlightNodeIds: ['right'],
        unhighlightNodeIds: ['root'],
        updateNodes: [{ id: 'left', value: 3 }]
      }
    })
  ]);

  assert.equal(result.valid, true);
  assert.equal(result.steps.length, 3);
  assert.equal(result.steps[0].visualState.tree?.activeNodeId, 'root');
  assert.deepEqual(result.steps[1].visualState.tree?.visitedNodeIds, ['root', 'left']);
  assert.equal(result.steps[2].visualState.tree?.activeNodeId, 'right');
  assert.deepEqual(result.steps[2].visualState.tree?.visitedNodeIds, ['left', 'right']);
  assert.equal(result.steps[0].visualState.tree?.nodes[1].value, 2);
  assert.equal(result.steps[2].visualState.tree?.nodes[1].value, 3);
  assert.equal(result.steps[2].visualState.treeBase, undefined);
  assert.equal(result.steps[2].visualState.treeDelta, undefined);
});

test('rejects a malformed tree base before accepting the trace', () => {
  const result = validateExecutionSteps([
    createStep('setup', 'init'),
    createTreeStep('bad-tree', {
      treeBase: {
        nodes: [{ id: 'root', value: 5, children: ['missing'] }],
        rootId: 'root'
      },
      treeDelta: {}
    })
  ]);

  assert.equal(result.valid, false);
  assert.equal(result.steps.length, 0);
  assert.match(result.error || '', /references missing child "missing"/);
});

test('skips an invalid later tree delta and folds the next valid delta', () => {
  const result = validateExecutionSteps([
    createTreeStep('visit-root', {
      treeBase: { nodes: treeNodes, rootId: 'root' },
      treeDelta: { activeNodeId: 'root' }
    }),
    createTreeStep('visit-missing', {
      treeDelta: { activeNodeId: 'missing' }
    }),
    createTreeStep('visit-right', {
      treeDelta: { activeNodeId: 'right', highlightNodeIds: ['right'] }
    })
  ]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.steps.map((step) => step.id), ['visit-root', 'visit-right']);
  assert.equal(result.rejectedStepCount, 1);
  assert.match(result.warning || '', /active tree node "missing" does not exist/);
  assert.equal(result.steps[1].visualState.tree?.activeNodeId, 'right');
});

test('folds coordinated tree node additions and removals', () => {
  const result = validateExecutionSteps([
    createTreeStep('base', {
      treeBase: {
        nodes: [
          { id: 'root', value: 5, children: ['left'] },
          { id: 'left', value: 2, children: [] }
        ],
        rootId: 'root'
      },
      treeDelta: {}
    }),
    createTreeStep('add-right', {
      treeDelta: {
        addNodes: [{ id: 'right', value: 8, children: [] }],
        updateNodes: [{ id: 'root', children: ['left', 'right'] }]
      }
    }),
    createTreeStep('remove-left', {
      treeDelta: {
        removeNodeIds: ['left'],
        updateNodes: [{ id: 'root', children: ['right'] }]
      }
    })
  ]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.steps[1].visualState.tree?.nodes.map((node) => node.id), [
    'root', 'left', 'right'
  ]);
  assert.deepEqual(result.steps[2].visualState.tree?.nodes.map((node) => node.id), [
    'root', 'right'
  ]);
  assert.deepEqual(result.steps[2].visualState.tree?.nodes[0].children, ['right']);
});

const graphNodes = [
  { id: 'a', value: 'A' },
  { id: 'b', value: 'B' },
  { id: 'c', value: 'C' }
];
const graphEdges = [
  { id: 'a-b', source: 'a', target: 'b' },
  { id: 'b-c', source: 'b', target: 'c' },
  { id: 'c-a', source: 'c', target: 'a' }
];

const createGraphStep = (id: string, visualState: ExecutionStep['visualState']): ExecutionStep => ({
  id,
  line: 1,
  explanation: `Execute ${id}`,
  operationType: 'visit-node',
  variables: {},
  visualState
});

test('precomputes cyclic graph snapshots for direct step-index access', () => {
  const result = validateExecutionSteps([
    createGraphStep('visit-a', {
      graphBase: { nodes: graphNodes, edges: graphEdges, directed: true },
      graphDelta: { activeNodeId: 'a', visitNodeIds: ['a'] }
    }),
    createGraphStep('traverse-a-b', {
      graphDelta: {
        activeNodeId: 'b', activeEdgeId: 'a-b',
        visitNodeIds: ['b'], traverseEdgeIds: ['a-b']
      }
    }),
    createGraphStep('traverse-b-c', {
      graphDelta: {
        activeNodeId: 'c', activeEdgeId: 'b-c',
        visitNodeIds: ['c'], traverseEdgeIds: ['b-c']
      }
    }),
    createGraphStep('close-cycle', {
      graphDelta: { activeEdgeId: 'c-a', traverseEdgeIds: ['c-a'] }
    })
  ]);

  assert.equal(result.valid, true);
  assert.equal(result.steps.length, 4);
  assert.deepEqual(result.steps[0].visualState.graph?.visitedNodeIds, ['a']);
  assert.deepEqual(result.steps[2].visualState.graph?.visitedNodeIds, ['a', 'b', 'c']);
  assert.deepEqual(result.steps[3].visualState.graph?.traversedEdgeIds, ['a-b', 'b-c', 'c-a']);
  assert.equal(result.steps[3].visualState.graph?.activeEdgeId, 'c-a');
  assert.deepEqual(result.steps[0].visualState.graph?.traversedEdgeIds, []);
  assert.equal(result.steps[3].visualState.graphBase, undefined);
  assert.equal(result.steps[3].visualState.graphDelta, undefined);
});

test('rejects a malformed graph base before accepting the trace', () => {
  const result = validateExecutionSteps([
    createStep('setup', 'init'),
    createGraphStep('bad-graph', {
      graphBase: {
        nodes: [{ id: 'a', value: 'A' }],
        edges: [{ id: 'a-b', source: 'a', target: 'missing' }]
      },
      graphDelta: {}
    })
  ]);

  assert.equal(result.valid, false);
  assert.equal(result.steps.length, 0);
  assert.match(result.error || '', /edge "a-b" references a missing node/);
});

test('skips invalid later graph references and folds the next valid delta', () => {
  const result = validateExecutionSteps([
    createGraphStep('visit-a', {
      graphBase: { nodes: graphNodes, edges: graphEdges },
      graphDelta: { activeNodeId: 'a', visitNodeIds: ['a'] }
    }),
    createGraphStep('missing-edge', {
      graphDelta: { activeEdgeId: 'missing', traverseEdgeIds: ['missing'] }
    }),
    createGraphStep('missing-node', {
      graphDelta: { activeNodeId: 'missing', visitNodeIds: ['missing'] }
    }),
    createGraphStep('visit-b', {
      graphDelta: { activeNodeId: 'b', visitNodeIds: ['b'], traverseEdgeIds: ['a-b'] }
    })
  ]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.steps.map((step) => step.id), ['visit-a', 'visit-b']);
  assert.equal(result.rejectedStepCount, 2);
  assert.match(result.warning || '', /missing edge "missing"/);
  assert.match(result.warning || '', /missing node "missing"/);
  assert.deepEqual(result.steps[1].visualState.graph?.visitedNodeIds, ['a', 'b']);
});

test('folds graph node and edge additions and removals atomically', () => {
  const result = validateExecutionSteps([
    createGraphStep('base', {
      graphBase: {
        nodes: [{ id: 'a', value: 'A' }, { id: 'b', value: 'B' }],
        edges: [{ id: 'a-b', source: 'a', target: 'b' }]
      },
      graphDelta: {}
    }),
    createGraphStep('add-c', {
      graphDelta: {
        addNodes: [{ id: 'c', value: 'C' }],
        addEdges: [{ id: 'b-c', source: 'b', target: 'c' }]
      }
    }),
    createGraphStep('remove-b', {
      graphDelta: { removeNodeIds: ['b'] }
    })
  ]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.steps[1].visualState.graph?.edges.map((edge) => edge.id), ['a-b', 'b-c']);
  assert.deepEqual(result.steps[2].visualState.graph?.nodes.map((node) => node.id), ['a', 'c']);
  assert.deepEqual(result.steps[2].visualState.graph?.edges, []);
});

const createDPTableStep = (
  id: string,
  visualState: ExecutionStep['visualState']
): ExecutionStep => ({
  id,
  line: 1,
  explanation: `Execute ${id}`,
  operationType: 'update-dp',
  variables: {},
  visualState
});

test('precomputes DP table snapshots with batched row updates for direct access', () => {
  const result = validateExecutionSteps([
    createDPTableStep('base-cases', {
      dpTableBase: {
        rows: 3,
        columns: 4,
        initialCells: [
          { row: 0, column: 0, value: 1 },
          { row: 0, column: 1, value: 1 },
          { row: 0, column: 2, value: 1 },
          { row: 0, column: 3, value: 1 },
          { row: 1, column: 0, value: 1 },
          { row: 2, column: 0, value: 1 }
        ],
        rowLabels: [1, 2, 3],
        columnLabels: [1, 2, 3, 4]
      },
      dpTableDelta: {
        activeCell: { row: 0, column: 0 },
        highlightedCells: [{ row: 0, column: 0 }]
      }
    }),
    createDPTableStep('fill-second-row', {
      dpTableDelta: {
        updates: [
          { row: 1, column: 1, value: 2 },
          { row: 1, column: 2, value: 3 },
          { row: 1, column: 3, value: 4 }
        ],
        activeCell: { row: 1, column: 3 },
        highlightedCells: [
          { row: 1, column: 1 },
          { row: 1, column: 2 },
          { row: 1, column: 3 }
        ]
      }
    }),
    createDPTableStep('fill-third-row', {
      dpTableDelta: {
        updates: [
          { row: 2, column: 1, value: 3 },
          { row: 2, column: 2, value: 6 },
          { row: 2, column: 3, value: 10 }
        ],
        activeCell: { row: 2, column: 3 },
        highlightedCells: [{ row: 2, column: 3 }]
      }
    })
  ]);

  assert.equal(result.valid, true);
  assert.equal(result.steps.length, 3);
  assert.deepEqual(result.steps[2].visualState.dpTable?.values, [
    [1, 1, 1, 1],
    [1, 2, 3, 4],
    [1, 3, 6, 10]
  ]);
  assert.deepEqual(result.steps[1].visualState.dpTable?.values[1], [1, 2, 3, 4]);
  assert.deepEqual(result.steps[0].visualState.dpTable?.values[1], [1, null, null, null]);
  assert.deepEqual(result.steps[2].visualState.dpTable?.activeCell, { row: 2, column: 3 });
  assert.equal(result.steps[2].visualState.dpTableBase, undefined);
  assert.equal(result.steps[2].visualState.dpTableDelta, undefined);
});

test('rejects a malformed DP table base before accepting the trace', () => {
  const result = validateExecutionSteps([
    createStep('setup', 'init'),
    createDPTableStep('bad-table', {
      dpTableBase: { rows: 2, columns: 3, rowLabels: ['only-one'] },
      dpTableDelta: {}
    })
  ]);

  assert.equal(result.valid, false);
  assert.equal(result.steps.length, 0);
  assert.match(result.error || '', /rowLabels length must match/);
});

test('skips out-of-bounds DP deltas and folds the next valid update', () => {
  const result = validateExecutionSteps([
    createDPTableStep('initialize', {
      dpTableBase: { rows: 2, columns: 2 },
      dpTableDelta: { updates: [{ row: 0, column: 0, value: 1 }] }
    }),
    createDPTableStep('bad-row', {
      dpTableDelta: { updates: [{ row: 2, column: 0, value: 2 }] }
    }),
    createDPTableStep('bad-column', {
      dpTableDelta: { activeCell: { row: 0, column: 2 } }
    }),
    createDPTableStep('continue', {
      dpTableDelta: {
        updates: [{ row: 1, column: 1, value: 2 }],
        activeCell: { row: 1, column: 1 }
      }
    })
  ]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.steps.map((step) => step.id), ['initialize', 'continue']);
  assert.equal(result.rejectedStepCount, 2);
  assert.match(result.warning || '', /updates\[0\] points outside the 2x2 DP table/);
  assert.match(result.warning || '', /activeCell points outside the 2x2 DP table/);
  assert.deepEqual(result.steps[1].visualState.dpTable?.values, [[1, null], [null, 2]]);
});

const linkedListNodes = [
  { id: 'one', value: 1, nextId: 'two' },
  { id: 'two', value: 2, nextId: 'three' },
  { id: 'three', value: 3, nextId: null }
];

const createLinkedListStep = (
  id: string,
  visualState: ExecutionStep['visualState']
): ExecutionStep => ({
  id,
  line: 1,
  explanation: `Execute ${id}`,
  operationType: 'move-pointer',
  variables: {},
  visualState
});

test('precomputes every linked-list reversal snapshot for direct step access', () => {
  const result = validateExecutionSteps([
    createLinkedListStep('initialize', {
      linkedListBase: { nodes: linkedListNodes, headId: 'one' },
      linkedListDelta: { activeNodeId: 'one', highlightedNodeIds: ['one'] }
    }),
    createLinkedListStep('reverse-one', {
      linkedListDelta: {
        nextUpdates: [{ id: 'one', nextId: null }],
        activeNodeId: 'two',
        highlightedNodeIds: ['one', 'two']
      }
    }),
    createLinkedListStep('reverse-two', {
      linkedListDelta: {
        nextUpdates: [{ id: 'two', nextId: 'one' }],
        headId: 'two',
        activeNodeId: 'three',
        highlightedNodeIds: ['two', 'three']
      }
    }),
    createLinkedListStep('reverse-three', {
      linkedListDelta: {
        nextUpdates: [{ id: 'three', nextId: 'two' }],
        headId: 'three',
        activeNodeId: null,
        highlightedNodeIds: ['three']
      }
    })
  ]);

  assert.equal(result.valid, true);
  assert.equal(result.steps.length, 4);
  assert.deepEqual(result.steps[3].visualState.linkedList?.nodes.map((node) => node.nextId), [
    null, 'one', 'two'
  ]);
  assert.equal(result.steps[3].visualState.linkedList?.headId, 'three');
  assert.equal(result.steps[2].visualState.linkedList?.headId, 'two');
  assert.equal(result.steps[2].visualState.linkedList?.nodes[2].nextId, null);
  assert.equal(result.steps[1].visualState.linkedList?.nodes[1].nextId, 'three');
  assert.equal(result.steps[0].visualState.linkedList?.nodes[0].nextId, 'two');
  assert.equal(result.steps[3].visualState.linkedListBase, undefined);
  assert.equal(result.steps[3].visualState.linkedListDelta, undefined);
});

test('rejects a malformed linked-list base before accepting the trace', () => {
  const result = validateExecutionSteps([
    createStep('setup', 'init'),
    createLinkedListStep('bad-list', {
      linkedListBase: {
        nodes: [{ id: 'head', value: 1, nextId: 'missing' }],
        headId: 'head'
      },
      linkedListDelta: {}
    })
  ]);

  assert.equal(result.valid, false);
  assert.equal(result.steps.length, 0);
  assert.match(result.error || '', /references missing next node "missing"/);
});

test('skips invalid linked-list delta references and folds the next valid pointer change', () => {
  const result = validateExecutionSteps([
    createLinkedListStep('initialize', {
      linkedListBase: { nodes: linkedListNodes, headId: 'one' },
      linkedListDelta: {}
    }),
    createLinkedListStep('missing-source', {
      linkedListDelta: { nextUpdates: [{ id: 'missing', nextId: null }] }
    }),
    createLinkedListStep('missing-target', {
      linkedListDelta: { nextUpdates: [{ id: 'one', nextId: 'missing' }] }
    }),
    createLinkedListStep('continue', {
      linkedListDelta: {
        nextUpdates: [{ id: 'one', nextId: null }],
        activeNodeId: 'two'
      }
    })
  ]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.steps.map((step) => step.id), ['initialize', 'continue']);
  assert.equal(result.rejectedStepCount, 2);
  assert.match(result.warning || '', /cannot update missing linked-list node "missing"/);
  assert.match(result.warning || '', /references missing next node "missing"/);
  assert.equal(result.steps[1].visualState.linkedList?.nodes[0].nextId, null);
  assert.equal(result.steps[1].visualState.linkedList?.nodes[1].nextId, 'three');
});
