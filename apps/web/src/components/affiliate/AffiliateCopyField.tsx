'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/cn';

export type AffiliateCopyFieldProps = {
  label: string;
  value: string;
  className?: string;
  /** Shorter label for screen readers / mobile */
  copyLabel?: string;
};

export function AffiliateCopyField({ label, value, className, copyLabel = 'Copy link' }: AffiliateCopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <div className={cn('rounded-lg border border-green-300 bg-green-50 p-3', className)}>
      {label ? <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">{label}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all text-sm text-[var(--text-theme)]">{value}</code>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-800"
          aria-label={copyLabel}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
