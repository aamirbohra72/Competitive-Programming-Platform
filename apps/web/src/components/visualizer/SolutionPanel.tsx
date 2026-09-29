'use client';

import { cn } from '@/lib/cn';
import type { Approach } from '@/types/visual-script';
import { CodePanel } from './CodePanel';
import { StatePanel } from './StatePanel';
import type { Step } from '@/types/visual-script';

type SolutionPanelProps = {
  approach: Approach;
  step: Step;
  stepIndex: number;
  stepCount: number;
  solutionHidden: boolean;
  onRevealSolution: () => void;
  className?: string;
};

export function SolutionPanel({
  approach,
  step,
  stepIndex,
  stepCount,
  solutionHidden,
  onRevealSolution,
  className,
}: SolutionPanelProps) {
  return (
    <div className={cn('flex min-h-0 flex-col gap-2 sm:gap-3', className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--text-theme)]">{approach.label}</p>
          <p className="font-mono text-[10px] text-[var(--text-muted)]">
            time {approach.complexity.time} · space {approach.complexity.space}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
          step {stepIndex + 1} / {stepCount}
        </span>
      </div>

      <CodePanel
        code={approach.code}
        activeLine={step.activeLine}
        title="Solution"
        hidden={solutionHidden}
        onReveal={onRevealSolution}
        className="min-h-[140px] flex-[1.4]"
      />
      <StatePanel state={step.state} className="min-h-[100px] flex-1" />
    </div>
  );
}
