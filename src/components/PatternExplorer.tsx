import React from 'react';
import { motion } from 'motion/react';
import { Brain, Search, Code, Lock, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

const PATTERNS = [
  { id: 'hash', name: 'Hash Map Lookup', icon: Zap, desc: 'O(1) access to previously seen data.', category: 'Data Structures', level: 'Fundamental' },
  { id: '2p', name: 'Two Pointers', icon: Brain, desc: 'Efficiently search pairs or subarrays.', category: 'Technique', level: 'Intermediate' },
  { id: 'stack', name: 'The Stack Pattern', icon: ShieldCheck, desc: 'Managing nested or balanced structures.', category: 'Data Structures', level: 'Fundamental' },
  { id: 'sw', name: 'Sliding Window', icon: Search, desc: 'Tracking sub-segments of linear data.', category: 'Technique', level: 'Intermediate' },
];

export const PatternExplorer: React.FC = () => {
  return (
    <div className="p-8 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
         <h1 className="text-3xl font-bold text-white tracking-tight">Pattern Mastery</h1>
         <p className="text-slate-500 text-sm max-w-xl">
           The secret to 100+ LeetCode problems isn't memorization—it's recognizing these core patterns.
         </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {PATTERNS.map((p) => (
          <motion.div
            key={p.id}
            whileHover={{ y: -4, scale: 1.01 }}
            className="p-5 bg-slate-900 border border-slate-800 rounded-2xl group hover:border-indigo-500/50 transition-all cursor-pointer relative overflow-hidden"
          >
             <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
             <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                   <p.icon className="w-5 h-5" />
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">{p.category}</span>
                   <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{p.level}</span>
                </div>
             </div>
             <h3 className="text-lg font-bold text-white mb-1">{p.name}</h3>
             <p className="text-xs text-slate-400 leading-relaxed italic mb-4">"{p.desc}"</p>
             
             <div className="flex items-center gap-4 border-t border-white/5 pt-4">
                <div className="flex flex-col">
                   <span className="text-[9px] font-bold text-slate-500 uppercase">Mastery</span>
                   <div className="h-1 w-24 bg-slate-800 rounded-full mt-1">
                      <div className="h-full w-1/3 bg-indigo-500 rounded-full" />
                   </div>
                </div>
                <button className="ml-auto text-[10px] font-bold text-indigo-400 hover:text-white uppercase flex items-center gap-1">
                   Explore Problems
                   <Code className="w-3 h-3" />
                </button>
             </div>
          </motion.div>
        ))}

        <div className="col-span-2 p-8 border border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-4 text-center opacity-60">
           <Lock className="w-8 h-8 text-slate-700" />
           <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">More Patterns Coming</p>
              <p className="text-xs text-slate-600 mt-1">Solve 3 more Easy problems to unlock Dynamic Programming.</p>
           </div>
        </div>
      </div>
    </div>
  );
};
