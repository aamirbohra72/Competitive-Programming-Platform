/**
 * Persist practice editor drafts so refresh does not wipe submitted/in-progress code.
 * Server AcceptedSolution / last submission remain the source of truth when signed in.
 */

const draftKey = (challengeId: string) => `practice:draft:${challengeId}`;

export type PracticeDraft = {
  language: string;
  sourceCode: string;
  updatedAt: number;
  /** Last known submission id that produced this draft (optional) */
  submissionId?: string;
};

export function loadPracticeDraft(challengeId: string): PracticeDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(draftKey(challengeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PracticeDraft;
    if (!parsed?.sourceCode || typeof parsed.sourceCode !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePracticeDraft(
  challengeId: string,
  draft: Omit<PracticeDraft, 'updatedAt'> & { updatedAt?: number },
): void {
  if (typeof window === 'undefined') return;
  if (!draft.sourceCode.trim()) return;
  const payload: PracticeDraft = {
    language: draft.language,
    sourceCode: draft.sourceCode,
    submissionId: draft.submissionId,
    updatedAt: draft.updatedAt ?? Date.now(),
  };
  localStorage.setItem(draftKey(challengeId), JSON.stringify(payload));
}

export function clearPracticeDraft(challengeId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(draftKey(challengeId));
}
