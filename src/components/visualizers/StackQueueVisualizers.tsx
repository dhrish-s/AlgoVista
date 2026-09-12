import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatVisualValue } from '../../lib/formatVisualValue';
import { VisualizerShell } from './VisualizerShell';

export const StackVisualizer: React.FC<{ data?: unknown }> = ({ data }) => {
  const safeData = Array.isArray(data) ? data : [];
  return (
    <VisualizerShell title="Stack (LIFO)" icon={<span className="h-1.5 w-1.5 rounded-full bg-rose-500" />} className="h-full">
      <div className="flex justify-center">
      <div className="flex flex-col-reverse justify-end w-32 border-x-2 border-b-2 border-slate-700 h-64 rounded-b-xl px-2 pb-2 gap-1 overflow-hidden">
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
        {safeData.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-[10px] text-slate-600 italic">
            Stack Empty
          </div>
        )}
      </div>
      </div>
    </VisualizerShell>
  );
};

export const QueueVisualizer: React.FC<{ data?: unknown }> = ({ data }) => {
  const safeData = Array.isArray(data) ? data : [];
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
        {safeData.length === 0 && (
          <div className="text-[10px] text-slate-600 italic mx-auto">
            Queue Empty
          </div>
        )}
      </div>
      </div>
    </VisualizerShell>
  );
};
