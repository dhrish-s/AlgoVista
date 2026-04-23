// @ts-nocheck
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

class EditorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || 'Editor failed to initialize.'
    };
  }

  componentDidCatch(error: Error) {
    console.error('Editor initialization error:', error);
  }

  render() {
    if (this.state.hasError) {
      return <EditorFallback message={this.state.message} />;
    }
    return this.props.children;
  }
}

const EditorFallback: React.FC<{ message?: string }> = ({ message }) => (
  <div className="h-full w-full bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
    <Info className="w-8 h-8 text-amber-400 mb-3" />
    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Editor Unavailable</h3>
    <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
      {message || 'The code editor could not initialize. Visualization controls remain available.'}
    </p>
  </div>
);

export const EditorPanel: React.FC<EditorPanelProps> = ({
  code, setCode, onRun, onNext, onPrev, onReset, currentLine, isPlaying, setIsPlaying
}) => {
  const editorRef = React.useRef<any>(null);
  const [editorError, setEditorError] = React.useState<string | null>(null);
  const safeCode = typeof code === 'string' ? code : '';
  const safeCurrentLine = Number.isFinite(currentLine) && currentLine > 0 ? Math.floor(currentLine) : 0;

  React.useEffect(() => {
    if (!editorRef.current || safeCurrentLine <= 0) return;

    try {
      const range = {
        startLineNumber: safeCurrentLine,
        startColumn: 1,
        endLineNumber: safeCurrentLine,
        endColumn: 1
      };

      const decorations = typeof editorRef.current.createDecorationsCollection === 'function'
        ? editorRef.current.createDecorationsCollection([
          {
            range,
            options: {
              isWholeLine: true,
              className: 'bg-indigo-500/20 border-l-2 border-indigo-500 transition-all duration-300',
              glyphMarginClassName: 'text-indigo-400 font-bold',
            }
          }
        ])
        : null;

      if (typeof editorRef.current.revealLineInCenterIfOutsideViewport === 'function') {
        editorRef.current.revealLineInCenterIfOutsideViewport(safeCurrentLine);
      }

      return () => {
        if (decorations && typeof decorations.clear === 'function') {
          decorations.clear();
        }
      };
    } catch (error) {
      console.warn('Editor decoration update skipped:', error);
    }
  }, [safeCurrentLine]);

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
        {editorError ? (
          <EditorFallback message={editorError} />
        ) : (
          <EditorErrorBoundary>
            <Editor
              height="100%"
              defaultLanguage="typescript"
              theme="vs-dark"
              value={safeCode}
              onChange={(val) => setCode(typeof val === 'string' ? val : '')}
              loading="Starting code editor..."
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
                  if (lineNum === safeCurrentLine) return '>';
                  return lineNum.toString();
                },
                glyphMargin: true,
                automaticLayout: true,
              }}
              onMount={(editor) => {
                if (!editor || typeof editor.getValue !== 'function') {
                  setEditorError('The editor mounted with an invalid editor instance.');
                  return;
                }
                editorRef.current = editor;
              }}
            />
          </EditorErrorBoundary>
        )}
      </div>

      <div className="p-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
          <Activity className="w-3 h-3 text-indigo-400" />
          <span>EXECUTION: {isPlaying ? 'RUNNING' : 'PAUSED'}</span>
        </div>
        <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">
          Step {safeCurrentLine} of logic
        </div>
      </div>
    </div>
  );
};
