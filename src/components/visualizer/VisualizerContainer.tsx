import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ExecutionStep, VisualState } from '../../types';
import { ArrayVisualizer, HashMapVisualizer } from '../visualizers/BasicVisualizers';
import { DPTableVisualizer } from '../visualizers/DPTableVisualizer';
import { StackVisualizer, QueueVisualizer } from '../visualizers/StackQueueVisualizers';
import { GraphVisualizer } from '../visualizers/GraphVisualizer';
import { LinkedListVisualizer } from '../visualizers/LinkedListVisualizer';
import { TreeVisualizer } from '../visualizers/TreeVisualizer';
import { Zap, Info, Bug, AlertCircle } from 'lucide-react';

interface VisualizerContainerProps {
  step: ExecutionStep | null;
}

export const SUPPORTED_VISUAL_STATE_KEYS = [
  'array', 'map', 'stack', 'queue', 'tree', 'graph', 'dpTable', 'linkedList'
] as const satisfies readonly (keyof VisualState)[];

export const hasSupportedVisualization = (visualState: VisualState): boolean => (
  SUPPORTED_VISUAL_STATE_KEYS.some((key) => visualState[key] !== undefined)
);

export const VisualizerContainer: React.FC<VisualizerContainerProps> = ({ step }) => {
  if (!step) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4 opacity-30">
       <Zap className="w-12 h-12" />
       <p className="text-xs font-mono uppercase tracking-[0.3em]">Initialize Step</p>
    </div>
  );

  const { visualState } = step;

  const hasSupportedState = hasSupportedVisualization(visualState);
  const providedStateKeys = Object.keys(visualState);

  return (
    <div className="w-full flex flex-col items-center justify-center gap-10 p-8 h-full">
      {!hasSupportedState && (
        <div className="flex flex-col items-center p-8 bg-rose-500/5 border border-rose-500/20 rounded-xl max-w-md w-full">
           <div className="flex items-center gap-2 mb-2 text-rose-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Safety Check Failed</span>
           </div>
           <p className="text-[11px] text-rose-500 text-center leading-relaxed">
             <span className="font-bold">Component:</span> VisualizerContainer<br/>
             <span className="font-bold">Issue:</span> No supported visualization for this step<br/>
             <span className="font-bold">State keys:</span> {providedStateKeys.length > 0 ? providedStateKeys.join(', ') : 'none'}<br/>
             <span className="font-bold">Supported:</span> array, map, stack, queue, tree, graph, dpTable, linkedList
           </p>
        </div>
      )}

      {/* Array Display */}
      {visualState.array && (
        <div className="w-full flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <ArrayVisualizer 
             data={visualState.array}
             highlights={visualState.highlights}
             pointers={visualState.indices}
           />
        </div>
      )}

      {visualState.tree !== undefined && (
        <div className="w-full flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <TreeVisualizer data={visualState.tree} />
        </div>
      )}

      {visualState.graph !== undefined && (
        <div className="w-full flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <GraphVisualizer data={visualState.graph} />
        </div>
      )}

      {visualState.dpTable !== undefined && (
        <div className="w-full flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <DPTableVisualizer data={visualState.dpTable} />
        </div>
      )}

      {visualState.linkedList !== undefined && (
        <div className="w-full flex-shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <LinkedListVisualizer data={visualState.linkedList} />
        </div>
      )}

      {/* Concurrent Secondary Structures */}
      <div className="flex gap-12 w-full max-w-5xl justify-center items-start">
         <AnimatePresence mode="popLayout">
           {visualState.map && (
             <motion.div 
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
               className="flex-1"
             >
                <HashMapVisualizer data={visualState.map} />
             </motion.div>
           )}
           
           {visualState.stack && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="w-48 flex-shrink-0"
             >
                <StackVisualizer data={visualState.stack} />
             </motion.div>
           )}

           {visualState.queue && (
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 20 }}
             >
                <QueueVisualizer data={visualState.queue} />
             </motion.div>
           )}
         </AnimatePresence>
      </div>

      {/* Variables Monitor */}
      <div className="fixed bottom-32 right-8 flex flex-col gap-2 p-4 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl shadow-2xl z-40 max-w-[200px]">
         <div className="flex items-center gap-2 mb-1 border-b border-white/5 pb-2">
            <Info className="w-3 h-3 text-indigo-400" />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Environment</span>
         </div>
         <div className="flex flex-col gap-1.5">
            {Object.entries(step.variables || {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4">
                 <span className="text-[10px] font-mono text-slate-500">{k}:</span>
                 <span className="text-[10px] font-mono text-indigo-300 truncate max-w-[100px]">{JSON.stringify(v)}</span>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};
