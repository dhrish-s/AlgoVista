import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface ArrayVisualizerProps {
  data: any[];
  highlights?: number[];
  pointers?: Record<string, number>;
  activeValue?: any;
}

export const ArrayVisualizer: React.FC<ArrayVisualizerProps> = ({ 
  data = [], 
  highlights = [], 
  pointers = {},
}) => {
  const safeData = data || [];
  const safeHighlights = highlights || [];
  const safePointers = pointers || {};

  if (safeData.length === 0) {
    return (
      <div className="p-4 border border-dashed border-slate-700 rounded-lg text-slate-500 text-xs text-center italic">
        Empty Array
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center gap-8 py-8 w-full overflow-x-auto scrollbar-hide">
      <div className="flex gap-2">
        {safeData.map((item, idx) => {
          const isHighlighted = safeHighlights.includes(idx);
          const activePointers = Object.entries(safePointers)
            .filter(([_, pos]) => pos === idx)
            .map(([name]) => name);

          return (
            <div key={idx} className="relative flex flex-col items-center">
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
                  scale: isHighlighted ? 1.1 : 1,
                  backgroundColor: isHighlighted ? '#4f46e5' : '#1e293b',
                  borderColor: isHighlighted ? '#6366f1' : '#334155',
                }}
                className={cn(
                  "w-12 h-12 flex items-center justify-center rounded-lg border-2 text-sm font-mono font-bold transition-shadow shadow-md",
                  isHighlighted && "shadow-indigo-500/40 text-white",
                  !isHighlighted && "text-slate-300"
                )}
              >
                {item}
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
  );
};

export const HashMapVisualizer: React.FC<{ data: Record<string, any> }> = ({ data }) => {
  const entries = Object.entries(data || {});

  return (
    <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
      <div className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
        Hash Map (Lookups: O(1))
      </div>
      {entries.length === 0 ? (
        <div className="text-xs text-slate-600 italic py-2">No entries yet</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
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
                <span className="text-sm font-mono text-white">{value}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
