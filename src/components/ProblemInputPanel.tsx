import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Link as LinkIcon, FileText, Zap, Loader2, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ProblemLoaderService } from '../services/ProblemLoaderService';
import { cn } from '../lib/utils';

export const ProblemInputPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const { isParsing, setParsing, setCurrentProblem, setParseError, parseError } = useStore();

  const handleLoad = async () => {
    if (!input.trim()) return;
    
    // Cancel any existing request
    if (abortController) {
      abortController.abort();
    }
    
    const newController = new AbortController();
    setAbortController(newController);
    
    setParsing(true);
    setParseError(null);
    
    try {
      const source = ProblemLoaderService.detectSource(input);
      let problem;

      if (source === 'leetcode-link') {
        const { slug } = ProblemLoaderService.parseLink(input);
        problem = await ProblemLoaderService.parseProblemText(input, { slug, source }, newController.signal);
      } else {
        problem = await ProblemLoaderService.parseProblemText(input, { source }, newController.signal);
      }

      setCurrentProblem(problem);
    } catch (e: any) {
      if (e.name === 'AbortError' || e.message?.includes('abort')) return;
      setParseError(e.message || "Failed to load problem. Try pasting the full text.");
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-12 flex flex-col gap-8 h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-16 h-16 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/10">
           <Zap className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Load Any Problem</h1>
        <p className="text-slate-500 text-sm max-w-sm">
          Enter a LeetCode number, paste a link, or drop the entire problem statement text.
        </p>
      </div>

      <div className="w-full flex flex-col gap-4">
        <div className="relative group">
          <div className="absolute inset-0 bg-indigo-500/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) handleLoad();
            }}
            placeholder="Paste LeetCode link, Number, or Problem statement..."
            className="w-full h-32 bg-slate-900 border-2 border-slate-800 rounded-2xl p-6 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all relative z-10 font-mono text-sm resize-none"
          />
          <div className="absolute bottom-4 right-4 z-20 flex gap-2">
             <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-500 border border-white/5 uppercase font-bold tracking-widest">
                <LinkIcon className="w-3 h-3" /> Link
             </div>
             <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-500 border border-white/5 uppercase font-bold tracking-widest">
                <FileText className="w-3 h-3" /> Text
             </div>
          </div>
        </div>

        <button
          onClick={handleLoad}
          disabled={!input.trim() || isParsing}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
        >
          {isParsing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Analyzing Problem...</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>Master Problem</span>
            </>
          )}
        </button>

        <p className="text-center text-[10px] text-slate-600 uppercase tracking-widest font-bold">
           ⌘ + Enter to quick load
        </p>

        {parseError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-start gap-3"
          >
             <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
             <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">Parsing Issue</span>
                <p className="text-xs text-rose-500/80 leading-relaxed italic">{parseError}</p>
             </div>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 w-full opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
         <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
               <Zap className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex flex-col">
               <span className="text-[10px] text-slate-300 font-bold">Dynamic Visualizer</span>
               <span className="text-[8px] text-slate-600 uppercase">Interactive Steps</span>
            </div>
         </div>
         <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
               <Loader2 className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex flex-col">
               <span className="text-[10px] text-slate-300 font-bold">AI reasoning coach</span>
               <span className="text-[8px] text-slate-600 uppercase">Socratic Hints</span>
            </div>
         </div>
      </div>
    </div>
  );
};
