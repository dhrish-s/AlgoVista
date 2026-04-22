import React from 'react';
import Editor from '@monaco-editor/react';
import { Play, SkipForward, SkipBack, RotateCcw, Info, Pause, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

interface EditorPanelProps {
  code: string;
  setCode: (code: string) => void;
  onRun: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReset: () => void;
  currentLine: number;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ 
  code, setCode, onRun, onNext, onPrev, onReset, currentLine, isPlaying, setIsPlaying
}) => {
  const editorRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (editorRef.current && currentLine > 0) {
      // Set decorations for current line highlighting
      const decorations = editorRef.current.deltaDecorations([], [
        {
          range: { startLineNumber: currentLine, startColumn: 1, endLineNumber: currentLine, endColumn: 1 },
          options: {
            isWholeLine: true,
            className: 'bg-indigo-500/20 border-l-2 border-indigo-500 transition-all duration-300',
            glyphMarginClassName: 'text-indigo-400 font-bold',
          }
        }
      ]);
      
      editorRef.current.revealLineInCenterIfOutsideViewport(currentLine);

      return () => {
        if (editorRef.current) editorRef.current.deltaDecorations(decorations, []);
      };
    }
  }, [currentLine]);

  return (
    <div className="flex flex-col h-full bg-[#050914] border-r border-slate-800">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 px-0.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.3)]" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-4">solution.ts</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={onPrev}
            disabled={isPlaying}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors disabled:opacity-20"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={cn(
              "p-2 rounded-full transition-all",
              isPlaying ? "bg-amber-500/10 text-amber-500" : "bg-indigo-500/10 text-indigo-500"
            )}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-amber-500" /> : <Play className="w-4 h-4 fill-indigo-500" />}
          </button>

          <button 
            onClick={onNext}
            disabled={isPlaying}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors disabled:opacity-20"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          
          <div className="w-px h-4 bg-slate-800 mx-1" />
          
          <button 
            onClick={onReset}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <button 
            onClick={onRun}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            RE-RUN VIZ
          </button>
        </div>
      </div>

      <div className="flex-1 w-full overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="typescript"
          theme="vs-dark"
          value={code}
          onChange={(val) => setCode(val || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 24,
            padding: { top: 20 },
            scrollBeyondLastLine: false,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: "on",
            renderLineHighlight: 'all',
            fontFamily: "'JetBrains Mono', monospace",
            lineNumbers: (lineNum) => {
               if (lineNum === currentLine) return '→';
               return lineNum.toString();
            },
            glyphMargin: true,
            automaticLayout: true,
          }}
          onMount={(editor) => {
             editorRef.current = editor;
          }}
        />
      </div>

      <div className="p-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
           <Activity className="w-3 h-3 text-indigo-400" />
           <span>EXECUTION: {isPlaying ? 'RUNNING' : 'PAUSED'}</span>
        </div>
        <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">
           Step {currentLine > 0 ? currentLine : 0} of logic
        </div>
      </div>
    </div>
  );
};
