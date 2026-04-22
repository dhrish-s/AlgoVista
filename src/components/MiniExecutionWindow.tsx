import React from 'react';
import { motion } from 'motion/react';
import { Terminal, ChevronRight, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { ExecutionStep } from '../types';

interface MiniExecutionWindowProps {
  step: ExecutionStep | null;
  className?: string;
}

export const MiniExecutionWindow: React.FC<MiniExecutionWindowProps> = ({ step, className }) => {
  if (!step) return null;

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "fixed bottom-24 left-1/2 -translate-x-1/2 w-80 bg-slate-900/90 backdrop-blur-xl border border-indigo-500/30 rounded-2xl shadow-2xl z-[100] overflow-hidden select-none",
        className
      )}
    >
      <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border-b border-indigo-500/20 cursor-move">
        <Activity className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Active Pulse</span>
        <div className="ml-auto px-1.5 py-0.5 bg-indigo-500/20 rounded text-[9px] font-mono text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
          LINE {step.line}
        </div>
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
           <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center flex-shrink-0">
              <ChevronRight className="w-4 h-4 text-emerald-400" />
           </div>
           <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase">Current Action</span>
              <p className="text-[11px] text-slate-200 font-medium leading-relaxed leading-tight italic">
                "{step.explanation}"
              </p>
           </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
           <div className="flex-1 h-px bg-white/5" />
           <span className="text-[8px] font-bold text-slate-600 uppercase tracking-[0.2em]">Live State</span>
           <div className="flex-1 h-px bg-white/5" />
        </div>

        <div className="grid grid-cols-2 gap-2">
           {Object.entries(step.variables || {}).slice(0, 4).map(([k, v]) => (
             <div key={k} className="flex items-center justify-between p-1.5 bg-white/5 rounded border border-white/5">
                <span className="text-[10px] font-mono text-slate-500">{k}</span>
                <span className="text-[10px] font-mono text-indigo-300">{JSON.stringify(v)}</span>
             </div>
           ))}
        </div>
      </div>
    </motion.div>
  );
};
