import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { formatVisualValue } from '../../lib/formatVisualValue';
import { VisualizerShell } from './VisualizerShell';
import { VisualizerEmptyState } from './VisualizerEmptyState';

export const StackVisualizer: React.FC<{ data?: unknown }> = ({ data }) => {
  const safeData = Array.isArray(data) ? data : [];
  if (safeData.length === 0) {
    return (
      <VisualizerShell title="Stack (LIFO)" icon={<span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}>
        <VisualizerEmptyState label="Empty Stack" />
      </VisualizerShell>
    );
  }

  return (
    <VisualizerShell title="Stack (LIFO)" icon={<span className="h-1.5 w-1.5 rounded-full bg-rose-500" />} className="h-full">
      <div className="flex justify-center">
      <div className={cn(
        'flex w-32 flex-col-reverse justify-end gap-1 overflow-hidden rounded-b-xl border-x-2 border-b-2 border-slate-700 px-2 pb-2',
        safeData.length <= 3 ? 'h-32' : 'h-64'
      )}>
        <AnimatePresence initial={false}>
          {safeData.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ x: 50, opacity: 0 }}
              className="w-full rounded border border-slate-700 bg-slate-900 py-2 text-center font-mono text-xs font-bold text-slate-200 shadow-md"
            >
              {formatVisualValue(item)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      </div>
    </VisualizerShell>
  );
};

export const QueueVisualizer: React.FC<{ data?: unknown }> = ({ data }) => {
  const safeData = Array.isArray(data) ? data : [];
  if (safeData.length === 0) {
    return (
      <VisualizerShell title="Queue (FIFO)" icon={<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}>
        <VisualizerEmptyState label="Empty Queue" />
      </VisualizerShell>
    );
  }

  return (
    <VisualizerShell title="Queue (FIFO)" icon={<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}>
      <div className="overflow-x-auto pb-2">
      <div className="flex h-16 w-max min-w-[200px] items-center gap-1 rounded-lg border-y-2 border-slate-700 px-4">
        <AnimatePresence initial={false}>
          {safeData.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="flex h-10 w-10 flex-none items-center justify-center rounded border border-slate-700 bg-slate-900 font-mono text-xs font-bold text-slate-200 shadow-md"
            >
              {formatVisualValue(item)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      </div>
    </VisualizerShell>
  );
};
