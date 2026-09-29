import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type BlogSectionTitleProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

/** Accent bar + uppercase tracking to match dashboard section styling. */
export function BlogSectionTitle({ children, className, id }: BlogSectionTitleProps) {
  return (
    <h2
      id={id}
      className={cn(
        'flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-green-700',
        className,
      )}
    >
      <span className="h-px w-8 bg-green-500/80" aria-hidden />
      {children}
    </h2>
  );
}
