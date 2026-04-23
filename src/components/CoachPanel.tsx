import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Send, Sparkles, AlertCircle, HelpCircle, Trophy } from 'lucide-react';
import { useStore } from '../store/useStore';
import { StructuredProblem } from '../types';
import { cn } from '../lib/utils';
import { getAIManager } from '../services/ai/AIProviderManager';

interface CoachPanelProps {
  problem: StructuredProblem;
}

export const CoachPanel: React.FC<CoachPanelProps> = ({ problem }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    { role: 'ai', content: `Hello! I'm your AlgoVista Reasoning Coach. I'm here to help you master patterns, not just find answers. How do you plan to approach ${problem.title}?` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const latestReqRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { userReasoning, currentProvider, providerStatus, setCurrentProvider, setProviderStatus } = useStore();

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const newMsgs = [...messages, { role: 'user', content: input } as const];
    setMessages(newMsgs);
    setInput('');
    setIsTyping(true);

    try {
      const aiManager = getAIManager();
      if (!aiManager) {
        throw new Error("AI Manager not initialized.");
      }

      // Cancel any previous coach request and mark this as the latest
      if (abortController) {
        try { abortController.abort(); } catch {}
      }
      const controller = new AbortController();
      setAbortController(controller);
      const reqId = ++latestReqRef.current;

      const { data: coachResponse, meta } = await aiManager.coachMessage(
        problem,
        input,
        newMsgs,
        userReasoning,
        { task: 'coach', signal: controller.signal }
      );

      // If a newer request was started, ignore this response
      if (reqId !== latestReqRef.current) {
        const err: any = new Error('AbortError');
        err.name = 'AbortError';
        throw err;
      }

      if (meta) {
        setCurrentProvider(meta.provider);
        setProviderStatus(meta.status, meta.message);
      }

      if (!coachResponse || coachResponse.isError || typeof coachResponse.content !== 'string' || !coachResponse.content.trim()) {
        throw new Error('Malformed coach response');
      }

      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: coachResponse.content
      }]);
    } catch (e: any) {
      // Ignore cancellations and stale results
      if (e.name === 'AbortError' || e.message?.toLowerCase().includes('cancel')) {
        setIsTyping(false);
        return;
      }
      // Distinguish between different error types
      let errorMsg = "I could not get a reliable coach response. We can still reason it out: what is the main constraint that shapes the algorithm?";
      if (e.message?.includes('API key') || e.message?.includes('unavailable')) {
        errorMsg = "The coach provider is unavailable. Check your API key or switch to an available provider, then try again.";
      } else if (e.message?.includes('provider')) {
        errorMsg = "The selected coach provider could not respond. AlgoVista will use the configured fallback when available; please try again.";
      } else if (e.message?.includes('Malformed coach response')) {
        errorMsg = "The coach returned an empty or malformed response. Try rephrasing your question or ask for a small hint.";
      }
      console.error('Coach message error:', e);
      setProviderStatus('failed', errorMsg);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: errorMsg
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Cancel in-flight coach request when problem changes or component unmounts
  useEffect(() => {
    return () => {
      if (abortController) {
        try { abortController.abort(); } catch {}
      }
    };
  }, [problem.id]);

  return (
    <div className="flex flex-col h-full bg-slate-900/30">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Brain className="w-4 h-4 text-indigo-400" />
           </div>
           <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-tight">AI Reasoning Coach</h3>
              <p className="text-[9px] text-indigo-500 font-bold uppercase tracking-widest">
                {currentProvider} / {providerStatus === 'fallback' ? 'Fallback Active' : 'Minimal Hint Mode'}
              </p>
           </div>
        </div>
        <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-hide"
      >
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "max-w-[85%] p-3 rounded-2xl text-[13px] leading-relaxed",
              m.role === 'ai' 
                ? "bg-slate-800/80 text-slate-100 rounded-bl-none self-start shadow-sm" 
                : "bg-indigo-600 text-white rounded-br-none self-end shadow-md"
            )}
          >
            {m.content}
          </motion.div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-1.5 p-3 bg-slate-800/40 rounded-xl self-start">
             <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" />
             <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
             <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 flex gap-2 border-t border-white/5">
         <button className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-full text-[10px] text-slate-400 transition-colors">
            <HelpCircle className="w-3 h-3" />
            Hint
         </button>
         <button className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-full text-[10px] text-slate-400 transition-colors">
            <AlertCircle className="w-3 h-3" />
            Edge Case?
         </button>
         <button className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-full text-[10px] text-slate-400 transition-colors ml-auto">
            <Trophy className="w-3 h-3" />
            Evaluate
         </button>
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-900 border-t border-white/5">
        <div className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask for a logic nudge..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button 
            onClick={handleSend}
            className="absolute right-2 top-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
