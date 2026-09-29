'use client';

import { useOptionalDashboardSidebar } from '@/contexts/DashboardSidebarContext';
import { cn } from '@/lib/cn';

export type SidebarTriggerProps = {
  className?: string;
};

/**
 * Hamburger toggle for the dashboard sidebar. Renders nothing when used outside
 * `DashboardSidebarProvider` (e.g. Practice page with navbar only).
 */
export function SidebarTrigger({ className }: SidebarTriggerProps) {
  const ctx = useOptionalDashboardSidebar();
  if (!ctx) return null;

  const { isOpen, toggle, sidebarId } = ctx;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={isOpen}
      aria-controls={sidebarId}
      aria-label={isOpen ? 'Close sidebar navigation' : 'Open sidebar navigation'}
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[var(--text-theme)]',
        'hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        className,
      )}
    >
      <span className="sr-only">{isOpen ? 'Close menu' : 'Open menu'}</span>
      {isOpen ? <IconClose /> : <IconHamburger />}
    </button>
  );
}

function IconHamburger() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="block">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="block">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
