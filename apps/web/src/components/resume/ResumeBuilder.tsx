'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import {
  RESUME_TEMPLATES,
  createEmptyResume,
  resumeCompleteness,
  type ResumeData,
  type ResumeSuggestions,
  type ResumeTemplateId,
} from '@/types/resume';
import { downloadResumePdf, pageEdgeGapPx } from './downloadResumePdf';
import { computePreviewPageWindows, type ResumePageWindow } from './resumePreviewPagination';
import styles from './resume.module.css';

/** A4 aspect ratio used for preview page frames */
const A4_RATIO = 297 / 210;

const STORAGE_KEY = 'career-resume-builder-v1';

type Props = {
  seedName?: string;
  seedRole?: string;
};

type Stored = {
  templateId: ResumeTemplateId | null;
  data: ResumeData;
  score?: number | null;
  issues?: string[];
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadStored(seedName?: string, seedRole?: string): Stored {
  if (typeof window === 'undefined') {
    return { templateId: null, data: createEmptyResume({ name: seedName, role: seedRole }) };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { templateId: null, data: createEmptyResume({ name: seedName, role: seedRole }) };
    }
    const parsed = JSON.parse(raw) as Stored;
    return {
      templateId: parsed.templateId ?? null,
      data: {
        ...createEmptyResume({ name: seedName, role: seedRole }),
        ...parsed.data,
        achievements: parsed.data.achievements ?? createEmptyResume({ name: seedName, role: seedRole }).achievements,
      },
      score: parsed.score ?? null,
      issues: parsed.issues ?? [],
    };
  } catch {
    return { templateId: null, data: createEmptyResume({ name: seedName, role: seedRole }) };
  }
}

function persist(state: Stored) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function ResumeBuilder({ seedName, seedRole }: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [templateId, setTemplateId] = useState<ResumeTemplateId | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<ResumeTemplateId>('classic');
  const [data, setData] = useState<ResumeData>(() => createEmptyResume({ name: seedName, role: seedRole }));
  const [score, setScore] = useState<number | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = loadStored(seedName, seedRole);
    setTemplateId(stored.templateId);
    setData(stored.data);
    setScore(stored.score ?? null);
    setIssues(stored.issues ?? []);
    setShowTemplates(!stored.templateId);
    setPendingTemplate(stored.templateId ?? 'classic');
    setHydrated(true);
  }, [seedName, seedRole]);

  useEffect(() => {
    if (!hydrated) return;
    persist({ templateId, data, score, issues });
  }, [hydrated, templateId, data, score, issues]);

  const completeness = useMemo(() => resumeCompleteness(data), [data]);

  const update = <K extends keyof ResumeData>(key: K, value: ResumeData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const applyTemplate = () => {
    setTemplateId(pendingTemplate);
    setShowTemplates(false);
  };

  const getSuggestions = async () => {
    setSuggesting(true);
    setError(null);
    try {
      const res = await api.post<ResumeSuggestions>('/careers/resume/suggest', data);
      setData(res.resume);
      setScore(res.score);
      setIssues(res.criticalIssues ?? []);
      setImprovements(res.improvements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get suggestions');
    } finally {
      setSuggesting(false);
    }
  };

  const downloadPdf = async () => {
    const el = printRef.current?.querySelector('[data-resume-paper]') as HTMLElement | null;
    if (!el) {
      setError('Resume preview is not ready yet. Pick a template and try again.');
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      await downloadResumePdf(el, data.fullName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (!hydrated) {
    return <div className={styles.feedbackBar}>Loading resume builder…</div>;
  }

  return (
    <div>
      <div className={`${styles.toolbar} ${styles.noPrint}`}>
        <div className={styles.toolbarLeft}>
          <h2 className={styles.sectionTitle} style={{ fontSize: '1.1rem' }}>
            Resume Builder
          </h2>
          <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
            ATS-friendly · {templateId ? RESUME_TEMPLATES.find((t) => t.id === templateId)?.name : 'Pick a template'}
          </span>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={styles.btnGhost} onClick={() => setShowTemplates(true)}>
            Change Template
          </button>
          <button type="button" className={styles.btnPrimary} onClick={getSuggestions} disabled={suggesting}>
            {suggesting ? 'Getting suggestions…' : 'Get Suggestions'}
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={downloadPdf}
            disabled={!templateId || downloading}
          >
            {downloading ? 'Preparing PDF…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {(issues.length > 0 || completeness.needsWork.length > 0) && (
        <div className={`${styles.alert} ${styles.alertWarn} ${styles.noPrint}`} style={{ marginTop: '0.75rem' }}>
          Your resume needs critical checks.
          {issues.length > 0
            ? ` ${issues.join(' ')}`
            : ' Resume needs to be improved in multiple areas — fill summary, skills, and stronger bullets.'}
        </div>
      )}

      {score != null && issues.length === 0 && (
        <div className={`${styles.alert} ${styles.alertOk} ${styles.noPrint}`} style={{ marginTop: '0.75rem' }}>
          Looking good — ATS score {score}/100. Keep refining bullets with measurable outcomes.
        </div>
      )}

      {error && (
        <div className={`${styles.alert} ${styles.alertWarn} ${styles.noPrint}`} style={{ marginTop: '0.75rem' }}>
          {error}
        </div>
      )}

      <div className={styles.builder} style={{ marginTop: '0.85rem' }}>
        <aside className={`${styles.editor} ${styles.noPrint}`}>
          <Section
            title="Personal Info and Socials"
            status={completeness.personal ? 'ok' : 'req'}
          >
            <div className={styles.row2}>
              <Field label="Full name" value={data.fullName} onChange={(v) => update('fullName', v)} />
              <Field label="Headline" value={data.headline} onChange={(v) => update('headline', v)} />
            </div>
            <div className={styles.row2}>
              <Field label="Email" value={data.email} onChange={(v) => update('email', v)} />
              <Field label="Phone" value={data.phone ?? ''} onChange={(v) => update('phone', v)} />
            </div>
            <Field label="Location" value={data.location ?? ''} onChange={(v) => update('location', v)} />
            <div className={styles.row2}>
              <Field label="LinkedIn URL" value={data.linkedin ?? ''} onChange={(v) => update('linkedin', v)} />
              <Field label="GitHub URL" value={data.github ?? ''} onChange={(v) => update('github', v)} />
            </div>
            <div className={styles.row2}>
              <Field label="LeetCode URL" value={data.leetcode ?? ''} onChange={(v) => update('leetcode', v)} />
              <Field label="Portfolio URL" value={data.portfolio ?? ''} onChange={(v) => update('portfolio', v)} />
            </div>
            <Field
              label="Professional summary"
              value={data.summary}
              onChange={(v) => update('summary', v)}
              multiline
            />
          </Section>

          <Section title="Skills and Toolset" status={completeness.skills ? 'ok' : 'need'}>
            <Field
              label="Skills (comma separated)"
              value={data.skills.join(', ')}
              onChange={(v) =>
                update(
                  'skills',
                  v
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
            <Field
              label="Tools (comma separated)"
              value={data.tools.join(', ')}
              onChange={(v) =>
                update(
                  'tools',
                  v
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </Section>

          <Section title="Experience" status={completeness.experience ? 'ok' : 'need'}>
            {data.experience.map((exp, idx) => (
              <div key={exp.id} className={styles.itemBlock}>
                <div className={styles.row2}>
                  <Field
                    label="Title"
                    value={exp.title}
                    onChange={(v) => {
                      const next = [...data.experience];
                      next[idx] = { ...exp, title: v };
                      update('experience', next);
                    }}
                  />
                  <Field
                    label="Company"
                    value={exp.company}
                    onChange={(v) => {
                      const next = [...data.experience];
                      next[idx] = { ...exp, company: v };
                      update('experience', next);
                    }}
                  />
                </div>
                <div className={styles.row2}>
                  <Field
                    label="Start"
                    value={exp.start}
                    onChange={(v) => {
                      const next = [...data.experience];
                      next[idx] = { ...exp, start: v };
                      update('experience', next);
                    }}
                  />
                  <Field
                    label="End"
                    value={exp.end}
                    onChange={(v) => {
                      const next = [...data.experience];
                      next[idx] = { ...exp, end: v };
                      update('experience', next);
                    }}
                  />
                </div>
                <Field
                  label="Bullets (one per line)"
                  value={exp.bullets.join('\n')}
                  multiline
                  onChange={(v) => {
                    const next = [...data.experience];
                    next[idx] = {
                      ...exp,
                      bullets: v.split('\n').map((s) => s.trim()).filter(Boolean),
                    };
                    update('experience', next);
                  }}
                />
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => update('experience', data.experience.filter((e) => e.id !== exp.id))}
                    disabled={data.experience.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className={styles.btnGhost}
              style={{ marginTop: '0.55rem' }}
              onClick={() =>
                update('experience', [
                  ...data.experience,
                  {
                    id: uid('exp'),
                    company: '',
                    title: '',
                    start: '',
                    end: '',
                    bullets: [''],
                  },
                ])
              }
            >
              + Add experience
            </button>
          </Section>

          <Section title="Projects" status={completeness.projects ? 'ok' : 'need'}>
            {data.projects.map((proj, idx) => (
              <div key={proj.id} className={styles.itemBlock}>
                <div className={styles.row2}>
                  <Field
                    label="Name"
                    value={proj.name}
                    onChange={(v) => {
                      const next = [...data.projects];
                      next[idx] = { ...proj, name: v };
                      update('projects', next);
                    }}
                  />
                  <Field
                    label="Tech"
                    value={proj.tech ?? ''}
                    onChange={(v) => {
                      const next = [...data.projects];
                      next[idx] = { ...proj, tech: v };
                      update('projects', next);
                    }}
                  />
                </div>
                <Field
                  label="Link"
                  value={proj.link ?? ''}
                  onChange={(v) => {
                    const next = [...data.projects];
                    next[idx] = { ...proj, link: v };
                    update('projects', next);
                  }}
                />
                <Field
                  label="Bullets (one per line)"
                  value={proj.bullets.join('\n')}
                  multiline
                  onChange={(v) => {
                    const next = [...data.projects];
                    next[idx] = {
                      ...proj,
                      bullets: v.split('\n').map((s) => s.trim()).filter(Boolean),
                    };
                    update('projects', next);
                  }}
                />
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => update('projects', data.projects.filter((p) => p.id !== proj.id))}
                    disabled={data.projects.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className={styles.btnGhost}
              style={{ marginTop: '0.55rem' }}
              onClick={() =>
                update('projects', [
                  ...data.projects,
                  { id: uid('proj'), name: '', tech: '', link: '', bullets: [''] },
                ])
              }
            >
              + Add project
            </button>
          </Section>

          <Section title="Achievements" status={completeness.achievements ? 'ok' : 'need'}>
            {(data.achievements ?? []).map((ach, idx) => (
              <div key={ach.id} className={styles.itemBlock}>
                <div className={styles.row2}>
                  <Field
                    label="Title"
                    value={ach.title}
                    onChange={(v) => {
                      const next = [...(data.achievements ?? [])];
                      next[idx] = { ...ach, title: v };
                      update('achievements', next);
                    }}
                  />
                  <Field
                    label="Year"
                    value={ach.year ?? ''}
                    onChange={(v) => {
                      const next = [...(data.achievements ?? [])];
                      next[idx] = { ...ach, year: v };
                      update('achievements', next);
                    }}
                  />
                </div>
                <Field
                  label="Description"
                  value={ach.description ?? ''}
                  multiline
                  onChange={(v) => {
                    const next = [...(data.achievements ?? [])];
                    next[idx] = { ...ach, description: v };
                    update('achievements', next);
                  }}
                />
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() =>
                      update(
                        'achievements',
                        (data.achievements ?? []).filter((a) => a.id !== ach.id),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className={styles.btnGhost}
              style={{ marginTop: '0.55rem' }}
              onClick={() =>
                update('achievements', [
                  ...(data.achievements ?? []),
                  { id: uid('ach'), title: '', year: '', description: '' },
                ])
              }
            >
              + Add achievement
            </button>
          </Section>

          <Section title="Education" status="ok">
            {data.education.map((edu, idx) => (
              <div key={edu.id} className={styles.itemBlock}>
                <Field
                  label="School"
                  value={edu.school}
                  onChange={(v) => {
                    const next = [...data.education];
                    next[idx] = { ...edu, school: v };
                    update('education', next);
                  }}
                />
                <div className={styles.row2}>
                  <Field
                    label="Degree"
                    value={edu.degree}
                    onChange={(v) => {
                      const next = [...data.education];
                      next[idx] = { ...edu, degree: v };
                      update('education', next);
                    }}
                  />
                  <Field
                    label="Year"
                    value={edu.year}
                    onChange={(v) => {
                      const next = [...data.education];
                      next[idx] = { ...edu, year: v };
                      update('education', next);
                    }}
                  />
                </div>
              </div>
            ))}
          </Section>

          <div className={styles.feedbackBar}>
            <span>Your resume is compiled for feedback</span>
            <span className={styles.score}>{score != null ? `Score ${score}` : 'Draft'}</span>
          </div>

          {improvements.length > 0 && (
            <div className={styles.sectionCard}>
              <p className={styles.sectionTitle}>Suggestions</p>
              <ul className={styles.bullets} style={{ color: '#c4c4c4' }}>
                {improvements.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className={styles.previewCol}>
          <div className={styles.previewShell}>
            <div className={`${styles.floatBar} ${styles.noPrint}`}>
              <button
                type="button"
                className={styles.floatBtn}
                title="Change template"
                onClick={() => setShowTemplates(true)}
              >
                Aa
              </button>
              <button
                type="button"
                className={styles.floatBtn}
                title="Download PDF"
                onClick={downloadPdf}
                disabled={downloading}
              >
                ↓
              </button>
            </div>
            <div ref={printRef}>
              <ResumePreview data={data} templateId={templateId ?? 'classic'} />
            </div>
          </div>
        </div>
      </div>

      {showTemplates && (
        <div className={`${styles.modalBackdrop} ${styles.noPrint}`} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Please select a resume template!</h3>
            <p className={styles.modalSub}>All templates are single-column and ATS-friendly.</p>
            <div className={styles.templateGrid}>
              {RESUME_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.templateCard} ${pendingTemplate === t.id ? styles.templateCardActive : ''}`}
                  onClick={() => setPendingTemplate(t.id)}
                >
                  <div className={styles.templateThumb}>
                    <div className={`${styles.thumbLine} ${styles.thumbLineShort}`} />
                    <div className={styles.thumbLine} />
                    <div className={styles.thumbBlock} />
                    <div className={styles.thumbLine} />
                    <div className={styles.thumbLine} />
                    <div className={`${styles.thumbLine} ${styles.thumbLineShort}`} />
                    <div className={styles.thumbBlock} />
                  </div>
                  <p className={styles.templateName}>{t.name}</p>
                  <p className={styles.templateBlurb}>{t.blurb}</p>
                </button>
              ))}
            </div>
            <div className={styles.modalActions}>
              {templateId && (
                <button type="button" className={styles.btnGhost} onClick={() => setShowTemplates(false)}>
                  Cancel
                </button>
              )}
              <button type="button" className={styles.btnPrimary} onClick={applyTemplate}>
                Use this template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  status,
  children,
}: {
  title: string;
  status: 'ok' | 'need' | 'req';
  children: ReactNode;
}) {
  const label = status === 'ok' ? 'Complete' : status === 'need' ? 'Needs Work' : 'Required';
  const cls = status === 'ok' ? styles.statusOk : status === 'need' ? styles.statusNeed : styles.statusReq;
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <span className={cls}>{label}</span>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {multiline ? (
        <textarea className={styles.textarea} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={styles.input} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function ResumePreview({ data, templateId }: { data: ResumeData; templateId: ResumeTemplateId }) {
  const measureRef = useRef<HTMLElement>(null);
  const [pageHeight, setPageHeight] = useState(0);
  const [windows, setWindows] = useState<ResumePageWindow[]>([{ start: 0, end: 1 }]);

  const paperClass = [
    styles.paper,
    templateId === 'compact' ? styles.paperCompact : '',
    templateId === 'modern' ? styles.paperModern : '',
  ]
    .filter(Boolean)
    .join(' ');

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.clientWidth || 720;
      const nextPageHeight = Math.round(width * A4_RATIO);
      const edgeGap = pageEdgeGapPx(nextPageHeight);
      const nextWindows = computePreviewPageWindows(el, nextPageHeight, edgeGap);
      setPageHeight(nextPageHeight);
      setWindows(nextWindows);
    };

    // Double rAF so fonts/layout settle before measuring break points.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(measure);
    });

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro?.disconnect();
    };
  }, [data, templateId]);

  return (
    <div className={styles.pagesStack}>
      {/* Continuous source used for PDF capture + height measurement */}
      <div className={styles.measureLayer} aria-hidden>
        <article ref={measureRef} className={paperClass} data-resume-paper>
          <ResumeBody data={data} templateId={templateId} />
        </article>
      </div>

      {windows.map((win, pageIndex) => {
        const contentHeight = Math.max(1, Math.round(win.end - win.start));
        const edgeGap = pageHeight ? pageEdgeGapPx(pageHeight) : 0;
        const isFirst = pageIndex === 0;

        let topSpacer = 0;
        let bottomSpacer = 0;
        if (pageHeight > 0) {
          const leftover = Math.max(0, pageHeight - contentHeight);
          if (isFirst) {
            // Keep empty space at the bottom of page 1.
            bottomSpacer = Math.max(leftover, windows.length > 1 ? edgeGap : leftover);
          } else {
            // Keep empty space at the top of continuation pages.
            topSpacer = Math.max(edgeGap, 0);
            bottomSpacer = Math.max(0, leftover - topSpacer);
          }
        }

        const sheetHeight = topSpacer + contentHeight + bottomSpacer;

        return (
          <div
            key={`${win.start}-${win.end}-${pageIndex}`}
            className={styles.pageSheet}
            style={{ height: sheetHeight }}
          >
            <span className={`${styles.pageBadge} ${styles.noPrint}`}>Page {pageIndex + 1}</span>
            {topSpacer > 0 ? <div className={styles.pageTopSpacer} style={{ height: topSpacer }} aria-hidden /> : null}
            {/* Clip height matches a whole-block window — never cuts mid-line */}
            <div className={styles.pageClip} style={{ height: contentHeight }}>
              <div style={{ transform: `translateY(-${win.start}px)` }}>
                <article className={paperClass}>
                  <ResumeBody data={data} templateId={templateId} />
                </article>
              </div>
            </div>
            {bottomSpacer > 0 ? (
              <div className={styles.pageBottomSpacer} style={{ height: bottomSpacer }} aria-hidden />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ensureHref(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^(https?:|mailto:)/i.test(t)) return t;
  return `https://${t}`;
}

function IconLinkedIn({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.23 0z"
      />
    </svg>
  );
}

function IconGitHub({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.9 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z"
      />
    </svg>
  );
}

function IconLeetCode({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M13.48 4.23a1.4 1.4 0 0 1 2 0l6.02 6.07a1.4 1.4 0 0 1 0 2l-6.02 6.07a1.4 1.4 0 0 1-2 0l-.7-.7 5.72-5.77a.6.6 0 0 0 0-.85l-5.72-5.77.7-.7zm-2.96 0 .7.7-5.72 5.77a.6.6 0 0 0 0 .85l5.72 5.77-.7.7a1.4 1.4 0 0 1-2 0L2.5 12.3a1.4 1.4 0 0 1 0-2l6.02-6.07a1.4 1.4 0 0 1 2 0z"
      />
      <path
        fill="currentColor"
        d="M9.2 15.35a.9.9 0 0 1 0-1.27l4.3-4.35a.9.9 0 1 1 1.28 1.27l-4.3 4.35a.9.9 0 0 1-1.28 0z"
      />
    </svg>
  );
}

function IconGlobe({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm7.9 9h-3.2a15.4 15.4 0 0 0-1.3-5 8.05 8.05 0 0 1 4.5 5zM12 4c.9 0 2.2 1.9 2.9 5H9.1C9.8 5.9 11.1 4 12 4zM4.1 11h3.2a15.4 15.4 0 0 1 1.3-5 8.05 8.05 0 0 0-4.5 5zM7.3 13H4.1a8.05 8.05 0 0 0 4.5 5 15.4 15.4 0 0 1-1.3-5zm1.8 0h5.8c-.7 3.1-2 5-2.9 5s-2.2-1.9-2.9-5zm7.6 0a15.4 15.4 0 0 1-1.3 5 8.05 8.05 0 0 0 4.5-5h-3.2z"
      />
    </svg>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  const url = ensureHref(href);
  if (!url) return null;
  return (
    <a
      className={styles.socialLink}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
    >
      {children}
    </a>
  );
}

function ResumeBody({ data, templateId }: { data: ResumeData; templateId: ResumeTemplateId }) {
  const metaParts = [data.email, data.phone, data.location].filter(Boolean);
  const hasSocial = Boolean(data.linkedin || data.github || data.leetcode || data.portfolio);

  return (
    <>
      <header className={styles.resumeHeader}>
        <h1 className={styles.name}>{data.fullName || 'Your Name'}</h1>
        <p className={styles.headline}>{data.headline}</p>
        {metaParts.length > 0 ? <p className={styles.contactMeta}>{metaParts.join(' · ')}</p> : null}
        {hasSocial ? (
          <div className={styles.socialRow}>
            <SocialLink href={data.linkedin ?? ''} label="LinkedIn">
              <IconLinkedIn />
            </SocialLink>
            <SocialLink href={data.github ?? ''} label="GitHub">
              <IconGitHub />
            </SocialLink>
            <SocialLink href={data.leetcode ?? ''} label="LeetCode">
              <IconLeetCode />
            </SocialLink>
            <SocialLink href={data.portfolio ?? ''} label="Portfolio">
              <IconGlobe />
            </SocialLink>
          </div>
        ) : null}
      </header>

      {data.summary.trim() && (
        <section className={styles.section}>
          <h2 className={styles.sectionH}>Summary</h2>
          <p className={styles.bodyText}>{data.summary}</p>
        </section>
      )}

      {data.skills.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionH}>Skills</h2>
          {templateId === 'modern' ? (
            <ul className={styles.skillChips}>
              {data.skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.skillsLine}>{data.skills.join(' · ')}</p>
          )}
        </section>
      )}

      {data.tools.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionH}>Tools</h2>
          {templateId === 'modern' ? (
            <ul className={styles.skillChips}>
              {data.tools.map((tool) => (
                <li key={tool}>{tool}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.skillsLine}>{data.tools.join(' · ')}</p>
          )}
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionH}>Experience</h2>
        {data.experience.map((exp) => (
          <div key={exp.id} className={styles.entryBlock}>
            <div className={styles.jobHead}>
              <strong>
                {exp.title}
                {exp.company ? ` — ${exp.company}` : ''}
              </strong>
              <span className={styles.muted}>
                {exp.start}
                {exp.end ? ` – ${exp.end}` : ''}
              </span>
            </div>
            {exp.location && (
              <p className={styles.muted} style={{ margin: 0, fontSize: '0.8rem' }}>
                {exp.location}
              </p>
            )}
            <ul className={styles.bullets}>
              {exp.bullets.filter(Boolean).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionH}>Projects</h2>
        {data.projects.map((p) => (
          <div key={p.id} className={styles.entryBlock}>
            <div className={styles.projHead}>
              <strong>
                {p.name}
                {p.tech ? ` (${p.tech})` : ''}
              </strong>
              {p.link ? (
                <a className={styles.inlineLink} href={ensureHref(p.link)} target="_blank" rel="noopener noreferrer">
                  Link
                </a>
              ) : null}
            </div>
            <ul className={styles.bullets}>
              {p.bullets.filter(Boolean).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {(data.achievements ?? []).some((a) => a.title.trim()) && (
        <section className={styles.section}>
          <h2 className={styles.sectionH}>Achievements</h2>
          {(data.achievements ?? [])
            .filter((a) => a.title.trim())
            .map((a) => (
              <div key={a.id} className={styles.entryBlock}>
                <div className={styles.eduHead}>
                  <strong>{a.title}</strong>
                  {a.year ? <span className={styles.muted}>{a.year}</span> : null}
                </div>
                {a.description?.trim() ? (
                  <ul className={styles.bullets}>
                    <li>{a.description}</li>
                  </ul>
                ) : null}
              </div>
            ))}
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionH}>Education</h2>
        {data.education.map((e) => (
          <div key={e.id} className={styles.entryBlock}>
            <div className={styles.eduHead}>
              <strong>
                {e.degree} — {e.school}
                {e.details ? ` · ${e.details}` : ''}
              </strong>
              <span className={styles.muted}>{e.year}</span>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

