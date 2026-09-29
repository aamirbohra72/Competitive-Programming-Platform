'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { api } from '@/lib/api';

type MeetingTypeMeta = {
  id: string;
  title: string;
  blurb: string;
  duration: string;
  focus: string[];
};

type MeetingScenario = {
  meetingType: string;
  title: string;
  setting: string;
  yourRole: string;
  others: string[];
  prompt: string;
  goals: string[];
  pitfalls: string[];
  sampleStrongAnswer: string;
  source: 'mistral' | 'fallback';
  generatedAt: string;
};

type CoachResult = {
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  rewritten: string;
  nextTip: string;
  source: 'mistral' | 'fallback';
};

export function CommunicationView() {
  const [types, setTypes] = useState<MeetingTypeMeta[]>([]);
  const [selected, setSelected] = useState<string>('daily-standup');
  const [scenario, setScenario] = useState<MeetingScenario | null>(null);
  const [response, setResponse] = useState('');
  const [coach, setCoach] = useState<CoachResult | null>(null);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [error, setError] = useState('');
  const [showSample, setShowSample] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTypes(true);
      try {
        const res = await api.get<{ types: MeetingTypeMeta[] }>('/communication/types');
        if (!cancelled) {
          setTypes(res.types);
          if (res.types[0]) setSelected(res.types[0].id);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load meeting types');
        }
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadScenario = useCallback(async (meetingType: string) => {
    setLoadingScenario(true);
    setError('');
    setCoach(null);
    setResponse('');
    setShowSample(false);
    try {
      const res = await api.post<MeetingScenario>('/communication/scenario', { meetingType });
      setScenario(res);
    } catch (e) {
      setScenario(null);
      setError(e instanceof Error ? e.message : 'Failed to generate scenario');
    } finally {
      setLoadingScenario(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void loadScenario(selected);
  }, [selected, loadScenario]);

  const runCoach = async () => {
    if (!scenario) return;
    if (response.trim().length < 20) {
      setError('Write at least a short spoken response (20+ characters) before coaching.');
      return;
    }
    setLoadingCoach(true);
    setError('');
    try {
      const res = await api.post<CoachResult>('/communication/coach', {
        meetingType: scenario.meetingType,
        scenario,
        userResponse: response.trim(),
      });
      setCoach(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Coaching failed');
    } finally {
      setLoadingCoach(false);
    }
  };

  const selectedMeta = types.find((t) => t.id === selected);

  return (
    <DashboardShell mainClassName="min-h-0 overflow-y-auto p-0">
      <div className="relative">
        <header className="border-b border-[var(--border-theme)] bg-[var(--surface-panel)]">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
              Soft skills · Live via Mistral
            </p>
            <h1 className="mt-3 font-nav-brand text-3xl font-bold leading-tight text-[var(--text-theme)] sm:text-4xl">
              Meeting communication
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[var(--text-muted)]">
              Practice day-to-day software meetings — standups, planning, 1:1s, design reviews, retros,
              and stakeholder updates. Get AI coaching on what you would actually say.
            </p>
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Part of{' '}
              <Link href="/roadmaps" className="font-semibold text-green-700 hover:underline">
                Roadmaps
              </Link>
              {' · '}
              scenarios refresh with Mistral when available
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {error ? (
            <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          ) : null}

          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Choose a meeting
            </h2>
            {loadingTypes ? (
              <p className="text-sm text-[var(--text-muted)]">Loading meeting types…</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {types.map((t) => {
                  const active = t.id === selected;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelected(t.id)}
                      className={`rounded-lg border p-4 text-left transition ${
                        active
                          ? 'border-green-500 bg-green-50 ring-1 ring-green-200'
                          : 'border-[var(--border-theme)] bg-white hover:border-green-400 hover:bg-green-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-[var(--text-theme)]">{t.title}</h3>
                        <span className="text-[11px] text-[var(--text-muted)]">{t.duration}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{t.blurb}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {t.focus.map((f) => (
                          <span
                            key={f}
                            className="rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-800"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="border-t border-[var(--border-theme)] bg-[var(--surface-panel)] p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-nav-brand text-xl font-semibold text-[var(--text-theme)]">
                  {selectedMeta?.title ?? 'Scenario'}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {scenario?.source === 'mistral'
                    ? 'Generated with Mistral'
                    : scenario?.source === 'fallback'
                      ? 'Fallback scenario (Mistral unavailable)'
                      : 'Preparing scenario…'}
                </p>
              </div>
              <button
                type="button"
                disabled={loadingScenario || !selected}
                onClick={() => void loadScenario(selected)}
                className="rounded-lg border border-[var(--border-theme)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text-theme)] hover:border-green-400 disabled:opacity-50"
              >
                {loadingScenario ? 'Generating…' : 'New scenario'}
              </button>
            </div>

            {loadingScenario && !scenario ? (
              <p className="text-sm text-[var(--text-muted)]">Asking Mistral for a realistic meeting scenario…</p>
            ) : null}

            {scenario ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-theme)]">{scenario.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{scenario.setting}</p>
                  <p className="mt-2 text-sm text-green-700">
                    Your role: <span className="font-semibold">{scenario.yourRole}</span>
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Also in the room: {scenario.others.join(' · ')}</p>
                </div>

                <div className="rounded-lg border border-green-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Your prompt</p>
                  <p className="mt-1 text-sm text-[var(--text-theme)]">{scenario.prompt}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Goals</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-theme)]">
                      {scenario.goals.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Pitfalls to avoid
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-theme)]">
                      {scenario.pitfalls.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[var(--text-theme)]" htmlFor="meeting-response">
                    What would you say?
                  </label>
                  <textarea
                    id="meeting-response"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={6}
                    placeholder="Write it like spoken dialogue — what you would say in the meeting…"
                    className="w-full rounded-lg border border-[var(--border-theme)] bg-white px-3 py-2.5 text-sm text-[var(--text-theme)] placeholder:text-[var(--text-muted)] focus:border-green-500 focus:outline-none"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loadingCoach}
                      onClick={() => void runCoach()}
                      className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                    >
                      {loadingCoach ? 'Coaching…' : 'Get Mistral coaching'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSample((v) => !v)}
                      className="rounded-lg border border-[var(--border-theme)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-theme)] hover:bg-green-50"
                    >
                      {showSample ? 'Hide sample' : 'Show strong sample'}
                    </button>
                  </div>
                </div>

                {showSample ? (
                  <div className="rounded-lg border border-[var(--border-theme)] bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Sample strong answer
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-theme)]">{scenario.sampleStrongAnswer}</p>
                  </div>
                ) : null}

                {coach ? (
                  <div className="rounded-lg border border-[var(--border-theme)] bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Coach feedback</p>
                        <p className="mt-1 text-lg font-semibold text-[var(--text-theme)]">{coach.verdict}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-green-700">{coach.score}</div>
                        <div className="text-xs text-[var(--text-muted)]">/ 100 · {coach.source}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase text-green-700">Strengths</p>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-theme)]">
                          {coach.strengths.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase text-amber-800">Improve</p>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-theme)]">
                          {coach.improvements.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Stronger rewrite</p>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--text-theme)]">{coach.rewritten}</p>
                    </div>
                    <p className="mt-3 text-sm text-[var(--text-muted)]">Next tip: {coach.nextTip}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
