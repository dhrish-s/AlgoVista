import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Code2, 
  BrainCircuit, 
  Flame, 
  Trophy, 
  Settings, 
  Menu, 
  X,
  Search,
  BookOpen,
  Zap,
  Target
} from 'lucide-react';

import { useStore } from './store/useStore';
import { LearningDashboard } from './components/LearningDashboard';
import { ProblemSolver } from './components/ProblemSolver';
import { PatternExplorer } from './components/PatternExplorer';
import { ProblemInputPanel } from './components/ProblemInputPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { cn } from './lib/utils';
import { getAIManager } from './services/ai/AIProviderManager';

export default function App() {
  const { currentProblem, setCurrentProblem, userProgress, aiSettings } = useStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'solve' | 'patterns'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Sync AI Manager with store settings
  React.useEffect(() => {
    getAIManager(aiSettings);
  }, [aiSettings]);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 overflow-hidden font-sans selection:bg-indigo-500/30">
      <AnimatePresence>
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </AnimatePresence>
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="bg-[#050a18] border-r border-slate-800 flex flex-col z-50 overflow-hidden relative shadow-2xl"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          {isSidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
              <span className="font-bold text-lg tracking-tight">AlgoVista</span>
              <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest leading-none">v2.0 Mastery</span>
            </motion.div>
          )}
        </div>

        <div className="px-4 py-6 flex flex-col gap-6 flex-1 overflow-y-auto scrollbar-hide">
          {/* Main Navigation */}
          <nav className="flex flex-col gap-1">
             {[
               { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
               { id: 'patterns', label: 'Pattern Explorer', icon: BrainCircuit },
               { id: 'solve', label: 'Practice Solver', icon: Code2 },
             ].map((item) => (
               <button
                 key={item.id}
                 onClick={() => setActiveTab(item.id as any)}
                 className={cn(
                   "flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative",
                   activeTab === item.id 
                    ? "bg-indigo-500/10 text-indigo-400" 
                    : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-300"
                 )}
               >
                  <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-indigo-400" : "text-slate-600 group-hover:text-slate-400")} />
                  {isSidebarOpen && <span className="text-sm font-semibold">{item.label}</span>}
                  {activeTab === item.id && (
                    <motion.div layoutId="nav-pill" className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full" />
                  )}
               </button>
             ))}
          </nav>

          {/* Quick Problem List - Placeholder for dynamic history or favorites */}
          <div className="flex flex-col gap-2">
            <div className={cn("text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3", !isSidebarOpen && "text-center")}>
              {isSidebarOpen ? 'Active Session' : 'AS'}
            </div>
            {currentProblem && (
              <button
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800 text-white transition-all group"
              >
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full flex-shrink-0",
                  currentProblem.difficulty === 'Easy' ? "bg-emerald-500" : "bg-amber-500"
                )} />
                {isSidebarOpen && (
                  <div className="flex flex-col items-start overflow-hidden text-left">
                    <span className="text-xs font-semibold truncate w-full">{currentProblem.title}</span>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40">
           <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold shadow-inner">
                JD
              </div>
              {isSidebarOpen && (
                <div className="flex flex-col">
                  <span className="text-xs font-bold truncate">Premium Learner</span>
                  <div className="flex items-center gap-1">
                    <Flame className="w-2.5 h-2.5 text-orange-500" />
                    <span className="text-[10px] text-slate-500">{userProgress.streak} Day Streak</span>
                  </div>
                </div>
              )}
           </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-stretch overflow-hidden relative">
        <header className="h-16 border-b border-slate-800 flex items-center px-8 justify-between bg-slate-950/40 backdrop-blur-xl z-30">
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                {isSidebarOpen ? <X className="w-4 h-4 text-slate-500" /> : <Menu className="w-4 h-4 text-slate-500" />}
             </div>
             <div className="w-px h-4 bg-slate-800" />
             <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-500" />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Goal: Hard Problem Today</span>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-full border border-slate-800">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Seach patterns..." 
                  className="bg-transparent text-[11px] border-none focus:ring-0 placeholder-slate-600 w-32"
                />
             </div>
             <button 
               onClick={() => setShowSettings(true)}
               className="p-2 text-slate-500 hover:text-white transition-colors"
             >
                <Settings className="w-5 h-5" />
             </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
               key="dashboard"
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 20 }}
               className="flex-1 overflow-y-auto"
            >
               <LearningDashboard />
            </motion.div>
          )}

          {activeTab === 'patterns' && (
            <motion.div 
               key="patterns"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="flex-1 overflow-y-auto"
            >
               <PatternExplorer />
            </motion.div>
          )}

          {activeTab === 'solve' && (
            <motion.div 
               key="solve"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.02 }}
               className="flex-1 overflow-hidden"
            >
               {currentProblem ? <ProblemSolver /> : <ProblemInputPanel />}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
