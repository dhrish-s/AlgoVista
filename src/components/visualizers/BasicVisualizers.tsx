import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { formatVisualValue } from '../../lib/formatVisualValue';
import { VisualizerShell } from './VisualizerShell';

interface ArrayVisualizerProps {
  data?: unknown;
  highlights?: unknown;
  pointers?: unknown;
  activeValue?: unknown;
}

export const ArrayVisualizer: React.FC<ArrayVisualizerProps> = ({ 
  data = [], 
  highlights = [], 
  pointers = {},
}) => {
  const safeData = Array.isArray(data) ? data : [];
  const safeHighlights = Array.isArray(highlights)
    ? highlights.filter((index): index is number => Number.isInteger(index))
    : [];
  const safePointers = pointers && typeof pointers === 'object' && !Array.isArray(pointers)
    ? Object.fromEntries(
        Object.entries(pointers).filter((entry): entry is [string, number] => Number.isInteger(entry[1]))
      )
    : {};

  if (safeData.length === 0) {
    return (
      <div className="p-4 border border-dashed border-slate-700 rounded-lg text-slate-500 text-xs text-center italic">
        Empty Array
      </div>
    );
  }

  return (
    <VisualizerShell title="Array" icon={<span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />}>
      <div className="relative w-full overflow-x-auto pb-2 pt-8">
      <div className="flex min-w-max justify-center gap-2 px-1">
        {safeData.map((item, idx) => {
          const isHighlighted = safeHighlights.includes(idx);
          const activePointers = Object.entries(safePointers)
            .filter(([_, pos]) => pos === idx)
            .map(([name]) => name);
          const isActive = activePointers.length > 0;

          return (
            <div key={idx} className="relative flex flex-none flex-col items-center">
              {/* Pointer Labels Above */}
              <div className="absolute -top-8 h-6 flex flex-col items-center">
                <AnimatePresence>
                  {activePointers.map((name) => (
                    <motion.div
                      key={name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter"
                    >
                      {name}
                      <motion.div className="w-0.5 h-2 bg-indigo-400 mx-auto" />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Data Box */}
              <motion.div
                layout
                initial={false}
                animate={{
                  scale: isActive ? 1.08 : isHighlighted ? 1.05 : 1,
                }}
                className={cn(
                  'w-12 h-12 flex items-center justify-center rounded-lg border-2 text-sm font-mono font-bold transition-colors shadow-md',
                  isActive && 'border-indigo-300 bg-indigo-500 text-white shadow-indigo-500/30',
                  !isActive && isHighlighted && 'border-emerald-500 bg-emerald-500/15 text-emerald-200',
                  !isActive && !isHighlighted && 'border-slate-700 bg-slate-900 text-slate-300'
                )}
              >
                {formatVisualValue(item)}
              </motion.div>

              {/* Index Labels Below */}
              <span className="mt-2 text-[10px] font-mono text-slate-500">
                {idx}
              </span>
            </div>
          );
        })}
      </div>
      </div>
    </VisualizerShell>
  );
};

export const HashMapVisualizer: React.FC<{ data?: unknown }> = ({ data }) => {
  const safeData = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  const entries = Object.entries(safeData);

  return (
    <VisualizerShell title="Hash Map (Lookups: O(1))" icon={<span className="h-1.5 w-1.5 rounded-full bg-purple-500" />}>
      {entries.length === 0 ? (
        <div className="text-xs text-slate-600 italic py-2">No entries yet</div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {entries.map(([key, value]) => (
              <motion.div
                key={key}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 p-2 bg-slate-800 rounded border border-slate-700"
              >
                <span className="text-[10px] font-mono text-indigo-400">{key}</span>
                <span className="text-slate-600 text-[10px]">→</span>
                <span className="text-sm font-mono text-white truncate" title={formatVisualValue(value)}>
                  {formatVisualValue(value)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </VisualizerShell>
  );
};
