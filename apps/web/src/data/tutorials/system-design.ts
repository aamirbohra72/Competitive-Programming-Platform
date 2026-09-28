import type { AssignmentQuestion } from '@/types/assignment';
import { hldEdtechAssignment } from '@/data/assignments/hld-edtech';
import { flattenAssignmentQuestions } from '@/types/assignment';

export interface CourseTutorial {
  id: string;
  courseId: string;
  title: string;
  dateLabel: string;
  duration: string;
  estimatedTimeLeft: string;
  videoTitle: string;
  videoMeta: string;
  recordingUrl?: string;
  /** Pull session videos from a curated YouTube track by title keywords (primary first). */
  videoTopic?: { track: string; keywords: string[] };
  /** Question ids from the course assignment bank */
  questionIds: string[];
}

const allHldQuestions = flattenAssignmentQuestions(hldEdtechAssignment);

/** Lookup question by id from HLD bank */
export function getHldQuestion(questionId: string): AssignmentQuestion | undefined {
  return allHldQuestions.find((q) => q.id === questionId);
}

export function getHldQuestionsByIds(ids: string[]): AssignmentQuestion[] {
  return ids
    .map((id) => getHldQuestion(id))
    .filter((q): q is AssignmentQuestion => Boolean(q));
}

/**
 * System Design tutorials — each gets 8 practice questions from the HLD bank.
 * Q1–Q8, Q9–Q16, Q17–Q24.
 */
export const systemDesignTutorials: CourseTutorial[] = [
  {
    id: 'sd-t1',
    courseId: '5',
    title: 'Day 1 — Requirements & Capacity Estimation',
    dateLabel: 'Sun, 12 Jul 2026',
    duration: '2h 00m',
    estimatedTimeLeft: '3 hours left',
    videoTitle: 'Case Study Kickoff: Requirements, DAU, Storage & Throughput',
    videoMeta: '7:00 PM · Recording available',
    questionIds: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'],
  },
  {
    id: 'sd-t2',
    courseId: '5',
    title: 'Day 2 — Architecture, Storage & Caching',
    dateLabel: 'Mon, 13 Jul 2026',
    duration: '2h 45m',
    estimatedTimeLeft: '4 hours left',
    videoTitle: 'BFF, CDN, Polyglot Persistence & Cache Strategies',
    videoMeta: '7:00 PM · Recording available',
    questionIds: ['Q9', 'Q10', 'Q11', 'Q12', 'Q13', 'Q14', 'Q15', 'Q16'],
  },
  {
    id: 'sd-t3',
    courseId: '5',
    title: 'Day 3 — Scale, Queues & Reliability',
    dateLabel: 'Tue, 14 Jul 2026',
    duration: '3h 00m',
    estimatedTimeLeft: '5 hours left',
    videoTitle: 'Kafka, Hot Keys, SAGA, Circuit Breaker & Live Class Design',
    videoMeta: '7:00 PM · Recording available',
    questionIds: ['Q17', 'Q18', 'Q19', 'Q20', 'Q21', 'Q22', 'Q23', 'Q24'],
  },
];

export function getTutorialsForCourse(courseId: string): CourseTutorial[] {
  if (courseId === '5') return systemDesignTutorials;
  return [];
}

export function getTutorial(courseId: string, tutorialId: string): CourseTutorial | undefined {
  return getTutorialsForCourse(courseId).find((t) => t.id === tutorialId);
}

export type PracticeProgress = Record<
  string,
  { awarded: number; max: number; correct: boolean; answeredAt: string }
>;

export function progressKey(courseId: string, tutorialId: string) {
  return `practice:${courseId}:${tutorialId}`;
}

export function loadProgress(courseId: string, tutorialId: string): PracticeProgress {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(progressKey(courseId, tutorialId));
    return raw ? (JSON.parse(raw) as PracticeProgress) : {};
  } catch {
    return {};
  }
}

export function saveQuestionProgress(
  courseId: string,
  tutorialId: string,
  questionId: string,
  data: { awarded: number; max: number; correct: boolean },
) {
  const prev = loadProgress(courseId, tutorialId);
  const next: PracticeProgress = {
    ...prev,
    [questionId]: { ...data, answeredAt: new Date().toISOString() },
  };
  localStorage.setItem(progressKey(courseId, tutorialId), JSON.stringify(next));
  return next;
}
