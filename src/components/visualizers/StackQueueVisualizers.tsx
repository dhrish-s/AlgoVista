import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export const StackVisualizer: React.FC<{ data: any[] }> = ({ data = [] }) => {
  const safeData = data || [];
  return (
    <div className="flex flex-col items-center gap-2 p-4 h-full">
      <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Stack (LIFO)
      </div>
      <div className="flex flex-col-reverse justify-end w-32 border-x-2 border-b-2 border-slate-700 h-64 rounded-b-xl px-2 pb-2 gap-1 overflow-hidden">
        <AnimatePresence initial={false}>
          {safeData.map((item, idx) => (
            <motion.div
              key={`${idx}-${item}`}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ x: 50, opacity: 0 }}
              className="w-full py-2 bg-indigo-600 rounded border border-indigo-400 flex items-center justify-center text-white text-xs font-mono font-bold shadow-lg shadow-indigo-500/20"
            >
              {item}
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
  );
};

export const QueueVisualizer: React.FC<{ data: any[] }> = ({ data = [] }) => {
  const safeData = data || [];
  return (
    <div className="flex flex-col items-center gap-2 p-4">
      <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Queue (FIFO)
      </div>
      <div className="flex items-center gap-1 border-y-2 border-slate-700 h-16 px-4 rounded-lg min-w-[200px]">
        <AnimatePresence initial={false}>
          {safeData.map((item, idx) => (
            <motion.div
              key={`${idx}-${item}`}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="w-10 h-10 bg-emerald-600 rounded border border-emerald-400 flex items-center justify-center text-white text-xs font-mono font-bold"
            >
              {item}
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
  );
};
