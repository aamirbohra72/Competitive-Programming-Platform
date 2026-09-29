'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DSA_TOPICS,
  getTotalProblems,
  loadCompletedIds,
  saveCompletedIds,
  totalCompleted,
} from '@/data/dsa-sheet';
import { DsaTopicAccordion } from '@/components/dsa-sheet/DsaTopicAccordion';
import { DsaProgressBar } from '@/components/dsa-sheet/DsaProgressBar';
import { DsaProgressRing } from '@/components/dsa-sheet/DsaProgressRing';
import { DsaFloatingActions } from '@/components/dsa-sheet/DsaFloatingActions';
import { DashboardShell } from '@/components/DashboardShell';

export function DsaSheetView() {
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [openTopics, setOpenTopics] = useState<Set<string>>(() => new Set(['foundation']));

  useEffect(() => {
    setCompletedIds(loadCompletedIds());
    setHydrated(true);
  }, []);

  const total = useMemo(() => getTotalProblems(DSA_TOPICS), []);
  const done = useMemo(() => totalCompleted(completedIds, DSA_TOPICS), [completedIds]);

  const toggleTopic = useCallback((id: string) => {
    setOpenTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleProblem = useCallback((problemId: string, completed: boolean) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (completed) next.add(problemId);
      else next.delete(problemId);
      saveCompletedIds(next);
      return next;
    });
  }, []);

  return (
    <DashboardShell mainClassName="min-h-0 overflow-y-auto p-0">
      <div className="relative">
        <header className="border-b border-[var(--border-theme)] bg-[var(--surface-panel)]">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">Curated path</p>
            <h1 className="mt-3 font-nav-brand text-3xl font-bold leading-tight text-[var(--text-theme)] sm:text-4xl lg:text-5xl">
              Master Data Structures & Algorithms{' '}
              <span aria-hidden className="inline-block">
                🚀
              </span>
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[var(--text-muted)]">
              We&apos;ve{' '}
              <span className="font-semibold text-amber-700">handpicked</span> the{' '}
              <span className="font-semibold text-green-700">most impactful DSA questions</span> that sharpen your
              problem-solving and help you{' '}
              <span className="font-semibold text-amber-700">crack real interviews with confidence</span>.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {!hydrated ? (
            <p className="text-sm text-[var(--text-muted)]">Loading progress…</p>
          ) : (
            <>
              <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 rounded-lg border border-[var(--border-theme)] bg-white p-6 shadow-sm">
                  <DsaProgressBar completed={done} total={total} />
                </div>
                <div className="flex justify-center sm:justify-end shrink-0 sm:pt-1">
                  <DsaProgressRing completed={done} total={total} />
                </div>
              </div>

              <div className="space-y-3">
                {DSA_TOPICS.map((topic) => (
                  <DsaTopicAccordion
                    key={topic.id}
                    topic={topic}
                    isOpen={openTopics.has(topic.id)}
                    onToggle={() => toggleTopic(topic.id)}
                    completedIds={completedIds}
                    onToggleProblem={toggleProblem}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <DsaFloatingActions />
      </div>
    </DashboardShell>
  );
}
