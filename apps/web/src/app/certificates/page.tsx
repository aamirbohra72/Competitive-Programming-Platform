'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { DashboardShell } from '@/components/DashboardShell';
import { downloadCertificatePdf } from '@/components/certificates/downloadCertificatePdf';
import { getUser, getToken } from '@/lib/auth';
import { resolveCertificateRecipientName } from '@/lib/certificateName';
import {
  type CertificateStatus,
  resolveCertificateCourses,
} from '@/lib/certificates';
import { fetchLearningSummary } from '@/lib/learningProgress';
import { markLocalEnrollments } from '@/lib/enrollment';

type CourseRow = ReturnType<typeof resolveCertificateCourses>[number];

function actionLabel(status: CertificateStatus): string {
  if (status === 'eligible') return 'Generate Certificate';
  if (status === 'in_progress') return 'Complete The Course';
  return 'Enroll Now';
}

function buttonColors(status: CertificateStatus): { bg: string; hover: string } {
  if (status === 'eligible') return { bg: '#16a34a', hover: '#15803d' };
  if (status === 'in_progress') return { bg: '#3b82f6', hover: '#2563eb' };
  return { bg: '#1e3a8a', hover: '#1e40af' };
}

export default function CertificatesPage() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refreshCourses = useCallback(() => {
    if (!getToken()) {
      setCourses(resolveCertificateCourses());
      return;
    }
    void fetchLearningSummary()
      .then((summary) => {
        if (!summary) {
          setCourses(resolveCertificateCourses());
          return;
        }
        const enrolledIds = new Set(summary.enrollments.map((e) => e.productId));
        markLocalEnrollments([...enrolledIds]);
        const progressByProduct = new Map(
          summary.courses.map((c) => [
            c.courseId,
            { percent: c.percent, completed: c.completed },
          ]),
        );
        setCourses(resolveCertificateCourses({ enrolledIds, progressByProduct }));
      })
      .catch(() => setCourses(resolveCertificateCourses()));
  }, []);

  useEffect(() => {
    refreshCourses();
  }, [refreshCourses]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const claimed = courses.filter((c) => c.status === 'eligible');

  const handleAction = (course: CourseRow) => {
    if (course.status === 'eligible') {
      setGeneratingId(course.id);
      try {
        const localUser = getUser();
        const recipientName = resolveCertificateRecipientName({
          firstName: clerkUser?.firstName,
          lastName: clerkUser?.lastName,
          fullName: clerkUser?.fullName,
          email:
            clerkUser?.primaryEmailAddress?.emailAddress ||
            localUser?.email ||
            null,
          username: localUser?.username,
        });
        downloadCertificatePdf({
          recipientName,
          courseTitle: course.title,
        });
        setToast(`Downloaded certificate for ${course.title}`);
      } catch {
        setToast('Could not generate certificate. Please try again.');
      } finally {
        setGeneratingId(null);
      }
      return;
    }

    setIsModalOpen(false);
    router.push(course.href);
  };

  return (
    <DashboardShell mainClassName="relative min-h-0 overflow-y-auto p-8">
      <div>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Certificates</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          View and claim your course certificates
        </p>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          style={{
            background: 'var(--accent-theme)',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#166534';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent-theme)';
          }}
        >
          Claim Your Certificates
        </button>

        {claimed.length > 0 && (
          <div style={{ marginTop: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: 600 }}>
              Ready to download
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 560 }}>
              {claimed.map((course) => {
                const colors = buttonColors('eligible');
                return (
                  <div
                    key={course.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem',
                      background: 'var(--surface-panel)',
                      borderRadius: 8,
                      border: '1px solid var(--border-theme)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{course.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        Course completed
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={generatingId === course.id}
                      onClick={() => handleAction(course)}
                      style={{
                        padding: '0.5rem 1.25rem',
                        borderRadius: 6,
                        border: 'none',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: colors.bg,
                        color: 'white',
                        whiteSpace: 'nowrap',
                        opacity: generatingId === course.id ? 0.7 : 1,
                      }}
                    >
                      {generatingId === course.id ? 'Generating…' : 'Download PDF'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(22, 48, 37, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            style={{
              background: 'var(--surface-page)',
              color: 'var(--text-theme)',
              border: '1px solid var(--border-theme)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 600,
              maxHeight: '80vh',
              overflowY: 'auto',
              position: 'relative',
              boxShadow: '0 20px 60px rgba(22, 48, 37, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.5rem',
                borderBottom: '1px solid var(--border-theme)',
                position: 'sticky',
                top: 0,
                background: 'var(--surface-page)',
                zIndex: 10,
              }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: 'var(--text-theme)',
                  margin: 0,
                }}
              >
                Claim your certificates
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-theme)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-panel)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Complete a course to unlock PDF certificate download. Finished courses show{' '}
                <span style={{ color: 'var(--accent-theme)', fontWeight: 600 }}>Generate Certificate</span>.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {courses.map((course) => {
                  const colors = buttonColors(course.status);
                  const busy = generatingId === course.id;
                  return (
                    <div
                      key={course.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1rem',
                        background: 'var(--surface-panel)',
                        borderRadius: 8,
                        border:
                          course.status === 'eligible'
                            ? '1px solid #166534'
                            : '1px solid var(--border-theme)',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '1rem',
                            color: 'var(--text-theme)',
                            fontWeight: 500,
                            display: 'block',
                          }}
                        >
                          {course.title}
                        </span>
                        {course.status === 'eligible' && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-theme)' }}>
                            Ready to generate
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAction(course)}
                        style={{
                          padding: '0.5rem 1.25rem',
                          borderRadius: 6,
                          border: 'none',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor: busy ? 'wait' : 'pointer',
                          transition: 'all 0.2s',
                          background: colors.bg,
                          color: 'white',
                          whiteSpace: 'nowrap',
                          opacity: busy ? 0.75 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!busy) e.currentTarget.style.background = colors.hover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = colors.bg;
                        }}
                      >
                        {busy ? 'Generating…' : actionLabel(course.status)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1100,
            background: '#166534',
            color: 'white',
            padding: '0.75rem 1.25rem',
            borderRadius: 8,
            fontSize: '0.9rem',
            fontWeight: 500,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </DashboardShell>
  );
}
