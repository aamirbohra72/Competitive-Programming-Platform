'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { Navbar } from '@/components/Navbar';
import type { Contest, Challenge, ContestStatus, ContestMeResponse } from '@codeforces/types';

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

export default function ContestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contestId = params.id as string;
  const [contest, setContest] = useState<Contest | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [me, setMe] = useState<ContestMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const fetchMe = useCallback(async () => {
    if (!isAuthenticated()) {
      setMe(null);
      return;
    }
    try {
      const data = await api.get<ContestMeResponse>(`/contests/${contestId}/me`);
      setMe(data);
    } catch {
      setMe(null);
    }
  }, [contestId]);

  const fetchContest = useCallback(async () => {
    try {
      const data = await api.get<Contest>(`/contests/${contestId}`);
      setContest(data);
    } catch (error) {
      console.error('Failed to fetch contest:', error);
    }
  }, [contestId]);

  const fetchChallenges = useCallback(async () => {
    try {
      const data = await api.get<Challenge[]>(`/contests/${contestId}/challenges`);
      setChallenges(data);
    } catch (error) {
      // Upcoming contests intentionally hide statements until start.
      setChallenges([]);
      console.error('Failed to fetch challenges:', error);
    }
  }, [contestId]);

  useEffect(() => {
    if (!contestId) return;
    setLoading(true);
    void Promise.all([fetchContest(), fetchChallenges(), fetchMe()]).finally(() =>
      setLoading(false),
    );
  }, [contestId, fetchContest, fetchChallenges, fetchMe]);

  const handleRegister = async () => {
    if (!isAuthenticated()) {
      router.push(`/sign-in?redirect_url=/contests/${contestId}`);
      return;
    }
    setRegBusy(true);
    setRegError('');
    try {
      await api.post(`/contests/${contestId}/register`);
      await Promise.all([fetchContest(), fetchMe()]);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setRegBusy(false);
    }
  };

  const handleUnregister = async () => {
    setRegBusy(true);
    setRegError('');
    try {
      await api.delete(`/contests/${contestId}/register`);
      await Promise.all([fetchContest(), fetchMe()]);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Could not unregister');
    } finally {
      setRegBusy(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container">Loading...</div>
      </>
    );
  }

  if (!contest) {
    return (
      <>
        <Navbar />
        <div className="container">Contest not found</div>
      </>
    );
  }

  const status: ContestStatus = contest.effectiveStatus || contest.status;
  const start = new Date(contest.startTime).getTime();
  const end = new Date(contest.endTime).getTime();
  const countdown =
    status === 'UPCOMING'
      ? `Starts in ${formatDuration(Math.max(0, start - now))}`
      : status === 'LIVE'
        ? `Ends in ${formatDuration(Math.max(0, end - now))}`
        : 'Contest has ended';

  const needsRegistration = contest.kind !== 'PRACTICE';
  const registered = me?.registered ?? contest.isRegistered ?? false;
  const canRegister = me?.canRegister ?? (needsRegistration && status !== 'ENDED' && !registered);
  const canUnregister = me?.canUnregister ?? (registered && status === 'UPCOMING');
  const problemsLocked = needsRegistration && status === 'UPCOMING';
  const submitBlocked = needsRegistration && status === 'LIVE' && !registered;
  const postContestPractice = needsRegistration && status === 'ENDED';

  return (
    <>
      <Navbar />
      <div className="container">
        <Link href="/contests" style={{ marginBottom: '1rem', display: 'inline-block' }}>
          ← Back to Contests
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
          <div>
            <h1>{contest.name}</h1>
            {contest.description && (
              <p style={{ marginTop: '1rem', marginBottom: '1rem' }}>{contest.description}</p>
            )}
          </div>
          <span
            style={{
              padding: '0.3rem 0.75rem',
              borderRadius: 999,
              background: status === 'LIVE' ? '#22c55e' : status === 'UPCOMING' ? '#f59e0b' : '#6b7280',
              color: status === 'ENDED' ? '#fff' : '#111',
              fontWeight: 700,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            {status}
          </span>
        </div>

        <div
          style={{
            marginBottom: '1.5rem',
            display: 'flex',
            gap: '1.5rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div>Start: {new Date(contest.startTime).toLocaleString()}</div>
            <div>End: {new Date(contest.endTime).toLocaleString()}</div>
            <div style={{ marginTop: 4, fontWeight: 600 }}>{countdown}</div>
            <div style={{ color: '#666', fontSize: '0.9rem', marginTop: 4 }}>
              {contest.problemCount ?? challenges.length} problems
              {' · '}
              {contest.participantCount ?? 0} registered
              {contest.kind ? ` · ${contest.kind}` : ''}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {needsRegistration && canRegister && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={regBusy}
                onClick={() => void handleRegister()}
              >
                {regBusy ? 'Registering…' : 'Register'}
              </button>
            )}
            {needsRegistration && registered && (
              <span
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: 6,
                  background: '#dcfce7',
                  color: '#166534',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                Registered
              </span>
            )}
            {needsRegistration && canUnregister && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={regBusy}
                onClick={() => void handleUnregister()}
              >
                Unregister
              </button>
            )}
            {(status === 'LIVE' || status === 'ENDED') && (
              <Link href={`/contests/${contestId}/leaderboard`} className="btn btn-primary">
                View Leaderboard
              </Link>
            )}
          </div>
        </div>

        {regError && (
          <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{regError}</p>
        )}

        {submitBlocked && (
          <p
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              background: '#fef3c7',
              color: '#92400e',
              borderRadius: 6,
            }}
          >
            Register to submit solutions during this live contest. Submissions count toward the leaderboard.
          </p>
        )}

        {postContestPractice && (
          <p
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              background: '#ecfdf5',
              color: '#065f46',
              borderRadius: 6,
            }}
          >
            Contest ended — you can still practice these problems. New submits will not change the leaderboard.
          </p>
        )}

        <h2 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Challenges</h2>
        {problemsLocked ? (
          <p style={{ color: '#666' }}>
            Problem statements unlock when the contest starts. Register now so you are ready.
          </p>
        ) : challenges.length === 0 ? (
          <p>No challenges available</p>
        ) : (
          <div>
            {challenges.map((challenge) => (
              <div key={challenge.id} className="card">
                <Link href={`/practice/${challenge.id}`}>
                  <h3 style={{ marginBottom: '0.5rem' }}>{challenge.title}</h3>
                </Link>
                <p style={{ marginBottom: '0.5rem' }}>Difficulty: {challenge.difficulty}</p>
                <p style={{ fontSize: '0.9rem', color: '#666' }}>
                  {challenge.description.substring(0, 200)}...
                </p>
                <Link
                  href={`/practice/${challenge.id}`}
                  className="btn btn-primary"
                  style={{ marginTop: '0.75rem', display: 'inline-block' }}
                >
                  {postContestPractice ? 'Practice' : status === 'LIVE' ? 'Solve' : 'Open'}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
