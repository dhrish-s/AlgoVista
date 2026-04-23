import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { StructuredProblem, ApproachOption } from '../types';
import { Brain, Lock, CheckCircle2, ChevronRight, Play, Loader2, AlertCircle, RefreshCw, Code } from 'lucide-react';
import { cn } from '../lib/utils';
import { CoachPanel } from './CoachPanel';
import { EditorPanel } from './EditorPanel';
import { VisualizerContainer } from './visualizer/VisualizerContainer';
import { DynamicStepGenerator } from '../services/DynamicStepGenerator';

import { Group, Panel, Separator } from 'react-resizable-panels';
import { MiniExecutionWindow } from './MiniExecutionWindow';
import { VariableStatePanel } from './VariableStatePanel';

export const ProblemSolver: React.FC = () => {
  const { 
    currentProblem, 
    unlockedEditor, 
    userReasoning, 
    setUserReasoning, 
    unlockEditor, 
    userCode,
    setUserCode,
    currentSteps,
    setSteps,
    currentStepIndex, 
    setStepIndex,
    isGeneratingSteps,
    setStepGenerationState,
    stepGenerationError,
    stepTruncated,
    resetSession,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    panelLayout,
    setPanelLayout,
    parseConfidence,
    currentProvider,
    providerStatus,
    providerMessage,
    setCurrentProvider,
    setProviderStatus
  } = useStore();

  const [selectedApproach, setSelectedApproach] = useState<ApproachOption | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Auto-select first approach when problem loads
  useEffect(() => {
    if (currentProblem?.approaches && currentProblem.approaches.length > 0) {
      setSelectedApproach(currentProblem.approaches[0]);
    } else {
      setSelectedApproach(null);
    }
  }, [currentProblem?.id]);

  // Playback logic
  useEffect(() => {
    let interval: any;
    if (isPlaying && currentSteps.length > 0) {
      interval = setInterval(() => {
        setStepIndex((prev) => {
          if (prev >= currentSteps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playbackSpeed);
    }
    return () => {
      clearInterval(interval);
    };
  }, [isPlaying, currentSteps.length, playbackSpeed]);

  if (!currentProblem) return null;

  const handleGenerateVisualization = async (useUserCode: boolean = false) => {
    if ((!selectedApproach && !useUserCode)) return;
    
    // Cancel existing
    if (abortController) {
      abortController.abort();
    }
    
    const newController = new AbortController();
    setAbortController(newController);

    setStepGenerationState(true, null, false);
    try {
      const testCase = currentProblem.examples[0];
      let steps;
      
      if (useUserCode) {
        steps = await DynamicStepGenerator.generateFromUserCode(currentProblem, userCode, testCase, newController.signal);
      } else if (selectedApproach) {
        steps = await DynamicStepGenerator.generate(currentProblem, selectedApproach, testCase, newController.signal);
      } else {
        throw new Error("No approach selected.");
      }
      
      const generationFeedback = (steps as any).generationFeedback;
      const providerMeta = (steps as any).providerMeta;
      if (providerMeta) {
        setCurrentProvider(providerMeta.provider);
        setProviderStatus(providerMeta.status, providerMeta.message);
      }
      setSteps(steps);
      setStepIndex(0);
      setIsPlaying(true);
      setStepGenerationState(false, generationFeedback?.truncated
        ? "The trace was longer than the 50-step safety limit, so the visualization shows the first reliable portion. Try a smaller example input or simplify the code to see more detail."
        : null,
        Boolean(generationFeedback?.truncated)
      );
    } catch (e: any) {
      if (e.name === 'AbortError' || e.message?.includes('abort')) {
        setStepGenerationState(false, null, false);
        return;
      }
      let errorMsg = "Visualization is unavailable for this run. Try a smaller sample input, a simpler approach, or regenerate the trace.";
      if (e.message?.includes('Invalid step trace')) {
        errorMsg = "The generated trace did not pass validation, so AlgoVista did not visualize it. Try a simpler approach or adjust your code, then regenerate.";
      } else if (e.message?.includes('Step trace is not an array')) {
        errorMsg = "The provider returned a malformed trace. Regenerate the visualization, or switch providers if this keeps happening.";
      } else if (e.message?.includes('No valid steps found')) {
        errorMsg = "The trace contained no usable execution steps. Try a different approach, smaller test case, or clearer code.";
      } else if (e.message?.includes('provider')) {
        errorMsg = "The current AI provider could not generate a trace. Check provider settings or API key, then try again.";
      }
      setStepGenerationState(false, errorMsg);
    }
  };

  const activeStep = currentStepIndex >= 0 ? currentSteps[currentStepIndex] : null;

  return (
    <div className="flex h-full overflow-hidden bg-[#020617] relative">
      <Group 
        orientation="horizontal" 
        className="h-full" 
        onLayoutChanged={(layout) => {
          const vals = Object.values(layout);
          if (vals.length >= 2) setPanelLayout([vals[0], vals[1]]);
        }}
      >
        {/* Sidebar: Strategy & Reasoning */}
        <Panel 
          defaultSize={panelLayout[0]} 
          minSize={20} 
          className="border-r border-slate-800 bg-slate-900/10 flex flex-col overflow-hidden"
        >
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
             <button 
              onClick={resetSession}
              className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors flex items-center gap-1.5 uppercase"
             >
               <RefreshCw className="w-3 h-3" /> New Problem
             </button>
             <div className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  unlockedEditor ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-amber-500 animate-pulse"
                )} />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">
                  {unlockedEditor ? 'Ready' : 'Thinking'}
                </span>
             </div>
          </div>

          <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/20 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-slate-500">Parse Confidence</span>
              <span className={cn(
                parseConfidence >= 0.8 ? "text-emerald-400" : parseConfidence >= 0.55 ? "text-amber-400" : "text-rose-400"
              )}>
                {parseConfidence >= 0.8 ? 'High' : parseConfidence >= 0.55 ? 'Medium' : 'Low'} ({Math.round(parseConfidence * 100)}%)
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-slate-500">AI Provider</span>
              <span className={cn(
                providerStatus === 'fallback' ? "text-amber-400" : providerStatus === 'failed' || providerStatus === 'unavailable' ? "text-rose-400" : "text-indigo-400"
              )}>
                {currentProvider} / {providerStatus}
              </span>
            </div>
            {providerMessage && (
              <p className="text-[10px] text-slate-500 leading-relaxed">{providerMessage}</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 scrollbar-hide">
            <section className="flex flex-col gap-4">
               <h3 className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                 1. Select Approach
               </h3>
               <div className="grid gap-2">
                 {currentProblem.approaches && currentProblem.approaches.length > 0 ? (
                   currentProblem.approaches.map((app) => (
                     <button
                       key={app.id}
                       onClick={() => setSelectedApproach(app)}
                       className={cn(
                         "px-4 py-3 rounded-xl border text-left transition-all relative group",
                         selectedApproach?.id === app.id 
                           ? "bg-indigo-500/10 border-indigo-500 shadow-xl shadow-indigo-500/5 text-white" 
                           : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
                       )}
                     >
                       <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{app.name}</span>
                          {app.isOptimal && <span className="text-[8px] font-bold text-emerald-500 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/10 uppercase">Best</span>}
                       </div>
                       <span className="text-[9px] font-mono text-indigo-400/70">{app.complexity.time} • {app.complexity.space}</span>
                     </button>
                   ))
                 ) : (
                   <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col items-center gap-2 text-center">
                     <AlertCircle className="w-5 h-5 text-amber-500/40" />
                     <span className="text-[10px] text-slate-500 italic leading-relaxed"> No strategies identified yet.<br/>Try re-loading with full description.</span>
                   </div>
                 )}
               </div>
            </section>

            <section className="flex flex-col gap-4">
               <h3 className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                 2. Explain Theory
               </h3>
               <textarea
                 value={userReasoning}
                 onChange={(e) => setUserReasoning(e.target.value)}
                 placeholder="How does this algorithm work? What is the core loop invariant?"
                 className="w-full h-32 bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-[11px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
               />
               <button
                 onClick={unlockEditor}
                 disabled={(!selectedApproach && (currentProblem.approaches?.length || 0) > 0) || userReasoning.length < 15}
                 className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20 text-white rounded-xl text-[10px] font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
               >
                  VALIDATE INTUITION
               </button>
            </section>

            {unlockedEditor && (
              <div className="mt-auto pt-6 border-t border-white/5">
                <CoachPanel problem={currentProblem} />
              </div>
            )}
          </div>
        </Panel>

        <Separator className="w-1.5 bg-[#020617] hover:bg-indigo-500/30 transition-colors cursor-col-resize flex items-center justify-center">
           <div className="w-0.5 h-8 bg-slate-800 rounded-full" />
        </Separator>

        {/* Workspace: Code & Visuals */}
        <Panel defaultSize={panelLayout[1]}>
          <Group orientation="vertical">
            {/* Top: Algorithm Visualization */}
            <Panel defaultSize={50} minSize={30} className="bg-slate-950 flex flex-col relative overflow-hidden">
               <div className="absolute top-4 left-6 z-10 flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 backdrop-blur rounded-full border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]" />
                    <span className="text-[9px] font-bold text-slate-100 uppercase tracking-widest">Mastery Engine v2.5</span>
                  </div>
                  
                  {unlockedEditor && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleGenerateVisualization(false)}
                        disabled={isGeneratingSteps || !selectedApproach}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-[10px] font-bold transition-all disabled:opacity-30"
                      >
                        {isGeneratingSteps ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-white" />}
                        Ideal Logic
                      </button>
                      <button
                        onClick={() => handleGenerateVisualization(true)}
                        disabled={isGeneratingSteps || userCode.length < 10}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-full border border-white/5 text-[10px] font-bold transition-all disabled:opacity-30"
                      >
                        {isGeneratingSteps ? <Loader2 className="w-3 h-3 animate-spin" /> : <Code className="w-3 h-3" />}
                        Sync My Code
                      </button>
                    </div>
                  )}
               </div>

               <div className="flex-1 flex items-center justify-center relative">
                  <VisualizerContainer step={activeStep} />
                  
                  {(stepGenerationError || stepTruncated) && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "absolute z-[60] bg-slate-950/90 flex flex-col items-center justify-center p-8 text-center",
                        stepGenerationError && !stepTruncated ? "inset-0" : "left-6 right-6 bottom-6 rounded-2xl border border-amber-500/20"
                      )}
                    >
                       <AlertCircle className={cn("w-10 h-10 mb-4", stepTruncated ? "text-amber-500" : "text-rose-500")} />
                       <h4 className="text-white font-bold mb-1">
                         {stepTruncated ? 'Visualization Limited' : 'Visualization Unavailable'}
                       </h4>
                       <p className="text-[11px] text-slate-500 max-w-sm italic">
                         {stepGenerationError}
                       </p>
                       <button 
                        onClick={() => setStepGenerationState(false, null, false)}
                        className="mt-6 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold"
                       >
                         DISMISS
                       </button>
                    </motion.div>
                  )}
               </div>
            </Panel>

            <Separator className="h-1.5 bg-[#020617] hover:bg-indigo-500/30 transition-colors cursor-row-resize flex items-center justify-center">
               <div className="h-0.5 w-8 bg-slate-800 rounded-full" />
            </Separator>

            {/* Bottom: Editor & State */}
            <Panel defaultSize={50} minSize={20}>
              <Group orientation="horizontal">
                {/* Monaco Editor */}
                <Panel defaultSize={70} className="relative">
                  {!unlockedEditor && (
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-30 flex flex-col items-center justify-center gap-5">
                       <Lock className="w-8 h-8 text-slate-800" />
                       <div className="text-center">
                          <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs">Awaiting Theory Validation</h3>
                          <p className="text-slate-600 text-[10px] italic mt-1">Implement your intuition once the logic is clear.</p>
                       </div>
                    </div>
                  )}
                  <EditorPanel 
                    code={userCode} 
                    setCode={setUserCode} 
                    onRun={() => currentSteps.length > 0 ? setIsPlaying(!isPlaying) : handleGenerateVisualization(true)}
                    onNext={() => setStepIndex(Math.min(currentSteps.length - 1, currentStepIndex + 1))}
                    onPrev={() => setStepIndex(Math.max(0, currentStepIndex - 1))}
                    onReset={() => { setStepIndex(-1); setIsPlaying(false); }}
                    currentLine={activeStep?.line || 0}
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                  />
                </Panel>

                <Separator className="w-1.5 bg-[#020617] hover:bg-indigo-500/30 transition-colors cursor-col-resize" />

                {/* State Inspector */}
                <Panel defaultSize={30} minSize={15}>
                  <VariableStatePanel variables={activeStep?.variables || {}} />
                </Panel>
              </Group>
            </Panel>
          </Group>
        </Panel>
      </Group>

      {/* Overlays */}
      <MiniExecutionWindow step={activeStep} />
    </div>
  );
};
