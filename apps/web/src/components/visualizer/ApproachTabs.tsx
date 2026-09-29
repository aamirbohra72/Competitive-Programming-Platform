'use client';

import { cn } from '@/lib/cn';
import type { Approach } from '@/types/visual-script';

type ApproachTabsProps = {
  approaches: Approach[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
};

export function ApproachTabs({
  approaches,
  activeId,
  onSelect,
  className,
}: ApproachTabsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      {approaches.map((approach) => {
        const active = approach.id === activeId;
        return (
          <button
            key={approach.id}
            type="button"
            onClick={() => onSelect(approach.id)}
            className={cn(
              'group flex flex-col items-start border-b-2 pb-1 text-left transition',
              active
                ? 'border-green-700 text-green-800'
                : 'border-transparent text-[var(--text-muted)] hover:text-green-700',
            )}
          >
            <span className="text-sm font-medium">{approach.label}</span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              time {approach.complexity.time} · space {approach.complexity.space}
            </span>
          </button>
        );
      })}
    </div>
  );
}
