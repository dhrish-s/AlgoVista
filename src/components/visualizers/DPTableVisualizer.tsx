import React from 'react';
import { Table2 } from 'lucide-react';
import { DPCellPosition, DPTableVisualState, VisualPrimitive } from '../../types';
import { cn } from '../../lib/utils';
import { formatVisualValue } from '../../lib/formatVisualValue';

type DPTableValidationResult =
  | { valid: true; state: DPTableVisualState }
  | { valid: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isCellValue = (value: unknown): value is VisualPrimitive => (
  value === null || ['string', 'number', 'boolean'].includes(typeof value)
);

const readPosition = (
  value: unknown,
  label: string,
  rowCount: number,
  columnCount: number
): DPCellPosition | { message: string } => {
  if (!isRecord(value) || !Number.isInteger(value.row) || !Number.isInteger(value.column)) {
    return { message: `${label} must contain integer row and column values.` };
  }
  const position = { row: value.row as number, column: value.column as number };
  if (position.row < 0 || position.row >= rowCount || position.column < 0 || position.column >= columnCount) {
    return { message: `${label} points outside the DP table.` };
  }
  return position;
};

export const validateDPTableState = (data: unknown): DPTableValidationResult => {
  if (!isRecord(data)) {
    return { valid: false, message: 'DP table state must be an object.' };
  }
  if (!Array.isArray(data.values)) {
    return { valid: false, message: 'DP table state must include a values matrix.' };
  }
  if (!data.values.every(Array.isArray)) {
    return { valid: false, message: 'Every DP table row must be an array.' };
  }

  const rowCount = data.values.length;
  const columnCount = rowCount > 0 ? data.values[0].length : 0;
  if (rowCount * columnCount > 2500) {
    return { valid: false, message: 'DP table exceeds the 2,500-cell display limit.' };
  }

  const values: VisualPrimitive[][] = [];
  for (let row = 0; row < rowCount; row++) {
    if (data.values[row].length !== columnCount) {
      return { valid: false, message: 'DP table rows must all have the same length.' };
    }
    if (!data.values[row].every(isCellValue)) {
      return { valid: false, message: `DP table row ${row + 1} contains an unsupported value.` };
    }
    values.push([...data.values[row]] as VisualPrimitive[]);
  }

  const readLabels = (raw: unknown, expectedLength: number, label: string): VisualPrimitive[] | { message: string } => {
    if (raw === undefined) return [];
    if (!Array.isArray(raw) || !raw.every(isCellValue)) {
      return { message: `${label} must be an array of primitive values.` };
    }
    if (raw.length !== expectedLength) {
      return { message: `${label} length must match the DP table dimension.` };
    }
    return [...raw];
  };

  const rowLabels = readLabels(data.rowLabels, rowCount, 'rowLabels');
  if ('message' in rowLabels) return { valid: false, message: rowLabels.message };
  const columnLabels = readLabels(data.columnLabels, columnCount, 'columnLabels');
  if ('message' in columnLabels) return { valid: false, message: columnLabels.message };

  let activeCell: DPCellPosition | undefined;
  if (data.activeCell !== undefined) {
    const parsed = readPosition(data.activeCell, 'activeCell', rowCount, columnCount);
    if ('message' in parsed) return { valid: false, message: parsed.message };
    activeCell = parsed;
  }

  if (data.highlightedCells !== undefined && !Array.isArray(data.highlightedCells)) {
    return { valid: false, message: 'highlightedCells must be an array of cell positions.' };
  }
  const highlightedCells: DPCellPosition[] = [];
  const rawHighlights = Array.isArray(data.highlightedCells) ? data.highlightedCells : [];
  for (const rawPosition of rawHighlights) {
    const parsed = readPosition(rawPosition, 'highlightedCells', rowCount, columnCount);
    if ('message' in parsed) return { valid: false, message: parsed.message };
    highlightedCells.push(parsed);
  }

  return {
    valid: true,
    state: {
      values,
      rowLabels: data.rowLabels === undefined ? undefined : rowLabels,
      columnLabels: data.columnLabels === undefined ? undefined : columnLabels,
      activeCell,
      highlightedCells
    }
  };
};

const cellKey = ({ row, column }: DPCellPosition) => `${row}:${column}`;

export const DPTableVisualizer: React.FC<{ data?: unknown }> = ({ data }) => {
  const validation = validateDPTableState(data);
  if ('message' in validation) {
    return (
      <div className="w-full max-w-xl p-5 border border-amber-500/30 bg-amber-500/5 rounded-xl text-center">
        <p className="text-xs font-bold text-amber-300">DP table visualization unavailable</p>
        <p className="mt-1 text-[11px] text-amber-200/70">{validation.message}</p>
      </div>
    );
  }

  if (validation.state.values.length === 0) {
    return (
      <div className="p-5 border border-dashed border-slate-700 rounded-xl text-xs text-slate-500 text-center">
        Empty DP Table
      </div>
    );
  }

  const highlighted = new Set((validation.state.highlightedCells || []).map(cellKey));
  const hasRowLabels = validation.state.rowLabels !== undefined;
  const hasColumnLabels = validation.state.columnLabels !== undefined;

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
      <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        <Table2 className="h-3.5 w-3.5 text-indigo-400" />
        Dynamic Programming Table
      </div>
      <div className="overflow-auto">
        <table className="mx-auto border-separate border-spacing-1 font-mono text-xs">
          {hasColumnLabels && (
            <thead>
              <tr>
                {hasRowLabels && <th aria-label="row labels" />}
                {validation.state.columnLabels?.map((label, column) => (
                  <th key={column} className="min-w-12 px-2 py-2 text-center text-[10px] font-bold text-slate-500">
                    {formatVisualValue(label)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {validation.state.values.map((rowValues, row) => (
              <tr key={row}>
                {hasRowLabels && (
                  <th className="px-3 text-right text-[10px] font-bold text-slate-500">
                    {formatVisualValue(validation.state.rowLabels?.[row])}
                  </th>
                )}
                {rowValues.map((value, column) => {
                  const isActive = validation.state.activeCell?.row === row && validation.state.activeCell.column === column;
                  const isHighlighted = highlighted.has(`${row}:${column}`);
                  return (
                    <td
                      key={column}
                      className={cn(
                        'min-w-12 rounded-lg border px-3 py-3 text-center font-bold transition-colors',
                        isActive && 'border-indigo-300 bg-indigo-500 text-white shadow-lg shadow-indigo-500/20',
                        !isActive && isHighlighted && 'border-emerald-500 bg-emerald-500/15 text-emerald-200',
                        !isActive && !isHighlighted && 'border-slate-800 bg-slate-900 text-slate-300'
                      )}
                    >
                      {formatVisualValue(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
