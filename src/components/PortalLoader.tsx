import React from 'react';

interface PortalLoaderProps {
  label?: string;
  className?: string;
}

export default function PortalLoader({
  label = 'Loading portal workspace...',
  className = '',
}: PortalLoaderProps) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white p-10 shadow-sm ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-600 border-r-cyan-400" />
          <div className="h-3 w-3 rounded-full bg-blue-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
            Please wait
          </p>
        </div>
      </div>
    </div>
  );
}
