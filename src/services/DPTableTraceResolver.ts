import {
  DPTableTraceBase,
  DPTableVisualDelta,
  DPTableVisualState
} from '../types';

const clonePosition = (position: { row: number; column: number }) => ({
  row: position.row,
  column: position.column
});

export const createDPTableState = (base: DPTableTraceBase): DPTableVisualState => {
  const values = Array.from(
    { length: base.rows },
    () => Array(base.columns).fill(null)
  );

  for (const cell of base.initialCells || []) {
    values[cell.row][cell.column] = cell.value;
  }

  return {
    values,
    ...(base.rowLabels ? { rowLabels: [...base.rowLabels] } : {}),
    ...(base.columnLabels ? { columnLabels: [...base.columnLabels] } : {}),
    highlightedCells: []
  };
};

export const applyDPTableDelta = (
  previousState: DPTableVisualState,
  delta: DPTableVisualDelta
): DPTableVisualState => {
  const values = previousState.values.map((row) => [...row]);

  for (const update of delta.updates || []) {
    values[update.row][update.column] = update.value;
  }

  const activeCell = delta.activeCell === null
    ? undefined
    : delta.activeCell
      ? clonePosition(delta.activeCell)
      : previousState.activeCell
        ? clonePosition(previousState.activeCell)
        : undefined;
  const highlightedCells = delta.highlightedCells === undefined
    ? (previousState.highlightedCells || []).map(clonePosition)
    : delta.highlightedCells.map(clonePosition);

  return {
    values,
    ...(previousState.rowLabels ? { rowLabels: [...previousState.rowLabels] } : {}),
    ...(previousState.columnLabels
      ? { columnLabels: [...previousState.columnLabels] }
      : {}),
    ...(activeCell ? { activeCell } : {}),
    highlightedCells
  };
};

export const foldDPTableTrace = (
  base: DPTableTraceBase,
  deltas: DPTableVisualDelta[]
): DPTableVisualState[] => {
  let currentState = createDPTableState(base);
  return deltas.map((delta) => {
    currentState = applyDPTableDelta(currentState, delta);
    return currentState;
  });
};
