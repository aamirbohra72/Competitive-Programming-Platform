'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, ClipboardList, Clock3, FileText, GraduationCap, RefreshCw, Save } from 'lucide-react';
import { z } from 'zod';
import { DashboardShell } from '@/components/DashboardShell';
import { getToken, getUser } from '@/lib/auth';
import { completeLearningItem, fetchCourseProgress } from '@/lib/learningProgress';
import { FDE_COURSE_ID, FDE_COURSE_TITLE, FDE_LESSON_COUNT, FDE_MODULES, FDE_PROGRESS_TOTAL, FDE_TOTAL_WEEKS } from '@/data/fde-bootcamp';
import styles from './course.module.css';

type View = 'classes' | 'notes' | 'assignment';
const draftSchema = z.record(z.object({ text: z.string().max(30000), checked: z.array(z.number().int().min(0).max(2)) }));
type Drafts = z.infer<typeof draftSchema>;
const views: Array<{ id: View; title: string; icon: typeof BookOpen }> = [
  { id: 'classes', title: 'Core curriculum', icon: GraduationCap },
  { id: 'notes', title: 'Learning notes', icon: BookOpen },
  { id: 'assignment', title: 'Assignments', icon: ClipboardList },
];
const validItems = new Set(FDE_MODULES.flatMap((module) => module.lessons.flatMap((lesson) => [`${lesson.id}:notes`, `${lesson.id}:assignment`])));

function FdeCourseWorkspace() {
  const router = useRouter();
  const query = useSearchParams();
  const selectedModule = FDE_MODULES.find((module) => module.id === query.get('module')) ?? FDE_MODULES[0];
  const selectedLesson = selectedModule.lessons.find((lesson) => lesson.id === query.get('lesson')) ?? selectedModule.lessons[0];
  const view: View = query.get('view') === 'notes' ? 'notes' : query.get('view') === 'assignment' ? 'assignment' : 'classes';
  const moduleIndex = FDE_MODULES.indexOf(selectedModule);
  const lessonIndex = selectedModule.lessons.indexOf(selectedLesson);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Drafts>({});
  const [storageKey, setStorageKey] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const draft = drafts[selectedLesson.id] ?? { text: '', checked: [] };
  const moduleReadCount = selectedModule.lessons.filter((lesson) => completed.has(`${lesson.id}:notes`)).length;
  const moduleAssignmentCount = selectedModule.lessons.filter((lesson) => completed.has(`${lesson.id}:assignment`)).length;
  const percent = Math.round(completed.size / FDE_PROGRESS_TOTAL * 100);

  const navigate = (moduleId: string, lessonId: string, nextView: View) => {
    setError(''); setNotice('');
    router.push(`/learn/fde-bootcamp?module=${moduleId}&lesson=${lessonId}&view=${nextView}`, { scroll: false });
  };

  const refreshProgress = async () => {
    if (!getToken()) return;
    setLoading(true);
    setError('');
    try {
      const progress = await fetchCourseProgress(FDE_COURSE_ID);
      setCompleted(new Set(progress?.items?.filter((item) => item.completed && validItems.has(item.itemId)).map((item) => item.itemId) ?? []));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load course progress.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const key = `fde-bootcamp-drafts:${getUser()?.id ?? 'guest'}`;
    setStorageKey(key);
    setSignedIn(Boolean(getToken()));
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = draftSchema.safeParse(JSON.parse(stored));
        if (parsed.success) setDrafts(parsed.data);
      }
    } catch { setError('Saved assignment drafts could not be read on this device.'); }
    void refreshProgress();
  }, []);

  const updateDraft = (changes: Partial<Drafts[string]>) => {
    setDrafts((current) => ({ ...current, [selectedLesson.id]: { ...draft, ...changes } }));
    setNotice('Unsaved changes');
  };

  const saveDraft = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(drafts));
      setNotice('Draft saved on this device');
    } catch { setError('Could not save the draft. Browser storage may be full or disabled.'); }
  };

  const markComplete = async (itemType: 'notes' | 'assignment') => {
    if (!getToken()) { setError('Sign in to save completion to your account.'); return; }
    if (itemType === 'assignment' && (draft.checked.length !== selectedLesson.assignment.tasks.length || draft.text.trim().length < 80)) {
      setError('Complete every checklist item and add at least 80 characters of solution evidence.'); return;
    }
    setSaving(true); setError('');
    try {
      const result = await completeLearningItem({
        courseId: FDE_COURSE_ID, courseKind: 'catalog', title: FDE_COURSE_TITLE,
        itemId: `${selectedLesson.id}:${itemType}`, itemType: itemType === 'notes' ? 'tutorial' : 'assignment',
        itemTitle: `${selectedLesson.title} - ${itemType === 'notes' ? 'Learning notes' : 'Assignment'}`,
        itemHref: `/learn/fde-bootcamp?module=${selectedModule.id}&lesson=${selectedLesson.id}&view=${itemType}`,
        totalCount: FDE_PROGRESS_TOTAL,
      });
      setCompleted(new Set(result.progress.items?.filter((item) => item.completed && validItems.has(item.itemId)).map((item) => item.itemId) ?? []));
      if (itemType === 'assignment') saveDraft();
      setNotice(itemType === 'assignment' ? 'Self-reviewed assignment completion saved' : 'Learning notes marked complete');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save completion.'); }
    finally { setSaving(false); }
  };

  const allLessons = FDE_MODULES.flatMap((module) => module.lessons.map((lesson) => ({ module, lesson })));
  const nextLesson = allLessons[allLessons.findIndex((entry) => entry.lesson.id === selectedLesson.id) + 1];

  return (
    <DashboardShell immersive mainClassName={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Link href="/learn" className={styles.iconButton} aria-label="Back to courses" title="Back to courses"><ArrowLeft size={20} /></Link>
          <GraduationCap size={26} className={styles.brandIcon} aria-hidden="true" />
          <h1>FDE Bootcamp</h1>
        </div>
        <nav aria-label="Course views" className={styles.tabs}>
          {views.map(({ id, title, icon: Icon }) => <button key={id} type="button" aria-current={view === id ? 'page' : undefined} className={view === id ? styles.activeTab : ''} onClick={() => navigate(selectedModule.id, selectedLesson.id, id)}><Icon size={17} aria-hidden="true" />{title}</button>)}
        </nav>
        <div className={styles.headerProgress}><span>{percent}% complete</span><div className={styles.progressTrack}><div style={{ width: `${percent}%` }} /></div></div>
      </header>

      <div className={styles.courseBar}>
        <span>Forward Deployed Engineering <span className={styles.barDivider}>/</span> 14 modules <span className={styles.barDivider}>/</span> {FDE_LESSON_COUNT} lessons</span>
        <span className={styles.courseDuration}><Clock3 size={14} aria-hidden="true" /> {FDE_TOTAL_WEEKS} weeks</span>
      </div>

      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="Course modules">
          <div className={styles.sidebarHeading}><span>COURSE MODULES</span><span>14</span></div>
          {FDE_MODULES.map((module, index) => {
            const active = selectedModule.id === module.id;
            const done = module.lessons.filter((lesson) => completed.has(`${lesson.id}:notes`)).length;
            return <section key={module.id} className={`${styles.moduleCard} ${active ? styles.activeModule : ''}`}>
              <button type="button" className={styles.moduleTitle} aria-current={active ? 'true' : undefined} onClick={() => navigate(module.id, module.lessons[0].id, 'classes')}>
                <span className={styles.moduleEyebrow}>MODULE - {index + 1}<span>{module.weeks} {module.weeks === 1 ? 'week' : 'weeks'}</span></span>
                <strong>{module.title}</strong>
              </button>
              <button type="button" className={`${styles.moduleClasses} ${active && view === 'classes' ? styles.selectedClasses : ''}`} onClick={() => navigate(module.id, module.lessons[0].id, 'classes')}><BookOpen size={14} aria-hidden="true" />Classes <span>{done}/{module.lessons.length}<ChevronRight size={15} aria-hidden="true" /></span></button>
              {active && <div className={styles.moduleLinks}>
                <button type="button" onClick={() => navigate(module.id, selectedLesson.id, 'notes')}><FileText size={14} aria-hidden="true" /> Learning notes</button>
                <button type="button" onClick={() => navigate(module.id, selectedLesson.id, 'assignment')}><ClipboardList size={14} aria-hidden="true" /> Assignments</button>
              </div>}
            </section>;
          })}
        </aside>

        <div className={styles.content}>
          <label className={styles.mobileModules}>Module
            <select value={selectedModule.id} onChange={(event) => { const module = FDE_MODULES.find((entry) => entry.id === event.target.value)!; navigate(module.id, module.lessons[0].id, 'classes'); }}>
              {FDE_MODULES.map((module, index) => <option key={module.id} value={module.id}>{index + 1}. {module.title}</option>)}
            </select>
          </label>
          <div className={styles.moduleHeader}>
            <div><div className={styles.moduleMeta}>MODULE - {moduleIndex + 1}<span>{selectedModule.weeks} {selectedModule.weeks === 1 ? 'week' : 'weeks'}</span></div><h2>{selectedModule.title}</h2><p>{selectedModule.description}</p></div>
            <button type="button" className={styles.outlineButton} onClick={() => void refreshProgress()} disabled={loading || !signedIn}><RefreshCw size={15} className={loading ? styles.spinning : ''} aria-hidden="true" />{loading ? 'Refreshing...' : 'Refresh progress'}</button>
          </div>
          {!signedIn && <p className={styles.loginNotice}>Preview access <span>Progress is not saved to an account.</span><Link href="/sign-in?redirect_url=%2Flearn%2Ffde-bootcamp">Sign in</Link></p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {notice && <p className={styles.notice} role="status">{notice}</p>}

          {view === 'classes' ? <>
            <div className={styles.moduleSummary}><span><BookOpen size={15} aria-hidden="true" />{moduleReadCount}/{selectedModule.lessons.length} notes completed</span><span><ClipboardList size={15} aria-hidden="true" />{moduleAssignmentCount}/{selectedModule.lessons.length} assignments completed</span></div>
            <div className={styles.lessonList}>
              {selectedModule.lessons.map((lesson, index) => {
                const read = completed.has(`${lesson.id}:notes`);
                const submitted = completed.has(`${lesson.id}:assignment`);
                const checked = submitted ? lesson.assignment.tasks.length : drafts[lesson.id]?.checked.length ?? 0;
                return <article key={lesson.id} className={styles.lessonRow}>
                  <button type="button" className={styles.lessonTitle} onClick={() => navigate(selectedModule.id, lesson.id, 'notes')}>
                    <span className={styles.lessonEyebrow}>CLASS {index + 1}<span>{lesson.minutes} min</span></span>
                    <h3>{lesson.title}</h3>
                    <span className={styles.lessonOverview}>{lesson.overview}</span>
                  </button>
                  <div className={styles.lessonStats}>
                    <button type="button" onClick={() => navigate(selectedModule.id, lesson.id, 'notes')}><span>Learning notes</span><strong className={read ? styles.success : ''}>{read ? 'Completed' : 'Not started'}</strong></button>
                    <button type="button" onClick={() => navigate(selectedModule.id, lesson.id, 'assignment')}><span>Assignment</span><strong className={submitted ? styles.success : styles.pending}>{checked} / {lesson.assignment.tasks.length}</strong></button>
                    <button type="button" className={styles.lessonArrow} aria-label={`Open ${lesson.title}`} title={`Open ${lesson.title}`} onClick={() => navigate(selectedModule.id, lesson.id, 'notes')}><ChevronRight size={21} /></button>
                  </div>
                </article>;
              })}
            </div>
            <div className={styles.moduleFooter}><span>Module {moduleIndex + 1} of 14</span>{FDE_MODULES[moduleIndex + 1] && <button type="button" className={styles.textButton} onClick={() => { const module = FDE_MODULES[moduleIndex + 1]; navigate(module.id, module.lessons[0].id, 'classes'); }}>Next module<ArrowRight size={16} aria-hidden="true" /></button>}</div>
          </> : <section className={styles.studySection}>
            <div className={styles.studyToolbar}>
              <button type="button" className={styles.textButton} onClick={() => navigate(selectedModule.id, selectedLesson.id, 'classes')}><ArrowLeft size={15} aria-hidden="true" />All classes</button>
              <label>Class<select value={selectedLesson.id} onChange={(event) => navigate(selectedModule.id, event.target.value, view)}>{selectedModule.lessons.map((lesson, index) => <option key={lesson.id} value={lesson.id}>{index + 1}. {lesson.title}</option>)}</select></label>
            </div>
            <div className={styles.studyHeading}><span className={styles.lessonEyebrow}>CLASS {lessonIndex + 1} / {selectedModule.lessons.length}<span><Clock3 size={13} aria-hidden="true" />{selectedLesson.minutes} min</span></span><h3>{selectedLesson.title}</h3><p>{selectedLesson.overview}</p></div>
            {view === 'notes' ? <>
              <div className={styles.notes}>
                {selectedLesson.notes.map((note, index) => <section key={note}><span className={styles.noteNumber}>0{index + 1}</span><div><h4>{['Foundations', 'Engineering practice', 'Validation & trade-offs'][index]}</h4><p>{note}</p></div></section>)}
              </div>
              <div className={styles.takeaway}><BookOpen size={19} aria-hidden="true" /><div><h4>Before moving on</h4><p>Explain the design choices, identify a failure case, and connect the lesson to its assignment.</p></div></div>
              <div className={styles.studyActions}>
                <button type="button" className={styles.primaryButton} disabled={saving || completed.has(`${selectedLesson.id}:notes`)} onClick={() => void markComplete('notes')}><Check size={16} aria-hidden="true" />{completed.has(`${selectedLesson.id}:notes`) ? 'Notes completed' : saving ? 'Saving...' : 'Mark notes complete'}</button>
                <button type="button" className={styles.outlineButton} onClick={() => navigate(selectedModule.id, selectedLesson.id, 'assignment')}><ClipboardList size={16} aria-hidden="true" />Open assignment</button>
              </div>
            </> : <>
              <div className={styles.assignmentHeading}><ClipboardList size={20} aria-hidden="true" /><div><h4>{selectedLesson.assignment.title}</h4><p>Self-reviewed practical assignment</p></div></div>
              <fieldset className={styles.checklist}><legend>Acceptance checklist</legend>{selectedLesson.assignment.tasks.map((task, index) => <label key={task}><input type="checkbox" checked={draft.checked.includes(index) || completed.has(`${selectedLesson.id}:assignment`)} disabled={completed.has(`${selectedLesson.id}:assignment`)} onChange={(event) => updateDraft({ checked: event.target.checked ? [...draft.checked, index] : draft.checked.filter((value) => value !== index) })} /><span>{task}</span></label>)}</fieldset>
              <label className={styles.solutionLabel} htmlFor="fde-solution">Solution & evidence<span>Include implementation notes, test results, and trade-offs. Use synthetic data; omit secrets and personal information.</span></label>
              <textarea id="fde-solution" value={draft.text} maxLength={30000} onChange={(event) => updateDraft({ text: event.target.value })} rows={9} placeholder="Document your solution, repository reference, test evidence, and limitations..." className={styles.solution} />
              <div className={styles.solutionMeta}><span>{draft.text.length} / 30,000 characters</span><span>Drafts stay on this device. Account progress stores completion only.</span></div>
              <div className={styles.studyActions}>
                <button type="button" className={styles.outlineButton} onClick={saveDraft}><Save size={16} aria-hidden="true" />Save draft</button>
                <button type="button" className={styles.primaryButton} disabled={saving || completed.has(`${selectedLesson.id}:assignment`) || draft.checked.length !== 3 || draft.text.trim().length < 80} onClick={() => void markComplete('assignment')}><CheckCircle2 size={16} aria-hidden="true" />{completed.has(`${selectedLesson.id}:assignment`) ? 'Assignment completed' : saving ? 'Saving...' : 'Mark self-reviewed complete'}</button>
              </div>
              <p className={styles.selfReview}>Completion is self-reported, not an automated grade or instructor approval.</p>
            </>}
            {nextLesson && <div className={styles.nextClass}><span>UP NEXT</span><button type="button" className={styles.textButton} onClick={() => navigate(nextLesson.module.id, nextLesson.lesson.id, 'notes')}>{nextLesson.lesson.title}<ArrowRight size={16} aria-hidden="true" /></button></div>}
          </section>}
          <footer className={styles.sourceFooter}>Curriculum adapted from the supplied FDE Bootcamp document. Lesson notes and assignments are original study materials. Capstones are included in modules 13 and 14.</footer>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function FdeBootcampPage() {
  return <Suspense fallback={<div className={styles.loading}>Loading FDE Bootcamp...</div>}><FdeCourseWorkspace /></Suspense>;
}