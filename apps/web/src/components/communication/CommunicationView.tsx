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
        <header className="border-b border-white/[0.06] bg-[#161616]">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300/90">
              Soft skills · Live via Mistral
            </p>
            <h1 className="mt-3 font-nav-brand text-3xl font-bold leading-tight text-white sm:text-4xl">
              Meeting communication
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/65">
              Practice day-to-day software meetings — standups, planning, 1:1s, design reviews, retros,
              and stakeholder updates. Get AI coaching on what you would actually say.
            </p>
            <p className="mt-3 text-sm text-white/45">
              Part of{' '}
              <Link href="/roadmaps" className="text-teal-300 hover:underline">
                Roadmaps
              </Link>
              {' · '}
              scenarios refresh with Mistral when available
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {error ? (
            <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {error}
            </div>
          ) : null}

          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
              Choose a meeting
            </h2>
            {loadingTypes ? (
              <p className="text-sm text-white/50">Loading meeting types…</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {types.map((t) => {
                  const active = t.id === selected;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelected(t.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? 'border-teal-400/50 bg-teal-500/10 ring-1 ring-teal-400/30'
                          : 'border-white/10 bg-[#242424] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-white">{t.title}</h3>
                        <span className="text-[11px] text-white/40">{t.duration}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-white/55">{t.blurb}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {t.focus.map((f) => (
                          <span
                            key={f}
                            className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/60"
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

          <section className="rounded-xl border border-white/[0.08] bg-[#1f1f1f] p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-nav-brand text-xl font-semibold text-white">
                  {selectedMeta?.title ?? 'Scenario'}
                </h2>
                <p className="text-sm text-white/45">
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
                className="rounded-lg border border-white/15 bg-[#2a2a2a] px-3 py-1.5 text-sm font-semibold text-white hover:border-teal-400/40 disabled:opacity-50"
              >
                {loadingScenario ? 'Generating…' : 'New scenario'}
              </button>
            </div>

            {loadingScenario && !scenario ? (
              <p className="text-sm text-white/50">Asking Mistral for a realistic meeting scenario…</p>
            ) : null}

            {scenario ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-white">{scenario.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">{scenario.setting}</p>
                  <p className="mt-2 text-sm text-teal-200/90">
                    Your role: <span className="font-semibold">{scenario.yourRole}</span>
                  </p>
                  <p className="mt-1 text-sm text-white/50">Also in the room: {scenario.others.join(' · ')}</p>
                </div>

                <div className="rounded-lg border border-teal-500/25 bg-teal-500/5 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">Your prompt</p>
                  <p className="mt-1 text-sm text-white">{scenario.prompt}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">Goals</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                      {scenario.goals.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">
                      Pitfalls to avoid
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                      {scenario.pitfalls.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white" htmlFor="meeting-response">
                    What would you say?
                  </label>
                  <textarea
                    id="meeting-response"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={6}
                    placeholder="Write it like spoken dialogue — what you would say in the meeting…"
                    className="w-full rounded-lg border border-white/10 bg-[#121212] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-teal-400/50 focus:outline-none"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loadingCoach}
                      onClick={() => void runCoach()}
                      className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-[#042f2e] hover:bg-teal-400 disabled:opacity-50"
                    >
                      {loadingCoach ? 'Coaching…' : 'Get Mistral coaching'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSample((v) => !v)}
                      className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5"
                    >
                      {showSample ? 'Hide sample' : 'Show strong sample'}
                    </button>
                  </div>
                </div>

                {showSample ? (
                  <div className="rounded-lg border border-white/10 bg-[#242424] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
                      Sample strong answer
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/80">{scenario.sampleStrongAnswer}</p>
                  </div>
                ) : null}

                {coach ? (
                  <div className="rounded-xl border border-white/10 bg-[#242424] p-4 sm:p-5">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">Coach feedback</p>
                        <p className="mt-1 text-lg font-semibold text-white">{coach.verdict}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-teal-300">{coach.score}</div>
                        <div className="text-xs text-white/45">/ 100 · {coach.source}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase text-green-300/90">Strengths</p>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                          {coach.strengths.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase text-amber-300/90">Improve</p>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                          {coach.improvements.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">Stronger rewrite</p>
                      <p className="mt-2 text-sm leading-relaxed text-white">{coach.rewritten}</p>
                    </div>
                    <p className="mt-3 text-sm text-white/55">Next tip: {coach.nextTip}</p>
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
