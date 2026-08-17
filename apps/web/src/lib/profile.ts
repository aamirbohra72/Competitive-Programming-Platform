import type { PracticeBucket } from '@/lib/leaderboard-overview';

export type PublicProfileResponse = {
  year: number;
  user: {
    userId: string;
    username: string;
    rank: number | null;
    uniqueSolved: number;
    acceptedSubmissions: number;
    scoreSum: number;
    practiceByDifficulty: {
      total: PracticeBucket;
      easy: PracticeBucket;
      medium: PracticeBucket;
      hard: PracticeBucket;
    };
    contributions: {
      year: number;
      totalSubmissions: number;
      days: { date: string; count: number }[];
    };
    streak: { current: number; longest: number };
  };
  courseWatchTime: { course: string; hours: number }[];
};
