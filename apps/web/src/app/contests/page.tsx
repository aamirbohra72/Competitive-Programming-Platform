'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DashboardShell } from '@/components/DashboardShell';
import type { Contest, ContestStatus } from '@codeforces/types';

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function statusMeta(status: ContestStatus) {
  switch (status) {
    case 'UPCOMING':
      return { label: 'Upcoming', bg: '#f59e0b', color: '#111' };
    case 'LIVE':
      return { label: 'Live', bg: '#22c55e', color: '#052e16' };
    case 'ENDED':
      return { label: 'Ended', bg: '#6b7280', color: '#fff' };
    default:
      return { label: status, bg: '#374151', color: '#fff' };
  }
}

function ContestCountdown({ contest, now }: { contest: Contest; now: number }) {
  const status = contest.effectiveStatus || contest.status;
  const start = new Date(contest.startTime).getTime();
  const end = new Date(contest.endTime).getTime();

  if (status === 'UPCOMING') {
    return (
      <span style={{ color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>
        Starts in {formatDuration(Math.max(0, start - now))}
      </span>
    );
  }
  if (status === 'LIVE') {
    return (
      <span style={{ color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
        Ends in {formatDuration(Math.max(0, end - now))}
      </span>
    );
  }
  return <span style={{ color: 'var(--text-muted)' }}>Finished {new Date(contest.endTime).toLocaleString()}</span>;
}

export default function ContestsPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContestStatus | ''>('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void fetchContests();
  }, [statusFilter]);

  const fetchContests = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.set('pageSize', '50');
      if (statusFilter) params.set('status', statusFilter);
      const response = await api.get<{ data: Contest[] }>(`/contests?${params.toString()}`);
      setContests(response.data ?? []);
    } catch (err) {
      console.error('Failed to fetch contests:', err);
      setError(err instanceof Error ? err.message : 'Failed to load contests');
      setContests([]);
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const live = contests.filter((c) => (c.effectiveStatus || c.status) === 'LIVE');
    const upcoming = contests.filter((c) => (c.effectiveStatus || c.status) === 'UPCOMING');
    const ended = contests.filter((c) => (c.effectiveStatus || c.status) === 'ENDED');
    return { live, upcoming, ended };
  }, [contests]);

  const renderCard = (contest: Contest) => {
    const status = contest.effectiveStatus || contest.status;
    const meta = statusMeta(status);
    const durationMs =
      contest.durationMs ??
      Math.max(0, new Date(contest.endTime).getTime() - new Date(contest.startTime).getTime());

    return (
      <Link
        key={contest.id}
        href={`/contests/${contest.id}`}
        style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      >
        <article
          style={{
            background: 'var(--surface-raised)',
            border: status === 'LIVE' ? '1px solid var(--accent-theme)' : '1px solid var(--border-theme)',
            borderRadius: 10,
            padding: '1.25rem 1.5rem',
            marginBottom: '0.85rem',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-theme)' }}>{contest.name}</h2>
                {contest.kind && contest.kind !== 'PRACTICE' && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-theme)',
                      borderRadius: 4,
                      padding: '0.1rem 0.4rem',
                    }}
                  >
                    {contest.kind}
                  </span>
                )}
              </div>
              {contest.description && (
                <p
                  style={{
                    margin: '0.5rem 0 0.75rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.9rem',
                    lineHeight: 1.45,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {contest.description}
                </p>
              )}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.85rem 1.25rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-theme)',
                }}
              >
                <ContestCountdown contest={contest} now={now} />
                <span style={{ color: 'var(--text-muted)' }}>
                  {contest.problemCount ?? 0} problem{(contest.problemCount ?? 0) === 1 ? '' : 's'}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {contest.participantCount ?? 0} registered
                </span>
                <span style={{ color: 'var(--text-muted)' }}>Duration {formatDuration(durationMs)}</span>
                {contest.isRegistered && (
                  <span style={{ color: 'var(--accent-theme)' }}>You&apos;re registered</span>
                )}
              </div>
              <div style={{ marginTop: '0.55rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {new Date(contest.startTime).toLocaleString()} → {new Date(contest.endTime).toLocaleString()}
              </div>
            </div>
            <span
              style={{
                flexShrink: 0,
                padding: '0.3rem 0.75rem',
                borderRadius: 999,
                background: meta.bg,
                color: meta.color,
                fontWeight: 700,
                fontSize: '0.75rem',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}
            >
              {meta.label}
            </span>
          </div>
        </article>
      </Link>
    );
  };

  const renderSection = (title: string, items: Contest[], emptyHint: string) => {
    if (statusFilter && items.length === 0) return null;
    if (!statusFilter && items.length === 0) return null;
    return (
      <section style={{ marginBottom: '2rem' }}>
        <h2
          style={{
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            marginBottom: '0.75rem',
          }}
        >
          {title} ({items.length})
        </h2>
        {items.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>{emptyHint}</p> : items.map(renderCard)}
      </section>
    );
  };

  return (
    <DashboardShell mainClassName="p-8">
      <div className="container text-[var(--text-theme)]" style={{ maxWidth: 920 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.75rem',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Contests</h1>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Live, upcoming, and past rounds — times update automatically.
            </p>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContestStatus | '')}
            aria-label="Filter contests by status"
            className="rounded border border-[var(--border-theme)] bg-white px-3 py-2 text-sm text-[var(--text-theme)]"
          >
            <option value="">All Status</option>
            <option value="LIVE">Live</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="ENDED">Ended</option>
          </select>
        </div>

        {loading && <p style={{ color: 'var(--text-muted)' }}>Loading contests…</p>}
        {error && <p style={{ color: '#f87171' }}>{error}</p>}

        {!loading && !error && contests.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>No contests found for this filter.</p>
        )}

        {!loading && !error && contests.length > 0 && (
          <>
            {(!statusFilter || statusFilter === 'LIVE') &&
              renderSection('Live now', grouped.live, 'No live contests')}
            {(!statusFilter || statusFilter === 'UPCOMING') &&
              renderSection('Upcoming', grouped.upcoming, 'No upcoming contests')}
            {(!statusFilter || statusFilter === 'ENDED') &&
              renderSection('Past contests', grouped.ended, 'No past contests')}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
