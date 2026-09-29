import { cn } from '@/lib/cn';

export type AffiliateMetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  valueClassName?: string;
};

export function AffiliateMetricCard({ title, value, subtitle, valueClassName }: AffiliateMetricCardProps) {
  return (
    <div className="rounded-lg border border-[var(--border-theme)] bg-white p-4">
      <p className="text-sm text-[var(--text-muted)]">{title}</p>
      <p className={cn('mt-1 text-lg font-semibold tabular-nums', valueClassName ?? 'text-[var(--text-theme)]')}>{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p> : null}
    </div>
  );
}
