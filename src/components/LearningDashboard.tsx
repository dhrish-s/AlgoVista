import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Flame, Target, Brain, TrendingUp } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

export const LearningDashboard: React.FC = () => {
  const { userProgress } = useStore();
  
  const stats = [
    { label: 'Streak', value: `${userProgress.streak} days`, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Solved', value: userProgress.totalSolved, icon: Target, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { label: 'Points', value: userProgress.points, icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <motion.div
            key={s.label}
            whileHover={{ y: -2 }}
            className={cn("p-4 rounded-2xl border border-slate-800 flex flex-col gap-1 shadow-sm", s.bg)}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{s.label}</span>
              <s.icon className={cn("w-4 h-4", s.color)} />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">{s.value}</span>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-400" />
            Pattern Mastery
          </h3>
          <TrendingUp className="w-4 h-4 text-slate-600" />
        </div>

        <div className="grid gap-3">
          {['Hash Map', 'Two Pointers', 'Stack', 'Sliding Window'].map((pattern) => {
            const mastery = userProgress.mastery.find(m => m.patternId === pattern);
            const confidence = mastery?.confidence || 0;
            
            return (
              <div key={pattern} className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">{pattern}</span>
                  <span className="text-[10px] font-mono text-slate-500">{(confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${confidence * 100}%` }}
                    className="h-full bg-indigo-500 rounded-full"
                  />
                </div>
                {mastery?.lastMistake && (
                  <div className="mt-1 flex items-center gap-2 px-2 py-1 bg-rose-500/5 border border-rose-500/10 rounded text-[9px] text-rose-400 italic">
                    <span className="font-bold">Last Blocker:</span> {mastery.lastMistake}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
