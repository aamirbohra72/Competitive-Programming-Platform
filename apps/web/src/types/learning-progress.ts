export type LearningStreak = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
};

export type CourseLearningItem = {
  id: string;
  itemId: string;
  itemType: string;
  title: string | null;
  completed: boolean;
  score: number | null;
  completedAt: string | null;
};

export type CourseLearningProgress = {
  id: string;
  courseId: string;
  courseKind: string;
  title: string | null;
  completedCount: number;
  totalCount: number;
  percent: number;
  completed: boolean;
  lastItemId: string | null;
  lastItemTitle: string | null;
  lastItemHref: string | null;
  lastActivityAt: string;
  items?: CourseLearningItem[];
};

export type ContinueLearning = {
  courseId: string;
  title: string | null;
  percent: number;
  lastItemId: string | null;
  lastItemTitle: string | null;
  lastItemHref: string | null;
  completed: boolean;
};

export type LearningSummary = {
  courses: CourseLearningProgress[];
  streak: LearningStreak;
  enrollments: Array<{ productId: string; createdAt: string }>;
  continueLearning: ContinueLearning | null;
};

export type CompleteItemPayload = {
  courseId: string;
  courseKind?: 'catalog' | 'generated';
  title?: string;
  itemId: string;
  itemType: 'tutorial' | 'module' | 'topic' | 'assignment';
  itemTitle?: string;
  itemHref?: string;
  score?: number;
  totalCount?: number;
};

/** Default totals for known catalog courses (modules / tutorials). */
export const CATALOG_TOTALS: Record<string, number> = {
  '1': 6, // DSA tutorials
  '2': 6, // Node.js tutorials
  '3': 6, // React tutorials
  '4': 4, // JS fundamentals
  '5': 3, // System Design tutorials
  '6': 4, // Python beginners
  'fde-bootcamp': 88,
};

export function syncStreakToLocal(streak: LearningStreak) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('streak', String(streak.currentStreak || 0));
  window.dispatchEvent(new CustomEvent('auth-changed'));
  window.dispatchEvent(
    new CustomEvent('learning-progress:updated', { detail: { streak } }),
  );
}
