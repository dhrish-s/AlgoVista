import React from 'react';

export const VisualizerEmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">
    {label}
  </div>
);
