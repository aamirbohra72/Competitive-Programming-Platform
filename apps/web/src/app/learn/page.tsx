'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { markLocalEnrollments } from '@/lib/enrollment';
import { startRazorpayCheckout } from '@/lib/razorpayCheckout';
import { fetchLearningSummary } from '@/lib/learningProgress';
import type { CourseLearningProgress } from '@/types/learning-progress';

interface Course {
  id: string;
  title: string;
  description: string;
  rating: number;
  reviews: number;
  language: string;
  isPremium: boolean;
  category: string;
  image?: string;
}

interface GeneratedCourseSummary {
  id: string;
  title: string;
  description: string;
  sourceType: string;
  createdAt: string;
  unitCount: number;
  topicCount: number;
  estimatedMinutes: number;
}

type CatalogProduct = {
  productId: string;
  title: string;
  description: string;
  amountPaise: number;
  currency: string;
  kind: 'course' | 'credit' | 'bundle';
  grantsProductIds?: string[];
};

const COURSE_LABELS: Record<string, string> = {
  '1': 'Salaam DSA',
  '2': 'Salaam Node.js',
  '3': 'Salaam React',
  '5': 'System Design',
};

function formatInr(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

const mockCourses: Course[] = [
  {
    id: '1',
    title: 'Salaam DSA',
    description:
      '6 modules · arrays to DP — notes, flashcards, and quizzes for interview patterns.',
    rating: 4.9,
    reviews: 1000,
    language: 'English',
    isPremium: true,
    category: 'DSA',
  },
  {
    id: '2',
    title: 'Salaam Node.js',
    description:
      '6 modules · Express, Prisma, auth, caching, and production Node patterns.',
    rating: 4.8,
    reviews: 2000,
    language: 'English',
    isPremium: true,
    category: 'Backend',
  },
  {
    id: '3',
    title: 'Salaam React',
    description:
      '6 modules · hooks, routing, performance, and Next.js mental models with practice.',
    rating: 4.9,
    reviews: 1500,
    language: 'English',
    isPremium: true,
    category: 'Frontend',
  },
  {
    id: '4',
    title: 'JavaScript Fundamentals',
    description: 'Free · 4 modules covering language basics, async JS, and browser patterns.',
    rating: 4.7,
    reviews: 800,
    language: 'English',
    isPremium: false,
    category: 'Frontend',
  },
  {
    id: '5',
    title: 'System Design',
    description: '3 deep HLD sessions · capacity, storage, caching, queues, and reliability.',
    rating: 4.8,
    reviews: 1200,
    language: 'English',
    isPremium: true,
    category: 'System Design',
  },
  {
    id: '6',
    title: 'Python for Beginners',
    description: 'Free · 4 modules from core data types to asyncio and simple APIs.',
    rating: 4.6,
    reviews: 600,
    language: 'English',
    isPremium: false,
    category: 'Programming',
  },
];

type FilterType = 'all' | 'paid' | 'free' | 'career' | 'mine';

export default function LearnPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [generatedCourses, setGeneratedCourses] = useState<GeneratedCourseSummary[]>([]);
  const [generatedLoading, setGeneratedLoading] = useState(false);
  const [generatedError, setGeneratedError] = useState('');
  const [bundles, setBundles] = useState<CatalogProduct[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState('');
  const [progressById, setProgressById] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!getToken()) return;

    const loadEnrollments = () => {
      void Promise.all([
        api.get<{ enrollments: Array<{ productId: string }> }>('/payments/enrollments'),
        fetchLearningSummary(),
      ])
        .then(([data, summary]) => {
          const ids = data.enrollments.map((e) => e.productId);
          setEnrolledIds(new Set(ids));
          markLocalEnrollments(ids);
          if (summary) {
            const map: Record<string, number> = {};
            for (const c of summary.courses as CourseLearningProgress[]) {
              map[c.courseId] = c.percent;
            }
            setProgressById(map);
          }
        })
        .catch(() => undefined);
    };

    loadEnrollments();

    const onEnrollment = () => loadEnrollments();
    window.addEventListener('enrollment:updated', onEnrollment);
    window.addEventListener('focus', onEnrollment);
    window.addEventListener('learning-progress:updated', onEnrollment);
    return () => {
      window.removeEventListener('enrollment:updated', onEnrollment);
      window.removeEventListener('focus', onEnrollment);
      window.removeEventListener('learning-progress:updated', onEnrollment);
    };
  }, []);

  const handlePremiumEnroll = async (courseId: string) => {
    if (!getToken()) {
      window.location.href = `/sign-in?redirect_url=/learn`;
      return;
    }
    if (enrolledIds.has(courseId)) {
      window.location.href = `/learn/${courseId}`;
      return;
    }
    setPayingId(courseId);
    setPayError('');
    try {
      const result = await startRazorpayCheckout(courseId);
      setEnrolledIds((prev) => {
        const next = new Set(prev);
        for (const id of result.productIds) next.add(id);
        return next;
      });
      window.location.href = `/learn/${courseId}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment failed';
      if (msg !== 'Payment cancelled') setPayError(msg);
    } finally {
      setPayingId(null);
    }
  };

  const handleBundleBuy = async (bundle: CatalogProduct) => {
    if (!getToken()) {
      window.location.href = `/sign-in?redirect_url=/learn`;
      return;
    }
    const grants = bundle.grantsProductIds ?? [];
    const owned =
      enrolledIds.has(bundle.productId) ||
      (grants.length > 0 && grants.every((id) => enrolledIds.has(id)));
    if (owned) {
      window.location.href = `/learn/${grants[0] ?? '1'}`;
      return;
    }
    setPayingId(bundle.productId);
    setPayError('');
    try {
      const result = await startRazorpayCheckout(bundle.productId);
      setEnrolledIds((prev) => {
        const next = new Set(prev);
        for (const id of result.productIds) next.add(id);
        return next;
      });
      window.location.href = `/learn/${grants[0] ?? '1'}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment failed';
      if (msg !== 'Payment cancelled') setPayError(msg);
    } finally {
      setPayingId(null);
    }
  };

  useEffect(() => {
    if (activeFilter !== 'mine') return;

    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setGeneratedCourses([]);
        setGeneratedError('Log in to see your generated courses.');
        return;
      }

      setGeneratedLoading(true);
      setGeneratedError('');
      try {
        const data = await api.get<{ courses: GeneratedCourseSummary[] }>('/courses/mine');
        if (!cancelled) setGeneratedCourses(data.courses);
      } catch (e) {
        if (!cancelled) {
          setGeneratedCourses([]);
          setGeneratedError(e instanceof Error ? e.message : 'Failed to load generated courses');
        }
      } finally {
        if (!cancelled) setGeneratedLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeFilter]);

  useEffect(() => {
    if (activeFilter !== 'career') return;
    let cancelled = false;
    (async () => {
      setBundlesLoading(true);
      try {
        const data = await api.get<{ products: CatalogProduct[] }>('/payments/products');
        if (!cancelled) {
          setBundles(data.products.filter((p) => p.kind === 'bundle'));
        }
      } catch {
        if (!cancelled) setBundles([]);
      } finally {
        if (!cancelled) setBundlesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeFilter]);

  const filteredCourses =
    activeFilter === 'all'
      ? mockCourses
      : activeFilter === 'paid'
        ? mockCourses.filter((c) => c.isPremium)
        : activeFilter === 'free'
          ? mockCourses.filter((c) => !c.isPremium)
          : [];

  const filters: { label: string; value: FilterType; key: string }[] = [
    { label: 'All Courses', value: 'all', key: 'all' },
    { label: 'Paid Courses', value: 'paid', key: 'paid' },
    { label: 'Free Courses', value: 'free', key: 'free' },
    { label: 'Career Bundles', value: 'career', key: 'career' },
    { label: 'My AI Courses', value: 'mine', key: 'mine' },
  ];

  return (
    <DashboardShell navClassName="sticky top-0 z-50" mainClassName="min-h-0 overflow-y-auto p-8">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Courses</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Learn and master new skills</p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          marginBottom: '2rem',
          flexWrap: 'wrap',
        }}
      >
        {filters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: activeFilter === filter.value ? 'var(--accent-theme)' : 'var(--surface-panel)',
              color: activeFilter === filter.value ? 'white' : 'var(--text-theme)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: activeFilter === filter.value ? '600' : '400',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== filter.value) {
                e.currentTarget.style.background = 'var(--surface-panel)';
                e.currentTarget.style.color = 'var(--accent-theme)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== filter.value) {
                e.currentTarget.style.background = 'var(--surface-panel)';
                e.currentTarget.style.color = 'var(--text-theme)';
              }
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {activeFilter === 'mine' && (
        <>
          <Link
            href="/learn/create"
            style={{
              display: 'block',
              marginBottom: '2rem',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px dashed #22c55e',
              background: 'rgba(34, 197, 94, 0.08)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#22c55e' }}>
              + Generate a custom course with AI
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Paste notes, upload a PDF, or enter a topic — get a full notebook with lessons and
              quizzes.
            </p>
          </Link>

          {generatedLoading && <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Loading your courses…</p>}
          {generatedError && <p style={{ color: '#f87171', marginBottom: '1rem' }}>{generatedError}</p>}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {generatedCourses.map((course) => (
              <Link
                key={course.id}
                href={`/learn/notebook/${course.id}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', height: '100%' }}
              >
                <div
                  style={{
                    background: 'var(--surface-raised)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    border: '1px solid var(--border-theme)',
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div
                    style={{
                      height: '140px',
                      flexShrink: 0,
                      background: 'linear-gradient(135deg, #059669, #0ea5e9)',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: '#22c55e',
                        color: 'var(--text-theme)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                      }}
                    >
                      AI GENERATED
                    </div>
                    <div
                      style={{
                        fontSize: '3rem',
                        fontWeight: 'bold',
                        color: 'rgba(255,255,255,0.9)',
                      }}
                    >
                      {course.title.charAt(0).toUpperCase()}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      minHeight: 0,
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        marginBottom: '0.75rem',
                        color: 'white',
                      }}
                    >
                      {course.title}
                    </h3>
                    <p
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.9rem',
                        lineHeight: '1.6',
                        marginBottom: '1rem',
                      }}
                    >
                      {course.description}
                    </p>
                    <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem' }}>
                      {course.unitCount} units · {course.topicCount} topics · {course.estimatedMinutes}{' '}
                      min
                    </p>
                    <button
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        marginTop: 'auto',
                        background: '#22c55e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.href = `/learn/notebook/${course.id}`;
                      }}
                    >
                      Open Notebook
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {!generatedLoading && !generatedError && generatedCourses.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No generated courses yet. Click the green card above to create one.
            </div>
          )}
        </>
      )}

      {activeFilter === 'career' && (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem', color: 'var(--text-theme)' }}>
              Career Bundles
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Multi-course paths at a lower price than buying each course alone. One payment unlocks
              every included course.
            </p>
          </div>
          {payError && <p style={{ color: '#f87171', marginBottom: '1rem' }}>{payError}</p>}
          {bundlesLoading && <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Loading bundles…</p>}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {bundles.map((bundle) => {
              const grants = bundle.grantsProductIds ?? [];
              const owned =
                enrolledIds.has(bundle.productId) ||
                (grants.length > 0 && grants.every((id) => enrolledIds.has(id)));
              return (
                <div
                  key={bundle.productId}
                  style={{
                    background: 'var(--surface-raised)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-theme)',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                  }}
                >
                  <div
                    style={{
                      height: '120px',
                      background: 'linear-gradient(135deg, #0f766e, #22c55e)',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: '#f59e0b',
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                      }}
                    >
                      BUNDLE
                    </span>
                    <span style={{ fontSize: '2rem', fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>
                      {grants.length} courses
                    </span>
                  </div>
                  <div
                    style={{
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      gap: '0.75rem',
                    }}
                  >
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-theme)', margin: 0 }}>
                      {bundle.title}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                      {bundle.description}
                    </p>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: '1.1rem',
                        color: '#94a3b8',
                        fontSize: '0.85rem',
                        lineHeight: 1.7,
                      }}
                    >
                      {grants.map((id) => (
                        <li key={id}>{COURSE_LABELS[id] ?? `Course ${id}`}</li>
                      ))}
                    </ul>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '0.5rem',
                        marginTop: 'auto',
                      }}
                    >
                      <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#86efac' }}>
                        {formatInr(bundle.amountPaise)}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>one-time</span>
                    </div>
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: owned ? '#16a34a' : '#22c55e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      onClick={() => void handleBundleBuy(bundle)}
                    >
                      {owned
                        ? 'Open included courses'
                        : payingId === bundle.productId
                          ? 'Opening checkout…'
                          : `Buy bundle · ${formatInr(bundle.amountPaise)}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {!bundlesLoading && bundles.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#b0b0b0' }}>
              No career bundles available right now.
            </div>
          )}
        </>
      )}

      {(activeFilter === 'all' || activeFilter === 'paid' || activeFilter === 'free') && (
        <>
          {payError && (
            <p style={{ color: '#f87171', marginBottom: '1rem' }}>{payError}</p>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {filteredCourses.map((course) => (
              <Link
                key={course.id}
                href={`/learn/${course.id}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', height: '100%' }}
              >
                <div
                  style={{
                    background: 'var(--surface-raised)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    border: '1px solid var(--border-theme)',
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div
                    style={{
                      height: '200px',
                      flexShrink: 0,
                      background: `linear-gradient(135deg, ${
                        course.category === 'DSA'
                          ? '#f59e0b, #ef4444'
                          : course.category === 'Backend'
                            ? '#ef4444, #dc2626'
                            : '#3b82f6, #2563eb'
                      })`,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        background:
                          'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                      }}
                    />
                    <div
                      style={{
                        fontSize: '4rem',
                        fontWeight: 'bold',
                        color: 'rgba(255,255,255,0.9)',
                        textShadow: '0 2px 10px rgba(0,0,0,0.3)',
                        zIndex: 1,
                      }}
                    >
                      {course.title.split(' ')[0].charAt(0)}
                    </div>
                    {course.isPremium && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '1rem',
                          right: '1rem',
                          background: '#f59e0b',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          zIndex: 2,
                        }}
                      >
                        PREMIUM
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      minHeight: 0,
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        marginBottom: '0.75rem',
                        color: 'var(--text-theme)',
                      }}
                    >
                      {course.title.toUpperCase()}
                    </h3>

                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'center',
                        marginBottom: '1rem',
                      }}
                    >
                      <span
                        style={{
                          background: 'var(--surface-panel)',
                          color: 'var(--text-muted)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                        }}
                      >
                        {course.language}
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          color: '#fbbf24',
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>⭐</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{course.rating}</span>
                        <span style={{ fontSize: '0.75rem', color: '#b0b0b0', marginLeft: '0.25rem' }}>
                          (
                          {course.reviews > 1000
                            ? `${(course.reviews / 1000).toFixed(1)}K`
                            : course.reviews}{' '}
                          Reviews)
                        </span>
                      </div>
                    </div>

                    <p
                      style={{
                        color: '#b0b0b0',
                        fontSize: '0.9rem',
                        lineHeight: '1.6',
                        marginBottom: '1rem',
                      }}
                    >
                      {course.description}
                    </p>

                    {typeof progressById[course.id] === 'number' ? (
                      <div style={{ marginBottom: '1rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.75rem',
                            color: '#94a3b8',
                            marginBottom: 4,
                          }}
                        >
                          <span>Progress</span>
                          <span style={{ color: '#86efac' }}>{progressById[course.id]}%</span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            borderRadius: 999,
                            background: '#333',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${progressById[course.id]}%`,
                              height: '100%',
                              background: '#22c55e',
                            }}
                          />
                        </div>
                      </div>
                    ) : null}

                    <button
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        marginTop: 'auto',
                        background: course.isPremium ? '#f59e0b' : '#22c55e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = course.isPremium ? '#d97706' : '#16a34a';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = course.isPremium ? '#f59e0b' : '#22c55e';
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        if (course.isPremium) {
                          void handlePremiumEnroll(course.id);
                        } else {
                          window.location.href = `/learn/${course.id}`;
                        }
                      }}
                    >
                      {course.isPremium
                        ? enrolledIds.has(course.id)
                          ? progressById[course.id]
                            ? `Continue · ${progressById[course.id]}%`
                            : 'Open Course'
                          : payingId === course.id
                            ? 'Opening checkout…'
                            : 'Buy & Enroll'
                        : 'Start Learning'}
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filteredCourses.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#b0b0b0' }}>
              No courses found in this category.
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
