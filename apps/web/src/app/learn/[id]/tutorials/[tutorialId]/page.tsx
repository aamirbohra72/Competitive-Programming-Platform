'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { completeLearningItem } from '@/lib/learningProgress';
import { CATALOG_TOTALS } from '@/types/learning-progress';
import {
  getQuestionsForTutorial,
  getTutorial,
  getTutorialsForCourse,
  catalogLearningById,
} from '@/data/tutorials/catalog-index';
import {
  loadProgress,
  type PracticeProgress,
} from '@/data/tutorials/system-design';
import {
  getTutorialLearning,
  saveCoinState,
  syncCoinsFromProgress,
  totalCoins,
  type CoinState,
  type TutorialLearningContent,
} from '@/data/tutorials/learning-content';
import { isLlmDrivenCourse, type LlmCoursePack, type LlmTutorial } from '@/types/llm-course';
import { SessionVideoPlayer, useTopicVideos, type VideoTopic } from '@/components/videos/SessionVideoPlayer';
import styles from '../tutorial.module.css';

type Tab = 'session' | 'assignment';

type UiQuestion = {
  id: string;
  type: string;
  marks: number;
  question: string;
  options?: string[];
  correct_answer?: string;
  expected_answer?: string;
  explanation?: string;
};

type UiTutorial = {
  id: string;
  title: string;
  dateLabel: string;
  duration: string;
  estimatedTimeLeft: string;
  videoTitle: string;
  videoMeta: string;
  recordingUrl?: string;
  videoTopic?: VideoTopic;
  questions: UiQuestion[];
  learning: TutorialLearningContent;
  source: 'static' | 'llm';
};

function difficultyFor(type: string) {
  if (type === 'long_answer') return 'Hard';
  if (type === 'short_answer') return 'Medium';
  return 'Easy';
}

function fromLlmTutorial(t: LlmTutorial): UiTutorial {
  return {
    id: t.id,
    title: t.title,
    dateLabel: t.dateLabel,
    duration: t.duration,
    estimatedTimeLeft: t.estimatedTimeLeft,
    videoTitle: t.videoTitle,
    videoMeta: t.videoMeta,
    questions: t.questions,
    source: 'llm',
    learning: {
      tutorialId: t.id,
      coinsPerCorrect: t.coinsPerCorrect ?? 2,
      completionBonusCoins: t.completionBonusCoins ?? 8,
      watchSessionCoins: t.watchSessionCoins ?? 3,
      flashcards: t.flashcards,
      notes: t.notes,
    },
  };
}

export default function TutorialSessionPage() {
  const params = useParams();
  const courseId = params.id as string;
  const tutorialId = params.tutorialId as string;
  const llmCourse = isLlmDrivenCourse(courseId);

  const [tab, setTab] = useState<Tab>('session');
  const [progress, setProgress] = useState<PracticeProgress>({});
  const [coins, setCoins] = useState<CoinState>({
    fromProblems: 0,
    completionBonusClaimed: false,
    watchClaimed: false,
  });
  const [flashIndex, setFlashIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [progressSaved, setProgressSaved] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [tutorial, setTutorial] = useState<UiTutorial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const topicVideos = useTopicVideos(tutorial?.videoTopic);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('tab') === 'assignment') setTab('assignment');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        if (llmCourse) {
          const pack = await api.get<LlmCoursePack>(`/courses/${courseId}/pack`);
          const found = pack.tutorials.find((t) => t.id === tutorialId);
          if (!found) throw new Error('Tutorial not found in live LLM pack');
          if (!cancelled) setTutorial(fromLlmTutorial(found));
        } else {
          const staticTutorial = getTutorial(courseId, tutorialId);
          const learning =
            getTutorialLearning(tutorialId) || catalogLearningById[tutorialId];
          if (!staticTutorial || !learning) throw new Error('Tutorial not found');
          if (!cancelled) {
            setTutorial({
              id: staticTutorial.id,
              title: staticTutorial.title,
              dateLabel: staticTutorial.dateLabel,
              duration: staticTutorial.duration,
              estimatedTimeLeft: staticTutorial.estimatedTimeLeft,
              videoTitle: staticTutorial.videoTitle,
              videoMeta: staticTutorial.videoMeta,
              recordingUrl: staticTutorial.recordingUrl,
              videoTopic: staticTutorial.videoTopic,
              questions: getQuestionsForTutorial(courseId, staticTutorial.questionIds),
              learning,
              source: 'static',
            });
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load tutorial');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, tutorialId, llmCourse]);

  const questions = tutorial?.questions ?? [];

  useEffect(() => {
    if (!tutorial) return;
    const p = loadProgress(courseId, tutorialId);
    setProgress(p);
    const correctCount = questions.filter((q) => p[q.id]?.correct).length;
    setCoins(
      syncCoinsFromProgress(courseId, tutorialId, correctCount, questions.length, tutorial.learning),
    );
  }, [courseId, tutorialId, tutorial, tab, questions]);

  if (loading) {
    return (
      <DashboardShell mainClassName="p-8">
        <div>{llmCourse ? 'Loading live React curriculum from LLM…' : 'Loading tutorial…'}</div>
      </DashboardShell>
    );
  }

  if (error || !tutorial) {
    return (
      <DashboardShell mainClassName="p-8">
        <div style={{ color: '#f87171' }}>{error || 'Tutorial not found.'}</div>
        <Link href={`/learn/${courseId}`}>Back to course</Link>
      </DashboardShell>
    );
  }

  const attemptedCount = questions.filter((q) => Boolean(progress[q.id])).length;
  const correctCount = questions.filter((q) => progress[q.id]?.correct).length;
  const earned = questions.reduce((sum, q) => sum + (progress[q.id]?.awarded ?? 0), 0);
  const maxMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  const flashcards = tutorial.learning.flashcards;
  const currentFlash = flashcards[flashIndex];
  const coinTotal = totalCoins(coins, tutorial.learning);

  const claimWatch = () => {
    if (coins.watchClaimed) return;
    const next = { ...coins, watchClaimed: true };
    saveCoinState(courseId, tutorialId, next);
    setCoins(next);
  };

  const markTutorialComplete = async () => {
    if (!tutorial) return;
    if (!getToken()) {
      window.location.href = `/sign-in?redirect_url=/learn/${courseId}/tutorials/${tutorialId}`;
      return;
    }
    setSavingProgress(true);
    setProgressError('');
    try {
      const totalCount = Math.max(
        getTutorialsForCourse(courseId).length,
        CATALOG_TOTALS[courseId] || 1,
      );
      await completeLearningItem({
        courseId,
        courseKind: 'catalog',
        title: tutorial.title,
        itemId: tutorialId,
        itemType: 'tutorial',
        itemTitle: tutorial.title,
        itemHref: `/learn/${courseId}/tutorials/${tutorialId}`,
        totalCount,
        score:
          questions.length > 0
            ? Math.round((correctCount / Math.max(questions.length, 1)) * 100)
            : undefined,
      });
      setProgressSaved(true);
    } catch (e) {
      setProgressError(e instanceof Error ? e.message : 'Failed to save progress');
    } finally {
      setSavingProgress(false);
    }
  };

  return (
    <DashboardShell mainClassName="min-h-0 overflow-y-auto p-0">
      <div className={styles.wrap}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <div>
              <Link href={`/learn/${courseId}`} className={styles.back}>
                ← Back to course
              </Link>
              <h1 className={styles.title}>
                {tutorial.title}
                <span className={styles.badge}>{tutorial.source === 'llm' ? 'Live AI' : 'Mandatory'}</span>
              </h1>
              <p className={styles.date}>{tutorial.dateLabel}</p>
            </div>
            <div className={styles.stats}>
              <span className={styles.statPill}>🔥 {tutorial.estimatedTimeLeft}</span>
              <span className={styles.statPill}>🪙 {coinTotal} coins</span>
              <span className={styles.statPill}>
                {correctCount}/{questions.length} Correct
              </span>
              <span className={styles.statPill}>
                Score {earned}/{maxMarks}
              </span>
              <button
                type="button"
                className={styles.statPill}
                style={{
                  cursor: 'pointer',
                  border: '1px solid rgba(52,211,153,0.45)',
                  background: progressSaved ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.12)',
                  color: '#86efac',
                  fontWeight: 700,
                }}
                disabled={savingProgress || progressSaved}
                onClick={() => void markTutorialComplete()}
              >
                {progressSaved ? '✓ Saved to progress' : savingProgress ? 'Saving…' : 'Mark tutorial done'}
              </button>
            </div>
            {progressError ? (
              <p style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{progressError}</p>
            ) : null}
          </div>
        </header>

        <nav className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'session' ? styles.tabActive : ''}`}
            onClick={() => setTab('session')}
          >
            Session
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'assignment' ? styles.tabActive : ''}`}
            onClick={() => setTab('assignment')}
          >
            Assignment {attemptedCount}/{questions.length}
          </button>
        </nav>

        <div className={styles.body}>
          {tab === 'session' ? (
            <>
              <SessionVideoPlayer
                session={{
                  title: tutorial.videoTitle,
                  meta: tutorial.videoMeta,
                  dateLabel: tutorial.videoMeta.includes(tutorial.dateLabel) ? undefined : tutorial.dateLabel,
                }}
                topicVideos={topicVideos}
                fallbackUrl={
                  tutorial.recordingUrl ||
                  `https://www.youtube.com/results?search_query=${encodeURIComponent(tutorial.videoTitle)}`
                }
                onStart={claimWatch}
              />

              <div className={styles.coinRow}>
                <div className={`${styles.coinCard} ${coins.watchClaimed ? '' : styles.coinMuted}`}>
                  <div className={styles.coinIcon}>¢</div>
                  <div>
                    <p className={styles.coinAmount}>
                      {tutorial.learning.watchSessionCoins} Coins {coins.watchClaimed ? '✓' : ''}
                    </p>
                    <p className={styles.coinDesc}>
                      {coins.watchClaimed
                        ? 'Added for watching archived session.'
                        : 'Watch recording to claim these coins.'}
                    </p>
                  </div>
                </div>
                <div className={styles.coinCard}>
                  <div className={styles.coinIcon}>¢</div>
                  <div>
                    <p className={styles.coinAmount}>
                      {coins.fromProblems} / {questions.length * tutorial.learning.coinsPerCorrect} Coins
                    </p>
                    <p className={styles.coinDesc}>
                      +{tutorial.learning.coinsPerCorrect} coin per correct assignment answer.
                    </p>
                  </div>
                </div>
                <div
                  className={`${styles.coinCard} ${
                    coins.completionBonusClaimed ? '' : styles.coinMuted
                  }`}
                >
                  <div className={styles.coinIcon}>¢</div>
                  <div>
                    <p className={styles.coinAmount}>
                      {tutorial.learning.completionBonusCoins} Coins{' '}
                      {coins.completionBonusClaimed ? '✓' : ''}
                    </p>
                    <p className={styles.coinDesc}>
                      {coins.completionBonusClaimed
                        ? 'Bonus unlocked — all assignment problems correct.'
                        : 'Bonus when you solve every assignment problem correctly.'}
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1.1rem' }}>
                <button type="button" className={styles.solveBtn} onClick={() => setTab('assignment')}>
                  Go to Assignments →
                </button>
              </div>

              {currentFlash ? (
                <div className={styles.learnGrid}>
                  <section>
                    <h3 className={styles.sectionTitle}>Revise with Flashcards</h3>
                    <p className={styles.sectionSub}>
                      {tutorial.source === 'llm'
                        ? 'Live LLM flashcards for this React tutorial · tap to flip'
                        : 'System Design concepts for this tutorial · tap card to flip'}
                    </p>
                    <div className={styles.flashProgress}>
                      <div className={styles.flashDots}>
                        {flashcards.map((f, i) => (
                          <span
                            key={f.id}
                            className={`${styles.flashDot} ${
                              i === flashIndex ? styles.flashDotActive : ''
                            }`}
                          />
                        ))}
                      </div>
                      <span className={styles.flashCount}>
                        {flashIndex + 1} / {flashcards.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.flashCard}
                      onClick={() => setFlipped((v) => !v)}
                    >
                      <p className={styles.flashLabel}>{flipped ? 'Answer' : 'Question'}</p>
                      <p className={styles.flashText}>
                        {flipped ? currentFlash.back : currentFlash.front}
                      </p>
                    </button>
                    <div className={styles.flashNav}>
                      <button
                        type="button"
                        className={styles.flashBtn}
                        disabled={flashIndex === 0}
                        onClick={() => {
                          setFlipped(false);
                          setFlashIndex((i) => Math.max(0, i - 1));
                        }}
                      >
                        ← Prev
                      </button>
                      <button
                        type="button"
                        className={styles.flashBtn}
                        onClick={() => setFlipped((v) => !v)}
                      >
                        Flip
                      </button>
                      <button
                        type="button"
                        className={styles.flashBtn}
                        disabled={flashIndex >= flashcards.length - 1}
                        onClick={() => {
                          setFlipped(false);
                          setFlashIndex((i) => Math.min(flashcards.length - 1, i + 1));
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  </section>

                  <aside className={styles.matchCard}>
                    <h3 className={styles.sectionTitle}>Quick concept peek</h3>
                    <p className={styles.sectionSub}>Pairs from this tutorial&apos;s theme</p>
                    <div className={styles.matchGrid}>
                      {flashcards.slice(0, 4).map((f) => (
                        <div key={f.id} className={styles.matchTile}>
                          {f.front}
                        </div>
                      ))}
                    </div>
                  </aside>
                </div>
              ) : null}

              {tutorial.learning.notes ? (
                <div className={styles.notesWrap}>
                  <div className={styles.notesRail}>Revision Notes</div>
                  <div className={styles.notesBody}>
                    <h3 className={styles.notesTitle}>{tutorial.learning.notes.title}</h3>
                    <p className={styles.notesIntro}>{tutorial.learning.notes.introduction}</p>
                    {(notesExpanded
                      ? tutorial.learning.notes.keyConcepts
                      : tutorial.learning.notes.keyConcepts.slice(0, 2)
                    ).map((c) => (
                      <div key={c.heading} className={styles.concept}>
                        <h4>{c.heading}</h4>
                        <p>{c.body}</p>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={styles.solveBtn}
                      style={{ marginTop: '0.5rem' }}
                      onClick={() => setNotesExpanded((v) => !v)}
                    >
                      {notesExpanded ? 'Hide notes' : 'See full notes'}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className={styles.layout}>
              <aside className={styles.qNav} aria-label="Question shortcuts">
                {questions.map((q, idx) => {
                  const done = Boolean(progress[q.id]);
                  return (
                    <Link
                      key={q.id}
                      href={`/learn/${courseId}/tutorials/${tutorialId}/problems/${q.id}`}
                      className={`${styles.qPill} ${done ? styles.qPillSolved : ''}`}
                      title={q.id}
                    >
                      {done ? '✓' : `Q${idx + 1}`}
                    </Link>
                  );
                })}
              </aside>

              <div>
                <div className={styles.coinRow} style={{ marginTop: 0, marginBottom: '0.85rem' }}>
                  <div className={styles.coinCard}>
                    <div className={styles.coinIcon}>¢</div>
                    <div>
                      <p className={styles.coinAmount}>{coinTotal} Coins total</p>
                      <p className={styles.coinDesc}>
                        Earn +{tutorial.learning.coinsPerCorrect} per correct solve
                        {coins.completionBonusClaimed
                          ? ` · +${tutorial.learning.completionBonusCoins} completion bonus claimed`
                          : ` · +${tutorial.learning.completionBonusCoins} when all are correct`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Name of the Problem</th>
                        <th>Type</th>
                        <th>Difficulty</th>
                        <th>Score</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q, idx) => {
                        const result = progress[q.id];
                        const attempted = Boolean(result);
                        return (
                          <tr key={q.id}>
                            <td>
                              <Link
                                className={styles.problemName}
                                href={`/learn/${courseId}/tutorials/${tutorialId}/problems/${q.id}`}
                              >
                                Q{idx + 1}. {q.question.slice(0, 72)}
                                {q.question.length > 72 ? '…' : ''}
                              </Link>
                            </td>
                            <td style={{ textTransform: 'capitalize' }}>{q.type.replace('_', ' ')}</td>
                            <td className={styles.diff}>{difficultyFor(q.type)}</td>
                            <td className={`${styles.score} ${attempted ? styles.scoreDone : ''}`}>
                              {(result?.awarded ?? 0).toFixed(1)}/{q.marks}
                            </td>
                            <td>
                              <span
                                className={`${styles.status} ${
                                  attempted ? styles.statusSolved : styles.statusTodo
                                }`}
                              >
                                {attempted ? (result?.correct ? '✓ Solved' : 'Practiced') : 'Todo'}
                              </span>
                            </td>
                            <td>
                              <Link
                                className={styles.solveBtn}
                                href={`/learn/${courseId}/tutorials/${tutorialId}/problems/${q.id}`}
                              >
                                {attempted ? 'Retry' : 'Solve'}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className={styles.footNote}>
                  Practice mode — complete problems to earn coins. Finish all correctly for the bonus.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
