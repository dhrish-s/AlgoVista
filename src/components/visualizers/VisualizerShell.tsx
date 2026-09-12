import React from 'react';
import { cn } from '../../lib/utils';

interface VisualizerShellProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const VisualizerShell: React.FC<VisualizerShellProps> = ({
  title,
  icon,
  children,
  className
}) => (
  <section className={cn(
    'w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:p-6',
    className
  )}>
    <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
      {icon}
      <span>{title}</span>
    </div>
    {children}
  </section>
);
