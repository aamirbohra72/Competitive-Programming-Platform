'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { fetchLearningSummary } from '@/lib/learningProgress';
import type { ContinueLearning } from '@/types/learning-progress';

export function ContinueLearningBanner() {
  const [item, setItem] = useState<ContinueLearning | null>(null);
  const [streak, setStreak] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setLoaded(true);
      return;
    }
    void fetchLearningSummary()
      .then((summary) => {
        if (!summary) return;
        setItem(summary.continueLearning);
        setStreak(summary.streak.currentStreak || 0);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || (!item?.lastItemHref && streak === 0)) return null;

  return (
    <section className="border-b border-[var(--border-theme)] bg-white px-6 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-green-700">
            Continue learning{streak > 0 ? ` · ${streak}-day streak` : ''}
          </p>
          {item?.lastItemHref ? (
            <>
              <h2 className="mt-1 text-lg font-bold text-[var(--text-theme)]">
                {item.title || 'Your course'} · {item.percent}%
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Resume {item.lastItemTitle || 'where you left off'}
              </p>
            </>
          ) : (
            <h2 className="mt-1 text-lg font-bold text-[var(--text-theme)]">Keep your streak going</h2>
          )}
        </div>
        {item?.lastItemHref ? (
          <Link
            href={item.lastItemHref}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            Continue
          </Link>
        ) : (
          <Link
            href="/learn"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            Open Courses
          </Link>
        )}
      </div>
    </section>
  );
}
