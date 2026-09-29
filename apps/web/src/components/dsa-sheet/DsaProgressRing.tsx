import { useId } from 'react';
import { cn } from '@/lib/cn';

type DsaProgressRingProps = {
  completed: number;
  total: number;
  size?: number;
  className?: string;
};

/** Circular progress (reference: floating sheet indicator). */
export function DsaProgressRing({ completed, total, size = 56, className }: DsaProgressRingProps) {
  const gradId = useId().replace(/:/g, '');
  const pct = total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-[var(--border-theme)] bg-white px-3 py-2 shadow-sm',
        className,
      )}
      role="img"
      aria-label={`Overall progress ${pct} percent`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#d7e8dd" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-xs font-bold text-[var(--text-theme)]">{pct}%</span>
    </div>
  );
}
