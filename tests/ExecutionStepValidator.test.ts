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
