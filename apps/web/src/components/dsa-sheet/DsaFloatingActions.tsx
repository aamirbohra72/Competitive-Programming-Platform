'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export function DsaFloatingActions() {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 320);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const share = useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'DSA Sheet', text: 'Track DSA progress', url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      /* user cancelled or clipboard denied */
    }
  }, []);

  const toTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={share}
        className={cn(
          'fixed right-4 top-1/2 z-40 -translate-y-1/2',
          'flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-theme)] bg-white text-green-700 shadow-lg shadow-green-900/10',
          'transition-colors hover:border-green-400 hover:bg-green-50',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
        )}
        aria-label="Share or copy link"
        title="Share sheet"
      >
        <span className="relative inline-flex text-green-700">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <circle cx="18" cy="5" r="3" strokeWidth="2" />
            <circle cx="6" cy="12" r="3" strokeWidth="2" />
            <circle cx="18" cy="19" r="3" strokeWidth="2" />
            <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-600 ring-2 ring-white" />
        </span>
      </button>

      <button
        type="button"
        onClick={toTop}
        className={cn(
          'fixed bottom-6 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full',
          'bg-green-700 text-white shadow-lg shadow-green-900/10 transition-opacity',
          'hover:bg-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
          !showTop && 'pointer-events-none opacity-0',
        )}
        aria-label="Back to top"
        title="Top"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  );
}
