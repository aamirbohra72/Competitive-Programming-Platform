'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { api } from '@/lib/api';
import {
  getTutorial,
  getQuestionsForTutorial,
  catalogLearningById,
} from '@/data/tutorials/catalog-index';
import { saveQuestionProgress } from '@/data/tutorials/system-design';
import {
  getTutorialLearning,
  syncCoinsFromProgress,
  type TutorialLearningContent,
} from '@/data/tutorials/learning-content';
import { isLlmDrivenCourse, type LlmCoursePack, type LlmQuestion } from '@/types/llm-course';
import styles from '../../../../assignments/assignment.module.css';

function gradeQuestion(
  type: string,
  marks: number,
  answer: string,
  correct?: string,
  expected?: string,
) {
  const trimmed = answer.trim();
  if (!trimmed) return { correct: false, awarded: 0 };

  if (type === 'multiple_choice') {
    const ok = trimmed === (correct ?? '');
    return { correct: ok, awarded: ok ? marks : 0 };
  }

  const expectedText = (expected ?? '').toLowerCase();
  const tokens = expectedText
    .split(/[^a-z0-9+./-]+/i)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 3);
  const unique = [...new Set(tokens)].slice(0, 12);
  if (unique.length === 0) return { correct: false, awarded: 0 };

  const hit = unique.filter((t) => trimmed.toLowerCase().includes(t)).length;
  const ratio = hit / unique.length;
  if (ratio >= 0.55) return { correct: true, awarded: marks };
  if (ratio >= 0.3) return { correct: false, awarded: Math.ceil(marks * 0.5) };
  return { correct: false, awarded: 0 };
}

export default function TutorialProblemPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const tutorialId = params.tutorialId as string;
  const questionId = params.questionId as string;
  const llmCourse = isLlmDrivenCourse(courseId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tutorialTitle, setTutorialTitle] = useState('');
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [question, setQuestion] = useState<LlmQuestion | null>(null);
  const [learning, setLearning] = useState<TutorialLearningContent | null>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<{ correct: boolean; awarded: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        setAnswer('');
        setResult(null);

        if (llmCourse) {
          const pack = await api.get<LlmCoursePack>(`/courses/${courseId}/pack`);
          const t = pack.tutorials.find((x) => x.id === tutorialId);
          const q = t?.questions.find((x) => x.id === questionId);
          if (!t || !q) throw new Error('Problem not found in live LLM pack');
          if (cancelled) return;
          setTutorialTitle(t.title);
          setQuestionIds(t.questions.map((x) => x.id));
          setQuestion(q);
          setLearning({
            tutorialId: t.id,
            coinsPerCorrect: t.coinsPerCorrect ?? 2,
            completionBonusCoins: t.completionBonusCoins ?? 8,
            watchSessionCoins: t.watchSessionCoins ?? 3,
            flashcards: t.flashcards,
            notes: t.notes,
          });
        } else {
          const t = getTutorial(courseId, tutorialId);
          const questions = t ? getQuestionsForTutorial(courseId, t.questionIds) : [];
          const q = questions.find((x) => x.id === questionId);
          const l = getTutorialLearning(tutorialId) || catalogLearningById[tutorialId];
          if (!t || !q || !t.questionIds.includes(questionId) || !l) {
            throw new Error('Problem not found for this tutorial');
          }
          if (cancelled) return;
          setTutorialTitle(t.title);
          setQuestionIds(t.questionIds);
          setQuestion({
            id: q.id,
            type: q.type,
            marks: q.marks,
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            expected_answer: q.expected_answer,
            explanation: q.explanation || '',
          });
          setLearning(l);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load problem');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, tutorialId, questionId, llmCourse]);

  const questionIndex = useMemo(() => questionIds.indexOf(questionId), [questionIds, questionId]);

  if (loading) {
    return (
      <DashboardShell mainClassName="p-8">
        <div>{llmCourse ? 'Loading live React problem…' : 'Loading…'}</div>
      </DashboardShell>
    );
  }

  if (error || !question || !learning) {
    return (
      <DashboardShell mainClassName="p-8">
        <div style={{ color: '#f87171' }}>{error || 'Problem not found for this tutorial.'}</div>
        <Link href={`/learn/${courseId}/tutorials/${tutorialId}?tab=assignment`}>
          Back to assignment list
        </Link>
      </DashboardShell>
    );
  }

  const submit = () => {
    const graded = gradeQuestion(
      question.type,
      question.marks,
      answer,
      question.correct_answer,
      question.expected_answer,
    );
    setResult(graded);
    const nextProgress = saveQuestionProgress(courseId, tutorialId, questionId, {
      awarded: graded.awarded,
      max: question.marks,
      correct: graded.correct,
    });
    const correctCount = questionIds.filter((id) => nextProgress[id]?.correct).length;
    syncCoinsFromProgress(courseId, tutorialId, correctCount, questionIds.length, learning);
  };

  const goNext = () => {
    const nextId = questionIds[questionIndex + 1];
    if (nextId) {
      router.push(`/learn/${courseId}/tutorials/${tutorialId}/problems/${nextId}`);
    } else {
      router.push(`/learn/${courseId}/tutorials/${tutorialId}?tab=assignment`);
    }
  };

  const optionClass = (option: string) => {
    const selected = answer === option;
    if (!result) return selected ? `${styles.option} ${styles.optionSelected}` : styles.option;
    if (option === question.correct_answer) return `${styles.option} ${styles.optionCorrect}`;
    if (selected && !result.correct) return `${styles.option} ${styles.optionWrong}`;
    return selected ? `${styles.option} ${styles.optionSelected}` : styles.option;
  };

  return (
    <DashboardShell mainClassName="min-h-0 overflow-hidden p-0">
      <div className={styles.wrap}>
        <header className={styles.topBar}>
          <div className={styles.titleBlock}>
            <Link
              href={`/learn/${courseId}/tutorials/${tutorialId}?tab=assignment`}
              className={styles.backLink}
            >
              ← Assignment list
            </Link>
            <h1 className={styles.title}>Q{questionIndex + 1}</h1>
            <span className={`${styles.badge} ${styles.badgeMandatory}`}>
              {llmCourse ? 'Live AI' : 'Practice'}
            </span>
          </div>
          <div className={styles.metaRow}>
            <span>{tutorialTitle}</span>
            <span>
              Your score:{' '}
              <strong className={styles.scoreValue}>{result?.awarded ?? 0}</strong> / {question.marks}
            </span>
          </div>
        </header>

        <div className={styles.workspace} style={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)' }}>
          <section className={styles.questionPane}>
            <div className={styles.qHeader}>
              <h2 className={styles.qId}>
                Q{questionIndex + 1} · {question.type.replace('_', ' ')}
              </h2>
              {result ? (
                <span className={result.correct ? styles.statusSolved : styles.statusPending}>
                  {result.correct ? 'Correct' : 'Reviewed'}
                </span>
              ) : (
                <span className={styles.statusPending}>Unsolved</span>
              )}
              <span className={styles.sectionChip}>{question.marks} marks</span>
            </div>
            <p className={styles.questionText}>{question.question}</p>
          </section>

          <section className={styles.answerPane}>
            <div className={styles.answerHeader}>
              <p className={styles.answerPrompt}>
                {question.type === 'multiple_choice'
                  ? 'Choose the correct answer from below:'
                  : 'Write your answer below:'}
              </p>
              <div className={styles.scoreBox}>
                <div>
                  Your Score: <span className={styles.scoreValue}>{result?.awarded ?? 0}</span>
                </div>
                <div>Max Score: {question.marks}</div>
              </div>
            </div>

            {question.type === 'multiple_choice' ? (
              <div className={styles.options}>
                {(question.options ?? []).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={optionClass(option)}
                    disabled={Boolean(result)}
                    onClick={() => setAnswer(option)}
                  >
                    <input className={styles.radio} type="radio" checked={answer === option} readOnly />
                    <span className={styles.optionText}>{option}</span>
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                className={styles.textarea}
                value={answer}
                disabled={Boolean(result)}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your practice answer..."
              />
            )}

            <p className={styles.hint}>
              Practice mode — submit anytime. Score is shown immediately after each problem.
            </p>

            {result ? (
              <div className={styles.feedback}>
                <p className={styles.feedbackTitle}>
                  {result.correct
                    ? `Score: ${result.awarded}/${question.marks} ✓`
                    : `Score: ${result.awarded}/${question.marks}`}
                </p>
                {question.explanation}
              </div>
            ) : null}

            <div className={styles.footer}>
              <button
                type="button"
                className={styles.btn}
                onClick={() =>
                  router.push(`/learn/${courseId}/tutorials/${tutorialId}?tab=assignment`)
                }
              >
                Back to list
              </button>
              {!result ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={!answer.trim()}
                  onClick={submit}
                >
                  Submit & See Score
                </button>
              ) : (
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={goNext}>
                  {questionIndex < questionIds.length - 1 ? 'Next Problem' : 'Finish'}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
