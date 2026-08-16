'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { DSA_TOPICS, getTotalProblems, loadCompletedIds, totalCompleted } from '@/data/dsa-sheet';
import { ROADMAPS, type Roadmap, type RoadmapStep } from '@/data/roadmaps';
import { fetchLearningSummary } from '@/lib/learningProgress';
import { getToken } from '@/lib/auth';
import type { LearningSummary } from '@/types/learning-progress';

const ACCENT: Record<Roadmap['accent'], { ring: string; badge: string; bar: string; soft: string }> = {
  teal: {
    ring: 'ring-teal-500/30',
    badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    bar: 'bg-teal-400',
    soft: 'from-teal-500/10 to-transparent',
  },
  amber: {
    ring: 'ring-amber-500/30',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    bar: 'bg-amber-400',
    soft: 'from-amber-500/10 to-transparent',
  },
  violet: {
    ring: 'ring-violet-500/30',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    bar: 'bg-violet-400',
    soft: 'from-violet-500/10 to-transparent',
  },
  sky: {
    ring: 'ring-sky-500/30',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    bar: 'bg-sky-400',
    soft: 'from-sky-500/10 to-transparent',
  },
  rose: {
    ring: 'ring-rose-500/30',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    bar: 'bg-rose-400',
    soft: 'from-rose-500/10 to-transparent',
  },
};

function stepPercent(
  step: RoadmapStep,
  summary: LearningSummary | null,
  dsaDone: number,
  dsaTotal: number,
): number | null {
  if (step.courseId) {
    const course = summary?.courses.find((c) => c.courseId === step.courseId);
    return course?.percent ?? 0;
  }
  if (step.dsaSheet) {
    if (dsaTotal <= 0) return 0;
    return Math.round((dsaDone / dsaTotal) * 100);
  }
  return null;
}

function roadmapPercent(
  roadmap: Roadmap,
  summary: LearningSummary | null,
  dsaDone: number,
  dsaTotal: number,
): number {
  const measurable = roadmap.steps
    .map((s) => stepPercent(s, summary, dsaDone, dsaTotal))
    .filter((p): p is number => p != null);
  if (measurable.length === 0) return 0;
  return Math.round(measurable.reduce((a, b) => a + b, 0) / measurable.length);
}

function isEnrolled(summary: LearningSummary | null, productId?: string): boolean {
  if (!productId || !summary) return false;
  return summary.enrollments.some((e) => e.productId === productId);
}

function kindLabel(kind: RoadmapStep['kind']): string {
  switch (kind) {
    case 'course':
      return 'Course';
    case 'dsa':
      return 'DSA Sheet';
    case 'practice':
      return 'Practice';
    case 'interview':
      return 'Interview';
    case 'visualizer':
      return 'Visualizer';
    case 'projects':
      return 'Projects';
    case 'communication':
      return 'Communication';
    default:
      return 'Step';
  }
}

export function RoadmapsView() {
  const [summary, setSummary] = useState<LearningSummary | null>(null);
  const [dsaDone, setDsaDone] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(ROADMAPS[0]?.id ?? null);
  const [signedIn, setSignedIn] = useState(false);

  const dsaTotal = useMemo(() => getTotalProblems(DSA_TOPICS), []);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const doneIds = loadCompletedIds();
      setDsaDone(totalCompleted(doneIds, DSA_TOPICS));
    } catch {
      setDsaDone(0);
    }

    // Show roadmaps immediately; hydrate course progress separately.
    setLoading(false);

    const token = getToken();
    setSignedIn(Boolean(token));
    if (!token) {
      setSummary(null);
      return;
    }

    try {
      const me = await fetchLearningSummary();
      setSummary(me);
    } catch (e) {
      setSummary(null);
      setError(e instanceof Error ? e.message : 'Could not sync course progress');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <DashboardShell mainClassName="min-h-0 overflow-y-auto p-0">
      <div className="relative">
        <header className="border-b border-white/[0.06] bg-[#161616]">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-400/90">
              Learning paths
            </p>
            <h1 className="mt-3 font-nav-brand text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              Roadmaps
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/65">
              Follow a curated path across courses, DSA sheet, practice, visualizers, and interviews.
              Progress updates from your real learning activity — not static placeholders.
            </p>
            {!signedIn && !loading ? (
              <p className="mt-4 text-sm text-amber-200/90">
                <Link href="/sign-in?redirect_url=/roadmaps" className="font-semibold underline">
                  Sign in
                </Link>{' '}
                to sync course progress. DSA sheet progress still works locally.
              </p>
            ) : null}
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {error ? (
            <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Course progress sync failed ({error}). Roadmaps still work — DSA progress is local.{' '}
              <button type="button" className="underline" onClick={() => void refresh()}>
                Retry
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-5">
              {ROADMAPS.map((roadmap) => {
                const accent = ACCENT[roadmap.accent];
                const percent = roadmapPercent(roadmap, summary, dsaDone, dsaTotal);
                const open = openId === roadmap.id;
                const nextStep =
                  roadmap.steps.find((s) => {
                    const p = stepPercent(s, summary, dsaDone, dsaTotal);
                    return p == null || p < 100;
                  }) ?? roadmap.steps[0];

                return (
                  <article
                    key={roadmap.id}
                    className={`overflow-hidden rounded-xl border border-white/[0.08] bg-[#1f1f1f] ring-1 ${accent.ring}`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setOpenId(open ? null : roadmap.id)}
                      aria-expanded={open}
                    >
                      <div className={`bg-gradient-to-r ${accent.soft} px-5 py-5 sm:px-6`}>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-nav-brand text-xl font-semibold text-white sm:text-2xl">
                                {roadmap.title}
                              </h2>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${accent.badge}`}
                              >
                                {roadmap.level}
                              </span>
                            </div>
                            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/60">
                              {roadmap.description}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {roadmap.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/70"
                                >
                                  {tag}
                                </span>
                              ))}
                              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/50">
                                ~{roadmap.estimatedWeeks} weeks
                              </span>
                              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/50">
                                {roadmap.steps.length} steps
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-2xl font-bold text-white">{percent}%</div>
                            <div className="text-xs text-white/45">overall progress</div>
                            <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full ${accent.bar}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>

                    {open ? (
                      <div className="border-t border-white/[0.06] px-5 py-5 sm:px-6">
                        <ol className="space-y-3">
                          {roadmap.steps.map((step, index) => {
                            const p = stepPercent(step, summary, dsaDone, dsaTotal);
                            const enrolled = isEnrolled(summary, step.productId);
                            return (
                              <li
                                key={step.id}
                                className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-[#242424] p-4 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/80">
                                      {index + 1}
                                    </span>
                                    <h3 className="font-semibold text-white">{step.title}</h3>
                                    <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/45">
                                      {kindLabel(step.kind)}
                                    </span>
                                    {enrolled ? (
                                      <span className="rounded border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-300">
                                        Enrolled
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-sm text-white/55">{step.description}</p>
                                  {p != null ? (
                                    <div className="mt-2 flex items-center gap-2">
                                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                                        <div
                                          className={`h-full rounded-full ${accent.bar}`}
                                          style={{ width: `${p}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-white/45">{p}%</span>
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-xs text-white/40">Explore step — open to continue</p>
                                  )}
                                </div>
                                <Link
                                  href={step.href}
                                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-green-500 px-3.5 py-2 text-sm font-semibold text-[#052e16] transition hover:bg-green-400"
                                >
                                  {p != null && p >= 100 ? 'Review' : p != null && p > 0 ? 'Continue' : 'Start'}
                                </Link>
                              </li>
                            );
                          })}
                        </ol>

                        {nextStep ? (
                          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-500/25 bg-green-500/5 px-4 py-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-green-400/90">
                                Next up
                              </p>
                              <p className="text-sm text-white">{nextStep.title}</p>
                            </div>
                            <Link
                              href={nextStep.href}
                              className="rounded-lg border border-green-500/40 px-3 py-1.5 text-sm font-semibold text-green-300 hover:bg-green-500/10"
                            >
                              Go →
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
        </div>
      </div>
    </DashboardShell>
  );
}
