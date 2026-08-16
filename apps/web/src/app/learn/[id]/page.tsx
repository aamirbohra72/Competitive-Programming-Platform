'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { isLocallyEnrolled, markLocalEnrollment, clearLocalEnrollment } from '@/lib/enrollment';
import { startRazorpayCheckout } from '@/lib/razorpayCheckout';
import {
  completeLearningItem,
  fetchCourseProgress,
} from '@/lib/learningProgress';
import { CATALOG_TOTALS } from '@/types/learning-progress';
import { markCourseCompleted } from '@/lib/certificates';
import { getAssignmentsForCourse } from '@/data/assignments';
import { getTutorialsForCourse } from '@/data/tutorials/catalog-index';
import { isLlmDrivenCourse, type LlmCoursePack } from '@/types/llm-course';

const courseData: Record<
  string,
  {
    title: string;
    description: string;
    rating: number;
    reviews: number;
    language: string;
    isPremium: boolean;
    category: string;
    outcome: string;
    modules: { id: string; title: string; duration: string; completed: boolean }[];
  }
> = {
  '1': {
    title: 'Salaam DSA',
    description:
      'Master Data Structures and Algorithms with pattern-based modules: arrays, lists, stacks, trees, graphs, and DP — each with revision notes, flashcards, and practice quizzes.',
    rating: 4.9,
    reviews: 1000,
    language: 'English',
    isPremium: true,
    category: 'DSA',
    outcome: 'Solve interview DSA problems with clear patterns and complexity reasoning.',
    modules: [],
  },
  '2': {
    title: 'Salaam Node.js',
    description:
      'Build production Node APIs: event loop, Express, Prisma, auth/security, caching, and observability — with guided notes and quizzes every module.',
    rating: 4.8,
    reviews: 2000,
    language: 'English',
    isPremium: true,
    category: 'Backend',
    outcome: 'Ship secure, scalable Express services with solid data and ops habits.',
    modules: [],
  },
  '3': {
    title: 'Salaam React',
    description:
      'Learn modern React end-to-end: hooks, effects, routing, performance, Next.js mental models, and UI quality — packed with flashcards and practice.',
    rating: 4.9,
    reviews: 1500,
    language: 'English',
    isPremium: true,
    category: 'Frontend',
    outcome: 'Build interactive React apps with clean state, data fetching, and polish.',
    modules: [],
  },
  '4': {
    title: 'JavaScript Fundamentals',
    description:
      'Free starter track: language foundations, async JS, modern syntax, and browser patterns — perfect before React or Node.',
    rating: 4.7,
    reviews: 800,
    language: 'English',
    isPremium: false,
    category: 'Frontend',
    outcome: 'Write confident modern JavaScript with async and module basics.',
    modules: [],
  },
  '5': {
    title: 'System Design',
    description:
      'Design scalable systems for interviews: requirements, capacity, storage, caching, queues, and reliability — with HLD practice questions.',
    rating: 4.8,
    reviews: 1200,
    language: 'English',
    isPremium: true,
    category: 'System Design',
    outcome: 'Lead HLD discussions with estimations, diagrams, and tradeoffs.',
    modules: [],
  },
  '6': {
    title: 'Python for Beginners',
    description:
      'Free Python on-ramp: core data types, functions, modern ergonomics, and applied topics like asyncio and simple APIs.',
    rating: 4.6,
    reviews: 650,
    language: 'English',
    isPremium: false,
    category: 'Programming',
    outcome: 'Write clean Python scripts and understand common libraries.',
    modules: [],
  },
};

type Tab = 'tutorials' | 'assignments';

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;
  const course = courseData[courseId];
  const assignments = getAssignmentsForCourse(courseId);
  const staticTutorials = getTutorialsForCourse(courseId);
  const llmCourse = isLlmDrivenCourse(courseId);

  const [enrolled, setEnrolled] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollError, setEnrollError] = useState('');
  const [tab, setTab] = useState<Tab>('tutorials');
  const [llmPack, setLlmPack] = useState<LlmCoursePack | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState('');
  const [percent, setPercent] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [markingId, setMarkingId] = useState<string | null>(null);

  const refreshProgress = async () => {
    if (!getToken()) return;
    try {
      const progress = await fetchCourseProgress(courseId);
      if (!progress) return;
      setPercent(progress.percent);
      setCompletedIds(new Set(progress.items?.filter((i) => i.completed).map((i) => i.itemId) || []));
      if (progress.completed) markCourseCompleted(courseId);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !course) return;
    if (!course.isPremium) {
      setEnrolled(true);
      return;
    }

    // Optimistic cache only — API enrollment is source of truth.
    setEnrolled(isLocallyEnrolled(courseId));

    if (!getToken()) return;

    let cancelled = false;
    void api
      .get<{ enrolled: boolean }>(`/payments/enrollments/${encodeURIComponent(courseId)}`)
      .then((data) => {
        if (cancelled) return;
        if (data.enrolled) {
          markLocalEnrollment(courseId);
          setEnrolled(true);
        } else {
          clearLocalEnrollment(courseId);
          setEnrolled(false);
        }
      })
      .catch(() => undefined);

    void refreshProgress();

    const onEnrollment = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { productId?: string; productIds?: string[] }
        | undefined;
      if (
        detail?.productId === courseId ||
        detail?.productIds?.includes(courseId) ||
        isLocallyEnrolled(courseId)
      ) {
        setEnrolled(true);
      }
    };
    const onProgress = () => {
      void refreshProgress();
    };
    window.addEventListener('enrollment:updated', onEnrollment);
    window.addEventListener('learning-progress:updated', onProgress);
    return () => {
      cancelled = true;
      window.removeEventListener('enrollment:updated', onEnrollment);
      window.removeEventListener('learning-progress:updated', onProgress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    if (!llmCourse || !enrolled) return;
    let cancelled = false;
    (async () => {
      try {
        setLlmLoading(true);
        setLlmError('');
        const pack = await api.get<LlmCoursePack>(`/courses/${courseId}/pack`);
        if (!cancelled) setLlmPack(pack);
      } catch (e: unknown) {
        if (!cancelled) setLlmError(e instanceof Error ? e.message : 'Failed to generate live React curriculum');
      } finally {
        if (!cancelled) setLlmLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, llmCourse, enrolled]);

  const enroll = async () => {
    if (enrolled) return;
    if (!course.isPremium) {
      setEnrolled(true);
      markLocalEnrollment(courseId);
      return;
    }
    if (!getToken()) {
      window.location.href = `/sign-in?redirect_url=/learn/${courseId}`;
      return;
    }
    setEnrollLoading(true);
    setEnrollError('');
    try {
      await startRazorpayCheckout(courseId);
      markLocalEnrollment(courseId);
      setEnrolled(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment failed';
      if (msg !== 'Payment cancelled') setEnrollError(msg);
    } finally {
      setEnrollLoading(false);
    }
  };

  const tutorialList =
    llmPack?.tutorials?.map((t) => ({
      id: t.id,
      title: t.title,
      duration: t.duration,
      completed: completedIds.has(t.id),
      problemCount: t.questions.length,
      href: `/learn/${courseId}/tutorials/${t.id}`,
      assignmentHref: `/learn/${courseId}/tutorials/${t.id}?tab=assignment`,
      live: true as boolean,
      itemType: 'tutorial' as const,
    })) ??
    (staticTutorials.length > 0
      ? staticTutorials.map((t) => ({
          id: t.id,
          title: t.title,
          duration: t.duration,
          completed: completedIds.has(t.id),
          problemCount: t.questionIds.length,
          href: `/learn/${courseId}/tutorials/${t.id}`,
          assignmentHref: `/learn/${courseId}/tutorials/${t.id}?tab=assignment`,
          live: false as boolean,
          itemType: 'tutorial' as const,
        }))
      : (course?.modules ?? []).map((m) => ({
          id: m.id,
          title: m.title,
          duration: m.duration,
          completed: completedIds.has(m.id) || m.completed,
          problemCount: 0,
          href: `/learn/${courseId}`,
          assignmentHref: `/learn/${courseId}/assignments`,
          live: false as boolean,
          itemType: 'module' as const,
        })));

  const markItemComplete = async (item: (typeof tutorialList)[number]) => {
    if (!getToken()) {
      window.location.href = `/sign-in?redirect_url=/learn/${courseId}`;
      return;
    }
    setMarkingId(item.id);
    try {
      const totalCount = Math.max(
        tutorialList.length,
        CATALOG_TOTALS[courseId] || tutorialList.length || 1,
      );
      await completeLearningItem({
        courseId,
        courseKind: 'catalog',
        title: course.title,
        itemId: item.id,
        itemType: item.itemType,
        itemTitle: item.title,
        itemHref: item.href,
        totalCount,
      });
      await refreshProgress();
    } catch (e) {
      setEnrollError(e instanceof Error ? e.message : 'Failed to save progress');
    } finally {
      setMarkingId(null);
    }
  };

  if (!course) {
    return (
      <DashboardShell mainClassName="p-8">
        <h1>Course not found</h1>
        <Link href="/learn">Back to Courses</Link>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell mainClassName="min-h-0 overflow-y-auto p-0">
      <main style={{ background: '#1a1a1a', color: 'white', padding: '2rem', minHeight: '100%' }}>
        <Link
          href="/learn"
          style={{ display: 'inline-block', marginBottom: '1.5rem', color: '#22c55e', textDecoration: 'none' }}
        >
          ← Back to Courses
        </Link>

        <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
              {course.isPremium && (
                <span
                  style={{
                    background: '#f59e0b',
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  PREMIUM
                </span>
              )}
              <span
                style={{
                  background: '#3a3a3a',
                  color: '#b0b0b0',
                  padding: '0.25rem 0.5rem',
                  borderRadius: 4,
                  fontSize: '0.75rem',
                }}
              >
                {course.language}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#fbbf24' }}>
                <span>⭐</span>
                <span style={{ fontWeight: 600 }}>{course.rating}</span>
                <span style={{ fontSize: '0.875rem', color: '#b0b0b0', marginLeft: '0.25rem' }}>
                  ({course.reviews > 1000 ? `${(course.reviews / 1000).toFixed(1)}K` : course.reviews} Reviews)
                </span>
              </div>
            </div>

            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.75rem', fontWeight: 700 }}>{course.title.toUpperCase()}</h1>
            <p style={{ fontSize: '1.1rem', color: '#b0b0b0', lineHeight: 1.6, marginBottom: '0.75rem' }}>
              {course.description}
            </p>
            <p
              style={{
                fontSize: '0.95rem',
                color: '#86efac',
                lineHeight: 1.5,
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: 10,
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.25)',
              }}
            >
              <strong style={{ color: '#bbf7d0' }}>You will be able to: </strong>
              {course.outcome}
            </p>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
              {staticTutorials.length > 0
                ? `${staticTutorials.length} guided modules · notes · flashcards · practice quizzes`
                : llmCourse
                  ? 'Live AI curriculum unlocks after enrollment'
                  : 'Curriculum coming soon'}
            </p>
            {enrolled ? (
              <div style={{ marginBottom: '1.5rem', maxWidth: 420 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
                  <span>Course progress</span>
                  <span style={{ color: '#86efac', fontWeight: 700 }}>{percent}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: '#2a2a2a', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${percent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #22c55e, #34d399)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            ) : null}

            <button
              onClick={() => void enroll()}
              disabled={enrolled || enrollLoading}
              style={{
                padding: '1rem 2rem',
                background: enrolled ? '#22c55e' : '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: '1.1rem',
                fontWeight: 600,
                cursor: enrolled ? 'default' : 'pointer',
                opacity: enrollLoading ? 0.7 : 1,
              }}
            >
              {enrolled
                ? '✓ Enrolled'
                : enrollLoading
                  ? 'Opening checkout…'
                  : course.isPremium
                    ? 'Buy & Enroll'
                    : 'Enroll Now'}
            </button>
            {enrollError ? (
              <p style={{ marginTop: '0.75rem', color: '#f87171', fontSize: '0.9rem' }}>{enrollError}</p>
            ) : null}
          </div>

          <div
            style={{
              width: 400,
              maxWidth: '100%',
              height: 300,
              background: `linear-gradient(135deg, ${
                course.category === 'DSA'
                  ? '#f59e0b, #ef4444'
                  : course.category === 'System Design'
                    ? '#3b82f6, #8b5cf6'
                    : course.category === 'Frontend'
                      ? '#06b6d4, #2563eb'
                      : course.category === 'Backend'
                        ? '#ef4444, #b91c1c'
                        : '#22c55e, #15803d'
              })`,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontSize: '6rem',
                fontWeight: 'bold',
                color: 'rgba(255,255,255,0.9)',
                textShadow: '0 2px 10px rgba(0,0,0,0.3)',
              }}
            >
              {course.title.split(' ')[0].charAt(0)}
            </div>
          </div>
        </div>

        {!enrolled && staticTutorials.length > 0 ? (
          <div style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '0.75rem' }}>Curriculum preview</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Enroll to unlock notes, flashcards, and practice quizzes for every module.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {staticTutorials.map((t, index) => (
                <div
                  key={t.id}
                  style={{
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: 10,
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    alignItems: 'center',
                    opacity: 0.92,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                      Module {index + 1} · {t.duration}
                    </div>
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{t.videoTitle}</div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      color: '#fbbf24',
                      background: 'rgba(245,158,11,0.12)',
                      border: '1px solid rgba(245,158,11,0.35)',
                      borderRadius: 999,
                      padding: '0.35rem 0.7rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    LOCKED
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {enrolled && (
          <div style={{ marginTop: '2rem' }}>
            <div
              style={{
                display: 'flex',
                gap: '0.25rem',
                borderBottom: '1px solid #2a2a2a',
                marginBottom: '1.5rem',
              }}
            >
              <button
                type="button"
                onClick={() => setTab('tutorials')}
                style={{
                  padding: '0.85rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === 'tutorials' ? '2px solid #22c55e' : '2px solid transparent',
                  color: tab === 'tutorials' ? '#22c55e' : '#9ca3af',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Tutorials {tutorialList.length}
              </button>
              <button
                type="button"
                onClick={() => setTab('assignments')}
                style={{
                  padding: '0.85rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === 'assignments' ? '2px solid #22c55e' : '2px solid transparent',
                  color: tab === 'assignments' ? '#22c55e' : '#9ca3af',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Assignments {tutorialList.filter((t) => t.problemCount > 0).length || assignments.length}
              </button>
            </div>

            {tab === 'tutorials' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Course Tutorials</h2>
                {llmCourse ? (
                  <p style={{ margin: 0, color: '#9ca3af' }}>
                    Live AI curriculum (React / JS only) via Mistral
                    {llmPack?.generatedAt ? ` · generated ${new Date(llmPack.generatedAt).toLocaleString()}` : ''}
                  </p>
                ) : null}
                {llmLoading ? <div style={{ color: '#9ca3af' }}>Generating React curriculum with LLM…</div> : null}
                {llmError ? <div style={{ color: '#f87171' }}>{llmError}</div> : null}
                {!llmLoading &&
                  !llmError &&
                  tutorialList.map((module, index) => (
                  <div
                    key={module.id}
                    style={{
                      background: '#2a2a2a',
                      padding: '1.5rem',
                      borderRadius: 8,
                      border: '1px solid #3a3a3a',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: module.completed ? '#22c55e' : '#3a3a3a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                        }}
                      >
                        {module.completed ? '✓' : index + 1}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem' }}>{module.title}</h3>
                        <p style={{ fontSize: '0.875rem', color: '#b0b0b0', margin: 0 }}>
                          {module.duration}
                          {module.problemCount > 0 ? ` · ${module.problemCount} practice problems` : ''}
                          {module.live ? ' · Live LLM' : ''}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {!module.completed ? (
                        <button
                          type="button"
                          disabled={markingId === module.id}
                          onClick={() => void markItemComplete(module)}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'transparent',
                            color: '#86efac',
                            border: '1px solid rgba(52,211,153,0.4)',
                            borderRadius: 6,
                            fontWeight: 600,
                            cursor: 'pointer',
                            opacity: markingId === module.id ? 0.6 : 1,
                          }}
                        >
                          {markingId === module.id ? 'Saving…' : 'Mark done'}
                        </button>
                      ) : null}
                      <Link
                        href={module.href}
                        style={{
                          padding: '0.5rem 1.5rem',
                          background: '#22c55e',
                          color: 'white',
                          borderRadius: 6,
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        {module.completed ? 'Review' : 'Start'}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Practice Assignments by Tutorial</h2>
                <p style={{ margin: 0, color: '#9ca3af' }}>
                  Not a timed test — open a set, solve problems one by one, and see score after each submit.
                </p>

                {tutorialList.some((t) => t.problemCount > 0) ? (
                  tutorialList
                    .filter((t) => t.problemCount > 0)
                    .map((t) => (
                      <Link
                        key={t.id}
                        href={t.assignmentHref}
                        style={{
                          display: 'block',
                          textDecoration: 'none',
                          color: 'inherit',
                          background: '#2a2a2a',
                          padding: '1.35rem 1.5rem',
                          borderRadius: 10,
                          border: '1px solid #3a3a3a',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: 8 }}>
                          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{t.title}</h3>
                          <span
                            style={{
                              background: '#f59e0b',
                              color: '#111',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 999,
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              height: 'fit-content',
                            }}
                          >
                            PRACTICE
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={chipStyle}>{t.problemCount} problems</span>
                          <span style={chipStyle}>{t.duration}</span>
                          <span style={chipStyle}>Score after each solve</span>
                        </div>
                      </Link>
                    ))
                ) : (
                  <div style={{ color: '#9ca3af', padding: '2rem 0' }}>No assignments yet for this course.</div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardShell>
  );
}

const chipStyle = {
  padding: '0.25rem 0.6rem',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.08)',
  color: '#e5e5e5',
  fontSize: '0.75rem',
  fontWeight: 500,
} as const;
