'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { DashboardShell } from '@/components/DashboardShell';
import { CodeEditor } from '@/components/CodeEditor';
import { ReactComponentPreview } from '@/components/ReactComponentPreview';
import { ensureApiSession } from '@/components/ClerkApiBridge';
import {
  clearPracticeDraft,
  loadPracticeDraft,
  savePracticeDraft,
} from '@/lib/practiceDraft';
import type { Challenge, Submission, SubmissionResultCase } from '@codeforces/types';

type JudgeResult = {
  status: string;
  score: number;
  feedback: string;
  passed: number;
  total: number;
  cases?: SubmissionResultCase[];
};

function parseResult(json: string | null | undefined): JudgeResult | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as JudgeResult;
  } catch {
    return null;
  }
}

export default function PracticeProblemPage() {
  const params = useParams();
  const router = useRouter();
  const problemId = params.id as string;
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [language, setLanguage] = useState('javascript');
  const [sourceCode, setSourceCode] = useState('');
  const [activeTab, setActiveTab] = useState<'problem' | 'solution' | 'submissions'>('problem');
  const [error, setError] = useState('');
  const [verdict, setVerdict] = useState<JudgeResult | null>(null);
  const [verdictSource, setVerdictSource] = useState<'run' | 'submit' | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [panelMessage, setPanelMessage] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'results' | 'preview'>('results');
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsError, setSubsError] = useState('');
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [acceptedSolution, setAcceptedSolution] = useState<{
    language: string;
    sourceCode: string;
    score: number;
    firstAcceptedAt: string;
    updatedAt: string;
    submissionId: string;
  } | null>(null);
  const [acceptedLoading, setAcceptedLoading] = useState(false);
  const [acceptedError, setAcceptedError] = useState('');

  const isReactComponent = challenge?.judgeMode === 'REACT_COMPONENT';

  const allowedLanguages = useMemo(
    () => (challenge?.allowedLanguages?.length ? challenge.allowedLanguages : ['javascript']),
    [challenge],
  );

  const fetchChallenge = useCallback(async () => {
    try {
      const data = await api.get<Challenge>(`/challenges/${problemId}`);
      setChallenge(data);
      const langs = data.allowedLanguages?.length ? data.allowedLanguages : ['javascript'];
      const starter = data.starterCode || '';
      setBottomTab(data.judgeMode === 'REACT_COMPONENT' ? 'preview' : 'results');

      // Restore editor after refresh: accepted → latest submit → local draft → starter
      let restoredLang = langs[0];
      let restoredCode = starter;

      await ensureApiSession(2500);
      if (isAuthenticated()) {
        try {
          const accepted = await api.get<{
            solved: boolean;
            solution: {
              language: string;
              sourceCode: string;
              submissionId: string;
              score: number;
              firstAcceptedAt: string;
              updatedAt: string;
            };
          }>(`/submissions/accepted/${encodeURIComponent(problemId)}`);
          if (accepted?.solution?.sourceCode) {
            restoredLang = accepted.solution.language || restoredLang;
            restoredCode = accepted.solution.sourceCode;
            setAcceptedSolution(accepted.solution);
            setLanguage(restoredLang);
            setSourceCode(restoredCode);
            savePracticeDraft(problemId, {
              language: restoredLang,
              sourceCode: restoredCode,
              submissionId: accepted.solution.submissionId,
            });
            return;
          }
        } catch {
          /* not solved yet — try last submission */
        }

        try {
          const response = await api.get<{ data: Submission[] }>(
            `/submissions?challengeId=${encodeURIComponent(problemId)}&pageSize=1`,
          );
          const latest = response.data?.[0];
          if (latest?.sourceCode) {
            restoredLang = latest.language || restoredLang;
            restoredCode = latest.sourceCode;
            setLanguage(restoredLang);
            setSourceCode(restoredCode);
            savePracticeDraft(problemId, {
              language: restoredLang,
              sourceCode: restoredCode,
              submissionId: latest.id,
            });
            return;
          }
        } catch {
          /* fall through to draft */
        }
      }

      const draft = loadPracticeDraft(problemId);
      if (draft?.sourceCode) {
        restoredLang = draft.language || restoredLang;
        restoredCode = draft.sourceCode;
      }

      setLanguage(restoredLang);
      setSourceCode(restoredCode);
    } catch (err) {
      console.error('Failed to fetch challenge:', err);
      setError('Failed to load challenge');
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    if (problemId) void fetchChallenge();
  }, [problemId, fetchChallenge]);

  // Autosave editor so a refresh never loses in-progress or submitted code
  useEffect(() => {
    if (!problemId || !sourceCode.trim() || loading) return;
    const timer = window.setTimeout(() => {
      savePracticeDraft(problemId, { language, sourceCode });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [problemId, language, sourceCode, loading]);

  const fetchMySubmissions = useCallback(async () => {
    if (!problemId) return;
    setSubsLoading(true);
    setSubsError('');
    try {
      await ensureApiSession(2500);
      if (!isAuthenticated()) {
        setSubsError('Sign in to see your submissions for this problem.');
        setMySubmissions([]);
        return;
      }
      const response = await api.get<{ data: Submission[] }>(
        `/submissions?challengeId=${encodeURIComponent(problemId)}&pageSize=50`,
      );
      setMySubmissions(response.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load submissions';
      setSubsError(msg);
      setMySubmissions([]);
    } finally {
      setSubsLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    if (activeTab === 'submissions') {
      void fetchMySubmissions();
    }
  }, [activeTab, fetchMySubmissions]);

  const fetchAcceptedSolution = useCallback(async () => {
    if (!problemId) return;
    setAcceptedLoading(true);
    setAcceptedError('');
    try {
      await ensureApiSession(2500);
      if (!isAuthenticated()) {
        setAcceptedSolution(null);
        setAcceptedError('Sign in and get an Accepted verdict to unlock your saved solution.');
        return;
      }
      const data = await api.get<{
        solved: boolean;
        solution: {
          language: string;
          sourceCode: string;
          score: number;
          firstAcceptedAt: string;
          updatedAt: string;
          submissionId: string;
        };
      }>(`/submissions/accepted/${encodeURIComponent(problemId)}`);
      setAcceptedSolution(data.solution);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Not solved yet';
      setAcceptedSolution(null);
      if (/not solved|404|No accepted/i.test(msg)) {
        setAcceptedError('');
      } else {
        setAcceptedError(msg);
      }
    } finally {
      setAcceptedLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    if (activeTab === 'solution') {
      void fetchAcceptedSolution();
    }
  }, [activeTab, fetchAcceptedSolution]);

  const pollSubmission = async (submissionId: string) => {
    for (let i = 0; i < 60; i += 1) {
      const submission = await api.get<Submission>(`/submissions/${submissionId}`);
      if (submission.status !== 'PENDING') {
        return submission;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Timed out waiting for judge result');
  };

  const handleRun = async () => {
    if (!sourceCode.trim()) {
      setError('Please write some code first');
      return;
    }
    if (!isAuthenticated()) {
      const ok = await ensureApiSession();
      if (!ok) {
        router.push('/sign-in');
        return;
      }
    } else {
      await ensureApiSession(2500);
    }
    if (!challenge?.judgeReady) {
      setError('Judging is not ready for this challenge yet.');
      return;
    }

    setRunning(true);
    setError('');
    setPanelMessage('Running sample tests…');
    setVerdict(null);
    setHintText(null);

    try {
      const response = await api.post<{
        success: boolean;
        status: string;
        score: number;
        output: string;
        error: string | null;
        result: JudgeResult;
        hintText?: string | null;
      }>('/execute/execute', {
        code: sourceCode,
        language,
        challengeId: problemId,
        timeout: 5000,
      });

      setVerdict(response.result);
      setVerdictSource('run');
      setHintText(response.hintText ?? null);
      setPanelMessage(response.output || (response.success ? 'Sample tests passed' : 'Sample tests failed'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      if (/judge unavailable|docker/i.test(msg)) {
        setError('Judge unavailable: start Docker Desktop and build image codeforces-judge:1');
      } else {
        setError(msg);
      }
      setPanelMessage(msg);
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setPanelMessage(null);
    setVerdict(null);
    setHintText(null);

    if (!isAuthenticated()) {
      const ok = await ensureApiSession();
      if (!ok) {
        router.push('/sign-in');
        return;
      }
    } else {
      await ensureApiSession(2500);
    }
    if (!sourceCode.trim()) {
      setError('Source code is required');
      return;
    }
    if (!challenge?.judgeReady) {
      setError('Judging is not ready for this challenge yet.');
      return;
    }

    setSubmitting(true);
    setPanelMessage('Submitting…');
    try {
      const created = await api.post<Submission>(`/submissions`, {
        challengeId: problemId,
        language,
        sourceCode,
      });

      setPanelMessage('Judging against all test cases…');
      const finalSubmission = await pollSubmission(created.id);
      const result = parseResult(finalSubmission.resultJson);
      setVerdict(
        result ?? {
          status: finalSubmission.status,
          score: finalSubmission.score ?? 0,
          feedback: finalSubmission.aiResponse || finalSubmission.status,
          passed: 0,
          total: 0,
        },
      );
      setVerdictSource('submit');
      setHintText(finalSubmission.hintText ?? null);
      setPanelMessage(finalSubmission.aiResponse || finalSubmission.status);
      setBottomTab('results');
      setActiveTab('submissions');
      savePracticeDraft(problemId, {
        language,
        sourceCode,
        submissionId: finalSubmission.id,
      });
      void fetchMySubmissions();
      if (finalSubmission.status === 'ACCEPTED') {
        void fetchAcceptedSolution();
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Submission failed';
      setError(errorMessage);
      setPanelMessage(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell mainClassName="p-8">
        <div className="text-center">Loading...</div>
      </DashboardShell>
    );
  }

  if (!challenge) {
    return (
      <DashboardShell mainClassName="p-8">
        <div>{error || 'Challenge not found'}</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell mainClassName="flex h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)] flex-col overflow-hidden p-0">
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div
          className="problem-statement-scroll"
          style={{
            width: '40%',
            height: '100%',
            overflowY: 'scroll',
            background: '#ffffff',
            color: '#111827',
            borderRight: '1px solid #e5e7eb',
            padding: '1.5rem',
          }}
        >
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#111827' }}>
              {challenge.title}
            </h1>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background:
                    challenge.difficulty.toLowerCase() === 'easy'
                      ? '#22c55e'
                      : challenge.difficulty.toLowerCase() === 'medium'
                        ? '#f59e0b'
                        : '#ef4444',
                  color: 'white',
                }}
              >
                {challenge.difficulty}
              </span>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                {challenge.practiceLanguage || 'Algorithm'}
              </span>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                Mode: {challenge.judgeMode || 'STDIN'}
              </span>
              {!challenge.judgeReady && (
                <span style={{ color: '#b45309', fontSize: '0.875rem' }}>Judge setup pending</span>
              )}
              {challenge.testCaseSummary && (
                <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  Tests: {challenge.testCaseSummary.totalCount} ({challenge.testCaseSummary.hiddenCount}{' '}
                  hidden)
                </span>
              )}
            </div>
            {challenge.contest?.kind && challenge.contest.kind !== 'PRACTICE' ? (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 8,
                  background:
                    challenge.contest.status === 'ENDED'
                      ? '#ecfdf5'
                      : challenge.contest.status === 'LIVE'
                        ? '#eff6ff'
                        : '#fffbeb',
                  color:
                    challenge.contest.status === 'ENDED'
                      ? '#065f46'
                      : challenge.contest.status === 'LIVE'
                        ? '#1e40af'
                        : '#92400e',
                  fontSize: '0.875rem',
                }}
              >
                {challenge.contest.status === 'ENDED' ? (
                  <>
                    Practice mode for ended contest{' '}
                    <Link href={`/contests/${challenge.contest.id}`} style={{ fontWeight: 600 }}>
                      {challenge.contest.name}
                    </Link>
                    . Submits no longer affect the leaderboard.
                  </>
                ) : challenge.contest.status === 'LIVE' ? (
                  <>
                    Live contest:{' '}
                    <Link href={`/contests/${challenge.contest.id}`} style={{ fontWeight: 600 }}>
                      {challenge.contest.name}
                    </Link>
                    . Register on the contest page before submitting if you have not already.
                  </>
                ) : (
                  <>
                    This problem belongs to an upcoming contest. Statements unlock at start —{' '}
                    <Link href={`/contests/${challenge.contest.id}`} style={{ fontWeight: 600 }}>
                      view contest
                    </Link>
                    .
                  </>
                )}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            {(['problem', 'solution', 'submissions'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === tab ? '2px solid #0070f3' : '2px solid transparent',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  color: activeTab === tab ? '#0070f3' : '#6b7280',
                  fontWeight: activeTab === tab ? 600 : 400,
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'problem' && (
            <div>
              <div style={{ marginBottom: '1.5rem', lineHeight: 1.6 }}>
                <p style={{ whiteSpace: 'pre-wrap', color: '#374151' }}>{challenge.description}</p>
              </div>

              {[
                ['Input Format', challenge.inputFormat],
                ['Output Format', challenge.outputFormat],
                ['Constraints', challenge.constraints],
              ].map(([label, value]) => (
                <div key={label} style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', fontWeight: 600, color: '#111827' }}>
                    {label}
                  </h3>
                  <pre
                    style={{
                      background: '#f9fafb',
                      color: '#1f2937',
                      padding: '1rem',
                      borderRadius: 6,
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      border: '1px solid #e5e7eb',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {value}
                  </pre>
                </div>
              ))}

              {challenge.sampleInput !== undefined && challenge.sampleInput !== null && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', fontWeight: 600, color: '#111827' }}>
                    Sample Input
                  </h3>
                  <pre
                    style={{
                      background: '#f9fafb',
                      color: '#1f2937',
                      padding: '1rem',
                      borderRadius: 6,
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      border: '1px solid #e5e7eb',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {challenge.sampleInput || '(empty)'}
                  </pre>
                </div>
              )}

              {challenge.sampleOutput && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', fontWeight: 600, color: '#111827' }}>
                    Sample Output
                  </h3>
                  <pre
                    style={{
                      background: '#f9fafb',
                      color: '#1f2937',
                      padding: '1rem',
                      borderRadius: 6,
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      border: '1px solid #e5e7eb',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {challenge.sampleOutput}
                  </pre>
                </div>
              )}

              {challenge.sampleTestCases && challenge.sampleTestCases.length > 1 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', fontWeight: 600, color: '#111827' }}>
                    Sample Cases
                  </h3>
                  {challenge.sampleTestCases.map((tc) => (
                    <div key={tc.id} style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>{tc.name}</div>
                      <pre
                        style={{
                          background: '#f9fafb',
                          color: '#1f2937',
                          padding: '0.75rem',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          border: '1px solid #e5e7eb',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {`Input:\n${tc.input || '(empty)'}\n\nOutput:\n${tc.expectedOutput}`}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'solution' && (
            <div>
              {acceptedLoading && (
                <div style={{ color: '#6b7280', padding: '1rem 0' }}>Loading your accepted solution…</div>
              )}
              {acceptedError && (
                <div style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                  {acceptedError}
                </div>
              )}
              {!acceptedLoading && !acceptedSolution && !acceptedError && (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: '2rem 0.5rem' }}>
                  <p style={{ marginBottom: 8 }}>Your accepted solution unlocks here.</p>
                  <p style={{ fontSize: '0.85rem' }}>
                    Click <strong>Submit</strong> and get an <strong>Accepted</strong> verdict. The
                    winning code is saved automatically so you can reopen it anytime.
                  </p>
                </div>
              )}
              {acceptedSolution && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', color: '#374151' }}>
                      <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>
                        Accepted · score {acceptedSolution.score}
                      </div>
                      <div>
                        {acceptedSolution.language} · first AC{' '}
                        {new Date(acceptedSolution.firstAcceptedAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLanguage(acceptedSolution.language);
                        setSourceCode(acceptedSolution.sourceCode);
                      }}
                      style={{
                        padding: '0.45rem 0.9rem',
                        border: 'none',
                        borderRadius: 6,
                        background: '#0070f3',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      Load into editor
                    </button>
                  </div>
                  <pre
                    style={{
                      background: '#0b1020',
                      color: '#e5e7eb',
                      padding: '1rem',
                      borderRadius: 8,
                      fontSize: '0.8rem',
                      overflow: 'auto',
                      maxHeight: '55vh',
                      border: '1px solid #1f2937',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {acceptedSolution.sourceCode}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'submissions' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#111827' }}>Your submissions</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => void fetchMySubmissions()}
                    style={{
                      padding: '0.35rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/submissions?challengeId=${problemId}`)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      border: 'none',
                      borderRadius: 6,
                      background: '#0070f3',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    Full history
                  </button>
                </div>
              </div>

              {subsLoading && <div style={{ color: '#6b7280' }}>Loading submissions…</div>}
              {subsError && (
                <div style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                  {subsError}
                </div>
              )}
              {!subsLoading && !subsError && mySubmissions.length === 0 && (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                  No submissions yet for this problem.
                  <div style={{ marginTop: 8, fontSize: '0.85rem' }}>
                    Click <strong>Submit</strong> (not only Run samples) to create one.
                  </div>
                </div>
              )}
              {!subsLoading &&
                mySubmissions.map((s) => {
                  const expanded = expandedSubId === s.id;
                  const result = parseResult(s.resultJson);
                  const statusColor =
                    s.status === 'ACCEPTED'
                      ? '#16a34a'
                      : s.status === 'PENDING'
                        ? '#d97706'
                        : '#dc2626';
                  return (
                    <div
                      key={s.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: '0.75rem',
                        marginBottom: '0.75rem',
                        background: '#f9fafb',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{ fontSize: '0.85rem', color: '#374151' }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            {new Date(s.submittedAt).toLocaleString()}
                          </div>
                          <div>
                            {s.language} · score {s.score ?? 0}
                            {result && typeof result.passed === 'number' && typeof result.total === 'number'
                              ? ` · ${result.passed}/${result.total} cases`
                              : ''}
                          </div>
                        </div>
                        <span
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: 999,
                            background: statusColor,
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {s.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedSubId(expanded ? null : s.id)}
                        style={{
                          marginTop: 8,
                          border: 'none',
                          background: 'none',
                          color: '#0070f3',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '0.8rem',
                        }}
                      >
                        {expanded ? 'Hide details' : 'Show details'}
                      </button>
                      {expanded && (
                        <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#4b5563' }}>
                          <pre
                            style={{
                              whiteSpace: 'pre-wrap',
                              background: '#fff',
                              border: '1px solid #e5e7eb',
                              borderRadius: 6,
                              padding: '0.6rem',
                              margin: 0,
                            }}
                          >
                            {s.aiResponse || result?.feedback || 'No feedback yet'}
                          </pre>
                          {s.hintText && (
                            <p style={{ marginTop: 8, color: '#b45309' }}>
                              <strong>Hint:</strong> {s.hintText}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              background: '#252526',
              borderBottom: '1px solid #3e3e42',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                padding: '0.5rem',
                background: '#3c3c3c',
                color: 'white',
                border: '1px solid #555',
                borderRadius: 4,
              }}
            >
              {allowedLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  clearPracticeDraft(problemId);
                  setSourceCode(challenge.starterCode || '');
                  const langs = challenge.allowedLanguages?.length
                    ? challenge.allowedLanguages
                    : ['javascript'];
                  setLanguage(langs[0]);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3c3c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Reset
              </button>
              <button
                onClick={() => void handleRun()}
                disabled={running || submitting}
                style={{
                  padding: '0.5rem 1rem',
                  background: running ? '#555' : '#0e639c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: running ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {running ? 'Running…' : 'Run samples'}
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting || running}
                style={{
                  padding: '0.5rem 1rem',
                  background: submitting ? '#555' : '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {submitting ? 'Judging…' : 'Submit'}
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            <CodeEditor language={language} value={sourceCode} onChange={setSourceCode} height="100%" />
          </div>

          <div
            style={{
              minHeight: 240,
              maxHeight: 360,
              background: '#1e1e1e',
              borderTop: '1px solid #3e3e42',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 0,
                borderBottom: '1px solid #3e3e42',
                background: '#252526',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setBottomTab('results')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderBottom: bottomTab === 'results' ? '2px solid #3794ff' : '2px solid transparent',
                  background: 'transparent',
                  color: bottomTab === 'results' ? '#fff' : '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: bottomTab === 'results' ? 600 : 400,
                }}
              >
                Results
              </button>
              {isReactComponent && (
                <button
                  type="button"
                  onClick={() => setBottomTab('preview')}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderBottom: bottomTab === 'preview' ? '2px solid #3794ff' : '2px solid transparent',
                    background: 'transparent',
                    color: bottomTab === 'preview' ? '#fff' : '#9ca3af',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: bottomTab === 'preview' ? 600 : 400,
                  }}
                >
                  UI Preview
                </button>
              )}
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                padding: '0.75rem 1rem',
                overflow: 'auto',
                color: '#cccccc',
                fontSize: '0.875rem',
                fontFamily: bottomTab === 'results' ? 'monospace' : 'inherit',
              }}
            >
              {bottomTab === 'preview' && isReactComponent ? (
                <ReactComponentPreview
                  sourceCode={sourceCode}
                  sampleInput={challenge.sampleInput}
                  sampleTestCases={challenge.sampleTestCases}
                />
              ) : (
                <>
                  {error && <div style={{ color: '#f48771', marginBottom: 8 }}>Error: {error}</div>}
                  {panelMessage && <div style={{ marginBottom: 8 }}>{panelMessage}</div>}
                  {verdict && (
                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          color: verdict.status === 'ACCEPTED' ? '#4ec9b0' : '#f48771',
                          fontWeight: 700,
                          marginBottom: 4,
                        }}
                      >
                        {verdictSource === 'run' ? 'SAMPLE RUN: ' : ''}
                        {verdict.status} — score {verdict.score}/100 ({verdict.passed}/{verdict.total}{' '}
                        passed)
                      </div>
                      {verdictSource === 'run' && (
                        <div style={{ color: '#d7ba7d', marginBottom: 6 }}>
                          Sample run only — this is not recorded in your submissions. Click Submit to run
                          all test cases and save the result.
                        </div>
                      )}
                      {verdictSource === 'submit' && (
                        <div style={{ marginBottom: 6 }}>
                          <a
                            href={`/submissions?challengeId=${problemId}`}
                            style={{ color: '#3794ff', textDecoration: 'underline' }}
                          >
                            View this submission in your history →
                          </a>
                        </div>
                      )}
                      <div style={{ whiteSpace: 'pre-wrap' }}>{verdict.feedback}</div>
                      {verdict.cases && verdict.cases.length > 0 && (
                        <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                          {verdict.cases.map((c) => (
                            <li key={`${c.order}-${c.name}`} style={{ marginBottom: 4 }}>
                              <span style={{ color: c.passed ? '#4ec9b0' : '#f48771' }}>
                                {c.passed ? 'PASS' : 'FAIL'}
                              </span>{' '}
                              {c.name}
                              {!c.passed && c.message ? ` — ${c.message}` : ''}
                              {!c.passed && !c.isHidden && c.expected != null ? (
                                <div style={{ opacity: 0.85 }}>
                                  expected: {c.expected}
                                  {c.actual != null ? `\nactual: ${c.actual}` : ''}
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {hintText && (
                    <div
                      style={{
                        marginTop: 8,
                        borderLeft: '3px solid #f59e0b',
                        paddingLeft: 10,
                        color: '#fbbf24',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      Hint: {hintText}
                    </div>
                  )}
                  {!panelMessage && !verdict && !error && (
                    <div style={{ color: '#6b7280' }}>
                      {isReactComponent
                        ? 'Open the UI Preview tab to see your component, or Run samples / Submit for judge results.'
                        : 'Run sample tests or submit to see results here.'}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
