'use client';

import { cn } from '@/lib/cn';

type CaptionBarProps = {
  caption: string;
  loading: boolean;
  activeLine?: number;
  className?: string;
};

export function CaptionBar({
  caption,
  loading,
  activeLine,
  className,
}: CaptionBarProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] px-3.5 py-3',
        className,
      )}
      aria-live="polite"
    >
      {typeof activeLine === 'number' ? (
        <span className="mt-0.5 shrink-0 rounded-md border border-green-300 bg-green-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-green-800">
          line {activeLine}
        </span>
      ) : (
        <span className="mt-0.5 text-emerald-400" aria-hidden>
          ✦
        </span>
      )}
      <div className="min-w-0 flex-1">
        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading narration">
            <div className="h-3 w-[92%] animate-pulse rounded bg-green-100" />
            <div className="h-3 w-[62%] animate-pulse rounded bg-green-100" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--text-theme)]">{caption}</p>
        )}
      </div>
    </div>
  );
}
