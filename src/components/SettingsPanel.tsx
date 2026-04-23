import React from 'react';
import { motion } from 'motion/react';
import { Settings, Cpu, Zap, Shield, HelpCircle, Save } from 'lucide-react';
import { useStore } from '../store/useStore';
import { AIProviderID } from '../services/ai/types';
import { cn } from '../lib/utils';
import { getAIManager } from '../services/ai/AIProviderManager';
import { getProviderAvailability } from '../services/ai/providerConfig';

export const SettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { aiSettings, setAISettings, currentProvider, providerStatus, providerMessage, setProviderStatus } = useStore();

  const handleProviderChange = (providerId: AIProviderID) => {
    const provider = providers.find((p) => p.id === providerId);
    if (provider?.disabled) {
      setProviderStatus('unavailable', `${provider.name} is unavailable. ${provider.reason || 'Check its API key.'}`);
      return;
    }
    const nextSettings = {
      ...aiSettings,
      defaultProvider: providerId,
      taskRouting: {
        ...aiSettings.taskRouting,
        parse: providerId,
        steps: providerId,
        coach: providerId
      }
    };
    setAISettings(nextSettings);
    getAIManager(nextSettings);
  };

  const handleFallbackChange = (providerId: AIProviderID) => {
    const provider = providers.find((p) => p.id === providerId);
    if (provider?.disabled) {
      setProviderStatus('unavailable', `${provider.name} fallback is unavailable. ${provider.reason || 'Check its API key.'}`);
      setAISettings({ fallbackProvider: 'gemini' });
      getAIManager({ ...aiSettings, fallbackProvider: 'gemini' });
      return;
    }
    setAISettings({ fallbackProvider: providerId });
    getAIManager({ ...aiSettings, fallbackProvider: providerId });
  };

  const baseProviders: { id: AIProviderID; name: string; desc: string; icon: any }[] = [
    { id: 'gemini', name: 'Gemini', desc: 'Google DeepMind', icon: Zap },
    { id: 'openai', name: 'OpenAI', desc: 'Chat Completions', icon: Cpu },
    { id: 'claude', name: 'Claude', desc: 'Messages API', icon: Shield },
  ];

  const providers: { id: AIProviderID; name: string; desc: string; icon: any; disabled?: boolean; reason?: string }[] = baseProviders.map((provider) => {
    const availability = getProviderAvailability(provider.id);
    return {
      ...provider,
      disabled: !availability.available,
      reason: availability.reason
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        <header className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
           <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">AI Workspace Config</h2>
           </div>
           <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <Save className="w-5 h-5" />
           </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 scrollbar-hide">
           <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Core Provider</h3>
              <div className="grid gap-3">
                 {providers.map((p) => (
                   <button
                     key={p.id}
                     onClick={() => handleProviderChange(p.id)}
                     disabled={p.disabled}
                     className={cn(
                       "flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                       aiSettings.defaultProvider === p.id 
                        ? "bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/5 text-white" 
                        : "bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700",
                       p.disabled && "opacity-40 cursor-not-allowed grayscale"
                     )}
                   >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                        aiSettings.defaultProvider === p.id ? "bg-indigo-500 text-white" : "bg-slate-900 text-slate-500"
                      )}>
                         <p.icon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                         <span className="text-sm font-bold">{p.name}</span>
                         <span className="text-[10px] opacity-60 font-mono tracking-tight">
                          {p.disabled ? `${p.desc} - ${p.reason}` : `${p.desc} - available`}
                         </span>
                      </div>
                   </button>
                 ))}
              </div>
           </section>

           <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Routing Reliability</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Fallback Engine</span>
                    <select 
                      value={aiSettings.fallbackProvider}
                      onChange={(e) => handleFallbackChange(e.target.value as AIProviderID)}
                      className="bg-transparent text-xs text-indigo-400 font-bold focus:outline-none cursor-pointer"
                    >
                       {providers.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.disabled}>
                          {p.name}{p.disabled ? ' (Unavailable)' : ''}
                        </option>
                       ))}
                    </select>
                 </div>
                 <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl flex flex-col gap-2 opacity-50 cursor-not-allowed">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                      Task Routing <HelpCircle className="w-3 h-3" />
                    </span>
                    <span className="text-xs text-slate-600 font-bold">Enabled (Auto)</span>
                 </div>
              </div>
           </section>

           <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Provider Status</h3>
              <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Current Provider</span>
                  <span className="text-xs text-indigo-400 font-bold uppercase">{currentProvider}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Last Action</span>
                  <span className={cn(
                    "text-xs font-bold uppercase",
                    providerStatus === 'fallback' ? "text-amber-400" : providerStatus === 'failed' || providerStatus === 'unavailable' ? "text-rose-400" : "text-emerald-400"
                  )}>
                    {providerStatus}
                  </span>
                </div>
                {providerMessage && (
                  <p className="text-[10px] text-slate-500 leading-relaxed">{providerMessage}</p>
                )}
              </div>
           </section>

           <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Workspace Control</h3>
              <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl flex items-center justify-between">
                 <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-white leading-none">Reset Panel Layout</span>
                    <span className="text-[10px] text-slate-500">Restore default workspace proportions</span>
                 </div>
                 <button 
                  onClick={() => {
                    useStore.getState().setPanelLayout([30, 70]);
                    onClose();
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold transition-all border border-white/5 active:scale-95"
                 >
                    RESET NOW
                 </button>
              </div>
           </section>

           <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Model Specifics</h3>
              <div className="flex flex-col gap-3">
                 {Object.entries(aiSettings.modelNames).map(([id, name]) => (
                   <div key={id} className="flex items-center justify-between p-3 bg-slate-950/30 rounded-xl border border-slate-800/50">
                      <span className="text-[10px] font-mono text-slate-500 uppercase">{id} Model</span>
                      <input 
                        value={name}
                        onChange={(e) => setAISettings({ modelNames: { ...aiSettings.modelNames, [id]: e.target.value } })}
                        className="bg-transparent text-right text-xs text-slate-300 font-mono focus:outline-none focus:text-indigo-400 w-full ml-8"
                      />
                   </div>
                 ))}
              </div>
           </section>
        </div>

        <footer className="p-6 bg-slate-950/30 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-600">
           <span>Protocol: Agnostic v1.0</span>
           <span className="text-emerald-500/50">System: Operational</span>
        </footer>
      </div>
    </motion.div>
  );
};
