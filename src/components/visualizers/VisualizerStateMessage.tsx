import React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface VisualizerStateMessageProps {
  title: string;
  children: React.ReactNode;
  tone?: 'warning' | 'error';
}

export const VisualizerStateMessage: React.FC<VisualizerStateMessageProps> = ({
  title,
  children,
  tone = 'warning'
}) => {
  const Icon = tone === 'error' ? AlertCircle : AlertTriangle;

  return (
    <div className={cn(
      'w-full max-w-xl rounded-xl border p-5 text-center',
      tone === 'error' ? 'border-rose-500/20 bg-rose-500/5' : 'border-amber-500/30 bg-amber-500/5'
    )}>
      <div className={cn(
        'flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest',
        tone === 'error' ? 'text-rose-400' : 'text-amber-300'
      )}>
        <Icon className="h-4 w-4" />
        <span>{title}</span>
      </div>
      <div className={cn(
        'mt-2 text-[11px] leading-relaxed',
        tone === 'error' ? 'text-rose-400/80' : 'text-amber-200/70'
      )}>
        {children}
      </div>
    </div>
  );
};
