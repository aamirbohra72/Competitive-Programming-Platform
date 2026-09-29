'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { TaHelpCreateModal, type TaHelpCreatePayload } from '@/components/ta-help/TaHelpCreateModal';
import { TaHelpRequestCard } from '@/components/ta-help/TaHelpRequestCard';
import { cn } from '@/lib/cn';
import { getToken, getUser, isAdmin } from '@/lib/auth';
import {
  createTaHelpRequestApi,
  fetchMyTaHelpRequests,
  submitTaHelpFeedbackApi,
} from '@/lib/taHelpApi';
import {
  TA_HELP_TABS,
  type TaHelpRequest,
  type TaHelpStatus,
  countByStatus,
} from '@/data/ta-help';

export function TaHelpDashboard() {
  const [requests, setRequests] = useState<TaHelpRequest[]>([]);
  const [tab, setTab] = useState<TaHelpStatus>('waiting');
  const [createOpen, setCreateOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const staff = isAdmin() || getUser()?.role === 'TA';

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setRequests([]);
      setLoading(false);
      setError('Sign in to view and raise TA help requests.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchMyTaHelpRequests();
      setRequests(data.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load TA help');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener('ta-help:updated', onUpdate);
    window.addEventListener('focus', onUpdate);
    return () => {
      window.removeEventListener('ta-help:updated', onUpdate);
      window.removeEventListener('focus', onUpdate);
    };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const counts = useMemo(() => countByStatus(requests), [requests]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (r.status !== tab) return false;
      if (topicFilter !== 'all' && r.topic !== topicFilter) return false;
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      return true;
    });
  }, [requests, tab, topicFilter, typeFilter]);

  const topics = useMemo(() => {
    const set = new Set(requests.map((r) => r.topic));
    return Array.from(set).sort();
  }, [requests]);

  const onCreate = useCallback(
    async (payload: TaHelpCreatePayload) => {
      try {
        await createTaHelpRequestApi({ ...payload, source: 'web' });
        setCreateOpen(false);
        setTab('waiting');
        setToast('Help request submitted. A TA will pick it up soon.');
        await refresh();
      } catch (e) {
        setToast(e instanceof Error ? e.message : 'Failed to submit request');
      }
    },
    [refresh],
  );

  const onSatisfied = useCallback(
    async (id: string, satisfied: boolean) => {
      try {
        await submitTaHelpFeedbackApi(id, {
          satisfied,
          rating: satisfied ? 5 : undefined,
        });
        setToast(satisfied ? 'Thanks for the feedback.' : 'We noted your feedback.');
        await refresh();
      } catch (e) {
        setToast(e instanceof Error ? e.message : 'Failed to save feedback');
      }
    },
    [refresh],
  );

  const onRate = useCallback(
    async (id: string, rating: number) => {
      try {
        await submitTaHelpFeedbackApi(id, { rating, satisfied: true });
        setToast('Rating saved. Thanks!');
        await refresh();
      } catch (e) {
        setToast(e instanceof Error ? e.message : 'Failed to save rating');
      }
    },
    [refresh],
  );

  return (
    <DashboardShell mainClassName="relative min-h-0 overflow-y-auto p-4 pb-20 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--text-theme)] md:text-3xl">TA Help</h1>
              <span className="rounded-full bg-green-700 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Live queue
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Raise text or video help requests — synced to the database and visible to TAs.
            </p>
            {staff ? (
              <Link
                href="/ta-help/desk"
                className="mt-2 inline-block text-sm font-semibold text-sky-700 hover:text-sky-800"
              >
                Open TA Desk →
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!getToken()) {
                window.location.href = '/sign-in?redirect_url=/ta-help';
                return;
              }
              setCreateOpen(true);
            }}
            className="shrink-0 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800"
          >
            Ask Support
          </button>
        </header>

        <nav
          className="flex gap-1 overflow-x-auto border-b border-[var(--border-theme)]"
          aria-label="Request status"
        >
          {TA_HELP_TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition',
                  active
                    ? 'border-green-700 text-green-800'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-theme)]',
                )}
              >
                {t.label} ({counts[t.id]})
              </button>
            );
          })}
        </nav>

        <div
          className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
          role="note"
        >
          <span className="mt-0.5 shrink-0" aria-hidden>
            ⏱️
          </span>
          <p>
            Requests stay in Waiting until a TA claims them. After a TA replies, check the Replied
            tab — then mark resolved when you&apos;re done.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-800"
          >
            {showFilters ? 'Hide filters' : 'See all filters'}
          </button>
          <p className="text-xs text-[var(--text-muted)]">
            Showing {filtered.length} of {counts[tab]} in this tab
          </p>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] p-4">
            <label className="text-xs text-[var(--text-muted)]">
              Topic
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="mt-1 block rounded-lg border border-[var(--border-theme)] bg-white px-3 py-2 text-sm text-[var(--text-theme)] outline-none focus:border-green-500"
              >
                <option value="all">All topics</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[var(--text-muted)]">
              Type
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="mt-1 block rounded-lg border border-[var(--border-theme)] bg-white px-3 py-2 text-sm text-[var(--text-theme)] outline-none focus:border-green-500"
              >
                <option value="all">All types</option>
                <option value="text">Text HR</option>
                <option value="video">Video call HR</option>
              </select>
            </label>
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading your requests…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border-theme)] bg-[var(--surface-panel)] px-6 py-12 text-center">
              <p className="text-sm font-medium text-[var(--text-theme)]">No requests in this tab</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Raise a new help request or switch tabs to see other statuses.
              </p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-4 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
              >
                Ask Support
              </button>
            </div>
          ) : (
            filtered.map((req) => (
              <TaHelpRequestCard
                key={req.id}
                request={req}
                onSatisfied={(id, satisfied) => void onSatisfied(id, satisfied)}
                onRate={(id, rating) => void onRate(id, rating)}
              />
            ))
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-700 text-2xl text-white shadow-lg shadow-green-900/10 transition hover:bg-green-800"
        aria-label="New help request"
        title="New help request"
      >
        📝
      </button>

      <TaHelpCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(payload) => void onCreate(payload)}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 right-6 z-[1100] max-w-sm rounded-lg bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </DashboardShell>
  );
}
