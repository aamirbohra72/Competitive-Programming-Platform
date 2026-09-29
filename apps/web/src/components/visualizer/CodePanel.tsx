'use client';

import { cn } from '@/lib/cn';

type CodePanelProps = {
  code: string[];
  activeLine: number;
  title?: string;
  hidden?: boolean;
  onReveal?: () => void;
  className?: string;
};

export function CodePanel({
  code,
  activeLine,
  title = 'Solution',
  hidden = false,
  onReveal,
  className,
}: CodePanelProps) {
  return (
    <div
      className={cn(
        'visualizer-stage relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-green-900 bg-[#163025]',
        className,
      )}
    >
      <div className="shrink-0 border-b border-green-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
        {title}
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto">
        <pre
          className={cn(
            'min-w-max p-1.5 font-mono text-[12.5px] leading-6 text-[#e8e8e8] transition',
            hidden && 'select-none blur-sm',
          )}
        >
          {code.map((line, i) => {
            const lineNo = i + 1;
            const isActive = lineNo === activeLine && !hidden;
            return (
              <div
                key={i}
                className={cn(
                  'relative flex transition-colors duration-200',
                  isActive ? 'bg-emerald-500/15' : 'bg-transparent',
                )}
              >
                {isActive ? (
                  <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-emerald-400" />
                ) : null}
                <span
                  className={cn(
                    'w-8 shrink-0 select-none pr-2 text-right text-white/25',
                    isActive && 'text-emerald-400/80',
                  )}
                >
                  {lineNo}
                </span>
                <code className="whitespace-pre pr-4">{line || ' '}</code>
              </div>
            );
          })}
        </pre>

        {hidden ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-green-950/90 px-4 text-center"
          >
            <p className="text-sm text-white/70">
              Try it yourself first — hit <span className="text-emerald-300">Practice</span> to
              write your own.
            </p>
            <button
              type="button"
              onClick={onReveal}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20"
            >
              Reveal solution
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
