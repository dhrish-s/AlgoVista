import {
  DPCellPosition,
  DPCellUpdate,
  DPTableTraceBase,
  DPTableVisualDelta,
  DPTableVisualState,
  ExecutionStep,
  VisualPrimitive
} from '../types';
import { applyDPTableDelta, createDPTableState } from './DPTableTraceResolver';

type UnknownRecord = Record<string, unknown>;

export interface DPTableTraceValidationResult {
  steps: ExecutionStep[];
  errors: string[];
}

const MAX_DP_CELLS = 2500;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isVisualPrimitive = (value: unknown): value is VisualPrimitive => (
  value === null || ['string', 'number', 'boolean'].includes(typeof value)
);

const parseDimension = (value: unknown, field: string): number => {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  if ((value as number) > MAX_DP_CELLS) {
    throw new Error(`${field} exceeds the ${MAX_DP_CELLS} limit`);
  }
  return value as number;
};

const parsePosition = (
  value: unknown,
  field: string,
  rows: number,
  columns: number
): DPCellPosition => {
  if (!isRecord(value) || !Number.isInteger(value.row) || !Number.isInteger(value.column)) {
    throw new Error(`${field} must contain integer row and column values`);
  }
  const position = { row: value.row as number, column: value.column as number };
  if (position.row < 0 || position.row >= rows
    || position.column < 0 || position.column >= columns) {
    throw new Error(`${field} points outside the ${rows}x${columns} DP table`);
  }
  return position;
};

const parsePositions = (
  value: unknown,
  field: string,
  rows: number,
  columns: number
): DPCellPosition[] => {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const positions = value.map((position, index) => (
    parsePosition(position, `${field}[${index}]`, rows, columns)
  ));
  const keys = positions.map(({ row, column }) => `${row}:${column}`);
  if (new Set(keys).size !== keys.length) throw new Error(`${field} contains duplicate cells`);
  return positions;
};

const parseUpdates = (
  value: unknown,
  field: string,
  rows: number,
  columns: number
): DPCellUpdate[] => {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const updates = value.map((entry, index) => {
    const entryField = `${field}[${index}]`;
    const position = parsePosition(entry, entryField, rows, columns);
    if (!isRecord(entry) || !isVisualPrimitive(entry.value)) {
      throw new Error(`${entryField}.value must be a string, number, boolean, or null`);
    }
    return { ...position, value: entry.value };
  });
  const keys = updates.map(({ row, column }) => `${row}:${column}`);
  if (new Set(keys).size !== keys.length) throw new Error(`${field} contains duplicate cells`);
  return updates;
};

const parseLabels = (
  value: unknown,
  field: string,
  expectedLength: number
): VisualPrimitive[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every(isVisualPrimitive)) {
    throw new Error(`${field} must be an array of primitive values`);
  }
  if (value.length !== expectedLength) {
    throw new Error(`${field} length must match the DP table dimension`);
  }
  return [...value];
};

const parseDPTableBase = (value: unknown): DPTableTraceBase => {
  if (!isRecord(value)) throw new Error('dpTableBase must be an object');
  const rows = parseDimension(value.rows, 'dpTableBase.rows');
  const columns = parseDimension(value.columns, 'dpTableBase.columns');
  if (rows * columns > MAX_DP_CELLS) {
    throw new Error(`dpTableBase exceeds the ${MAX_DP_CELLS}-cell limit`);
  }
  return {
    rows,
    columns,
    initialCells: value.initialCells === undefined
      ? undefined
      : parseUpdates(value.initialCells, 'dpTableBase.initialCells', rows, columns),
    rowLabels: parseLabels(value.rowLabels, 'dpTableBase.rowLabels', rows),
    columnLabels: parseLabels(value.columnLabels, 'dpTableBase.columnLabels', columns)
  };
};

const parseDPTableDelta = (
  value: unknown,
  rows: number,
  columns: number
): DPTableVisualDelta => {
  if (!isRecord(value)) throw new Error('dpTableDelta must be an object');
  return {
    updates: value.updates === undefined
      ? undefined
      : parseUpdates(value.updates, 'dpTableDelta.updates', rows, columns),
    activeCell: value.activeCell === undefined || value.activeCell === null
      ? value.activeCell as null | undefined
      : parsePosition(value.activeCell, 'dpTableDelta.activeCell', rows, columns),
    highlightedCells: value.highlightedCells === undefined
      ? undefined
      : parsePositions(
        value.highlightedCells,
        'dpTableDelta.highlightedCells',
        rows,
        columns
      )
  };
};

const resolvedStep = (step: ExecutionStep, dpTable: DPTableVisualState): ExecutionStep => {
  const { dpTableBase: _dpTableBase, dpTableDelta: _dpTableDelta, ...visualState } = step.visualState;
  return { ...step, visualState: { ...visualState, dpTable } };
};

export const resolveDPTableTraceSteps = (
  steps: ExecutionStep[]
): DPTableTraceValidationResult => {
  const resolvedSteps: ExecutionStep[] = [];
  const errors: string[] = [];
  let currentState: DPTableVisualState | undefined;
  let dimensions: { rows: number; columns: number } | undefined;

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    const hasBase = step.visualState.dpTableBase !== undefined;
    const hasDelta = step.visualState.dpTableDelta !== undefined;

    if (!hasBase && !hasDelta && !currentState) {
      resolvedSteps.push(step);
      continue;
    }

    try {
      if (!currentState) {
        if (!hasBase) throw new Error('DP table delta appears before dpTableBase');
        if (!hasDelta) throw new Error('the first DP table step must include dpTableDelta');
        const base = parseDPTableBase(step.visualState.dpTableBase);
        const baseState = createDPTableState(base);
        const delta = parseDPTableDelta(step.visualState.dpTableDelta, base.rows, base.columns);
        currentState = applyDPTableDelta(baseState, delta);
        dimensions = { rows: base.rows, columns: base.columns };
      } else {
        if (hasBase) throw new Error('dpTableBase may only appear on the first DP table step');
        if (!hasDelta) throw new Error('DP table step is missing dpTableDelta');
        if (!dimensions) throw new Error('DP table dimensions are unavailable');
        const delta = parseDPTableDelta(
          step.visualState.dpTableDelta,
          dimensions.rows,
          dimensions.columns
        );
        currentState = applyDPTableDelta(currentState, delta);
      }
      resolvedSteps.push(resolvedStep(step, currentState));
    } catch (error) {
      errors.push(`Step ${index}: ${error instanceof Error ? error.message : String(error)}`);
      if (!currentState) return { steps: [], errors };
    }
  }

  return { steps: resolvedSteps, errors };
};
