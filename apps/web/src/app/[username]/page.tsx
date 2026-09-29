'use client';

import { useEffect, useMemo, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import type { PublicProfileResponse } from '@/lib/profile';
import { isReservedUsername } from '@/lib/reservedPaths';

const emptyPractice = {
  total: { solved: 0, total: 0 },
  easy: { solved: 0, total: 0 },
  medium: { solved: 0, total: 0 },
  hard: { solved: 0, total: 0 },
};

function getContributionLevel(count: number) {
  if (count === 0) return '#161b22';
  if (count === 1) return '#0e4429';
  if (count === 2) return '#006d32';
  if (count === 3) return '#26a641';
  return '#39d353';
}

function getPercentage(solved: number, total: number) {
  return total > 0 ? Math.round((solved / total) * 100) : 0;
}

function getAvatarColor(name: string) {
  const colors = ['#14b8a6', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308'];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  if (isReservedUsername(username)) {
    notFound();
  }

  const currentUser = getUser();
  const isOwnProfile = currentUser?.username?.toLowerCase() === username.toLowerCase();
  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [streakPublic, setStreakPublic] = useState(true);
  const [contributionsPublic, setContributionsPublic] = useState(true);
  const [interviewPracticePublic, setInterviewPracticePublic] = useState(true);
  const [courseWatchTimePublic, setCourseWatchTimePublic] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<PublicProfileResponse>(
          `/leaderboard/profile/${encodeURIComponent(username)}?year=${selectedYear}`,
        );
        if (!cancelled) setProfile(data);
      } catch (e) {
        if (!cancelled) {
          setProfile(null);
          setError(e instanceof Error ? e.message : 'Failed to load profile');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username, selectedYear]);

  const user = profile?.user;
  const contributions = user?.contributions.days ?? [];
  const totalContributions = user?.contributions.totalSubmissions ?? 0;
  const practice = user?.practiceByDifficulty ?? emptyPractice;
  const courseWatchTime = profile?.courseWatchTime ?? [];
  const avatarColor = getAvatarColor(username);

  const weekKeys = useMemo(() => {
    const weeks: Record<string, { date: string; count: number }[]> = {};
    for (const contrib of contributions) {
      const date = new Date(contrib.date + 'T12:00:00');
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!weeks[weekKey]) weeks[weekKey] = [];
      weeks[weekKey].push(contrib);
    }
    return Object.keys(weeks)
      .sort()
      .slice(-52)
      .map((key) => ({ key, days: weeks[key] }));
  }, [contributions]);

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <>
      <Navbar />
      <div
        style={{
          background: 'var(--surface-page)',
          color: 'var(--text-theme)',
          minHeight: 'calc(100vh - 60px)',
          padding: '2rem',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: '2rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ position: 'relative', display: 'inline-block', margin: '0 auto' }}>
              <div
                style={{
                  width: '150px',
                  height: '150px',
                  borderRadius: '50%',
                  background: avatarColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '3rem',
                  fontWeight: 'bold',
                }}
              >
                {username.charAt(0).toUpperCase()}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0, textTransform: 'capitalize' }}>
                {user?.username ?? username}
              </h1>
              {user?.rank != null && (
                <p style={{ margin: '0.5rem 0 0', color: '#9ca3af', fontSize: '0.875rem' }}>
                  Global rank #{user.rank} · {user.uniqueSolved} solved
                </p>
              )}
            </div>

            {(isOwnProfile || streakPublic) && (
              <div
                style={{
                  background: 'var(--surface-panel)',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>Practice streak</h3>
                  {isOwnProfile && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
                      <span>Public</span>
                      <input type="checkbox" checked={streakPublic} onChange={(e) => setStreakPublic(e.target.checked)} />
                    </label>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: 'var(--surface-raised)', borderRadius: '6px', padding: '1rem', border: '1px solid var(--border-theme)' }}>
                    <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>Current streak</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>
                      {loading ? '—' : `${user?.streak.current ?? 0} days`}
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface-raised)', borderRadius: '6px', padding: '1rem', border: '1px solid var(--border-theme)' }}>
                    <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>Longest streak</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f97316' }}>
                      {loading ? '—' : `${user?.streak.longest ?? 0} days`}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {error && (
              <div style={{ background: '#3f1d1d', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '1rem', color: '#fecaca' }}>
                {error}
              </div>
            )}

            {(isOwnProfile || contributionsPublic) && (
              <div
                style={{
                  background: 'var(--surface-panel)',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>Submissions</h3>
                  {isOwnProfile && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
                      <span>Public</span>
                      <input
                        type="checkbox"
                        checked={contributionsPublic}
                        onChange={(e) => setContributionsPublic(e.target.checked)}
                      />
                    </label>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                    {loading ? '…' : `${totalContributions} submissions in`}
                  </span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    style={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border-theme)',
                      color: 'var(--text-theme)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ marginTop: '0.5rem', overflowX: 'auto' }}>
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '0.5rem' }}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div
                          key={day}
                          style={{
                            width: '12px',
                            height: '12px',
                            fontSize: '0.7rem',
                            color: '#9ca3af',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {day === 'Sun' || day === 'Wed' || day === 'Fri' ? day[0] : ''}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', width: 'calc(100% - 50px)' }}>
                      {weekKeys.map(({ key, days }) =>
                        days.map((contrib, dayIndex) => (
                          <div
                            key={`${key}-${dayIndex}`}
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '2px',
                              background: getContributionLevel(contrib.count),
                              border: '1px solid #161b22',
                            }}
                            title={`${contrib.count} submissions on ${contrib.date}`}
                          />
                        )),
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(isOwnProfile || interviewPracticePublic) && (
              <div
                style={{
                  background: 'var(--surface-panel)',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>Practice problems solved</h3>
                  {isOwnProfile && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
                      <span>Public</span>
                      <input
                        type="checkbox"
                        checked={interviewPracticePublic}
                        onChange={(e) => setInterviewPracticePublic(e.target.checked)}
                      />
                    </label>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {[
                    { label: 'Total solved', ...practice.total },
                    { label: 'Easy', ...practice.easy },
                    { label: 'Medium', ...practice.medium },
                    { label: 'Hard', ...practice.hard },
                  ].map((stat) => {
                    const percentage = getPercentage(stat.solved, stat.total);
                    return (
                      <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                          style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: `conic-gradient(#22c55e ${percentage * 3.6}deg, #d7e8dd 0deg)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <div
                            style={{
                              width: '60px',
                              height: '60px',
                              borderRadius: '50%',
                              background: 'var(--surface-panel)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                            }}
                          >
                            {percentage}%
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{stat.label}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {stat.solved} / {stat.total}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(isOwnProfile || courseWatchTimePublic) && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>Course watch time</h3>
                      {isOwnProfile && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
                          <span>Public</span>
                          <input
                            type="checkbox"
                            checked={courseWatchTimePublic}
                            onChange={(e) => setCourseWatchTimePublic(e.target.checked)}
                          />
                        </label>
                      )}
                    </div>
                    {courseWatchTime.length === 0 ? (
                      <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.875rem' }}>No course watch time recorded yet.</p>
                    ) : (
                      <div
                        style={{
                          height: '150px',
                          background: 'var(--surface-raised)',
                          borderRadius: '6px',
                          padding: '1rem',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          gap: '2rem',
                        }}
                      >
                        {courseWatchTime.map((item) => {
                          const maxHours = Math.max(...courseWatchTime.map((c) => c.hours), 0.1);
                          return (
                            <div
                              key={item.course}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1 }}
                            >
                              <div
                                style={{
                                  width: '100%',
                                  height: `${Math.max(12, (item.hours / maxHours) * 100)}%`,
                                  background: '#22c55e',
                                  borderRadius: '4px 4px 0 0',
                                  minHeight: '20px',
                                  position: 'relative',
                                }}
                              >
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '-1.5rem',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    fontSize: '0.75rem',
                                    color: '#9ca3af',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {item.hours.toFixed(2)}h
                                </div>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' }}>{item.course}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
