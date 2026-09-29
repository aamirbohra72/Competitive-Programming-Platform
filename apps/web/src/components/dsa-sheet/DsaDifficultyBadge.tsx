import type { DsaDifficulty } from '@/data/dsa-sheet';
import { cn } from '@/lib/cn';

const styles: Record<DsaDifficulty, string> = {
  Easy: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-800 border-amber-200',
  Hard: 'bg-rose-50 text-rose-800 border-rose-200',
};

type DsaDifficultyBadgeProps = {
  difficulty: DsaDifficulty;
  className?: string;
};

export function DsaDifficultyBadge({ difficulty, className }: DsaDifficultyBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
        styles[difficulty],
        className,
      )}
    >
      {difficulty}
    </span>
  );
}
