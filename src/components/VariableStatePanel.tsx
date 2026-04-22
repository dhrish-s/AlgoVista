import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Box, Hash, Type, ToggleLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface VariableStatePanelProps {
  variables: Record<string, any>;
}

export const VariableStatePanel: React.FC<VariableStatePanelProps> = ({ variables = {} }) => {
  const safeVariables = variables || {};
  const variableEntries = Object.entries(safeVariables);

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2">
           <Box className="w-4 h-4 text-indigo-400" />
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Environment Variables</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {variableEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center opacity-30 mt-12">
               <Hash className="w-10 h-10 mb-2" />
               <p className="text-[10px] font-bold uppercase">No variables extracted</p>
            </div>
          ) : (
            variableEntries.map(([key, value]) => {
              const type = typeof value;
              const Icon = type === 'number' ? Hash : type === 'string' ? Type : ToggleLeft;

              return (
                <motion.div
                  key={key}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="group p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/30 transition-all"
                >
                  <div className="flex items-center justify-between mb-1.5">
                     <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center">
                           <Icon className="w-3 h-3 text-slate-500" />
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-200">{key}</span>
                     </div>
                     <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">{type}</span>
                  </div>
                  <motion.div 
                    key={`${key}-${JSON.stringify(value)}`}
                    initial={{ color: "#818cf8" }}
                    animate={{ color: "#d1d5db" }}
                    transition={{ duration: 1 }}
                    className="text-sm font-mono font-medium pl-7"
                  >
                    {JSON.stringify(value)}
                  </motion.div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
