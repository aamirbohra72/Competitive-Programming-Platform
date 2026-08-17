import { Response } from 'express';
import { prisma } from '@codeforces/db';
import { AuthRequest } from '../middleware/auth';
import { getLeaderboard, getUserRank } from '../services/redisService';
import {
  getGlobalLeaderboard,
  getUserAggregateStats,
  getUserOverview,
} from '../services/leaderboardOverviewService';

export const leaderboardController = {
  /** Public practice profile by username (streak, contributions, difficulty stats). */
  async getProfileByUsername(req: AuthRequest, res: Response): Promise<void> {
    const username = String(req.params.username || '').trim();
    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const yearRaw = req.query.year;
    const year =
      typeof yearRaw === 'string' && /^\d{4}$/.test(yearRaw)
        ? parseInt(yearRaw, 10)
        : new Date().getFullYear();

    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true, username: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const globalLeaderboard = await getGlobalLeaderboard(100);
    const myRow = globalLeaderboard.find((r) => r.userId === user.id);
    const personal = await getUserOverview(user.id, year);
    const agg = myRow
      ? {
          uniqueSolved: myRow.uniqueSolved,
          acceptedSubmissions: myRow.acceptedSubmissions,
          scoreSum: myRow.scoreSum,
        }
      : await getUserAggregateStats(user.id);

    res.json({
      year,
      user: {
        userId: user.id,
        username: user.username,
        rank: myRow?.rank ?? null,
        uniqueSolved: agg.uniqueSolved,
        acceptedSubmissions: agg.acceptedSubmissions,
        scoreSum: agg.scoreSum,
        ...personal,
      },
      courseWatchTime: [] as { course: string; hours: number }[],
    });
  },

  async getOverview(req: AuthRequest, res: Response): Promise<void> {
    const yearRaw = req.query.year;
    const year =
      typeof yearRaw === 'string' && /^\d{4}$/.test(yearRaw)
        ? parseInt(yearRaw, 10)
        : new Date().getFullYear();

    const globalLeaderboard = await getGlobalLeaderboard(100);

    if (!req.user?.userId) {
      res.json({
        year,
        globalLeaderboard,
        me: null,
        courseWatchTime: [] as { course: string; hours: number }[],
      });
      return;
    }

    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });

    const personal = await getUserOverview(userId, year);
    const myRow = globalLeaderboard.find((r) => r.userId === userId);
    const agg = myRow
      ? {
          uniqueSolved: myRow.uniqueSolved,
          acceptedSubmissions: myRow.acceptedSubmissions,
          scoreSum: myRow.scoreSum,
        }
      : await getUserAggregateStats(userId);

    res.json({
      year,
      globalLeaderboard,
      me: {
        userId,
        username: user?.username ?? 'You',
        rank: myRow?.rank ?? null,
        uniqueSolved: agg.uniqueSolved,
        acceptedSubmissions: agg.acceptedSubmissions,
        scoreSum: agg.scoreSum,
        ...personal,
      },
      courseWatchTime: [] as { course: string; hours: number }[],
    });
  },

  async getContestLeaderboard(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { contestId } = req.params;

      // Verify contest exists
      const contest = await prisma.contest.findUnique({
        where: { id: contestId },
      });

      if (!contest) {
        res.status(404).json({ error: 'Contest not found' });
        return;
      }

      // If contest is LIVE, get from Redis
      if (contest.status === 'LIVE') {
        const redisLeaderboard = await getLeaderboard(contestId, 100);

        // Fetch user details for each entry
        const leaderboard = await Promise.all(
          redisLeaderboard.map(async (entry) => {
            const user = await prisma.user.findUnique({
              where: { id: entry.userId },
              select: {
                id: true,
                username: true,
                email: true,
              },
            });

            return {
              rank: entry.rank,
              userId: entry.userId,
              username: user?.username || 'Unknown',
              email: user?.email || '',
              score: entry.score,
            };
          })
        );

        res.json({
          contestId,
          status: 'LIVE',
          leaderboard,
        });
        return;
      }

      // If contest is ENDED, get from database
      if (contest.status === 'ENDED') {
        const leaderboardEntries = await prisma.leaderboardEntry.findMany({
          where: { contestId },
          orderBy: [{ rank: 'asc' }, { score: 'desc' }],
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
          take: 100,
        });

        const leaderboard = leaderboardEntries.map((entry) => ({
          rank: entry.rank || 0,
          userId: entry.userId,
          username: entry.user.username,
          email: entry.user.email,
          score: entry.score,
        }));

        res.json({
          contestId,
          status: 'ENDED',
          leaderboard,
        });
        return;
      }

      // Contest is UPCOMING
      res.json({
        contestId,
        status: 'UPCOMING',
        leaderboard: [],
      });
    } catch (error) {
      throw error;
    }
  },

  async getUserRank(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { contestId, userId } = req.params;

      // Verify contest exists
      const contest = await prisma.contest.findUnique({
        where: { id: contestId },
      });

      if (!contest) {
        res.status(404).json({ error: 'Contest not found' });
        return;
      }

      // If contest is LIVE, get from Redis
      if (contest.status === 'LIVE') {
        const rank = await getUserRank(contestId, userId);
        const leaderboard = await getLeaderboard(contestId, 1000);
        const userEntry = leaderboard.find((entry) => entry.userId === userId);

        res.json({
          rank: rank || null,
          score: userEntry?.score || 0,
        });
        return;
      }

      // If contest is ENDED, get from database
      if (contest.status === 'ENDED') {
        const entry = await prisma.leaderboardEntry.findUnique({
          where: {
            userId_contestId: {
              userId,
              contestId,
            },
          },
        });

        res.json({
          rank: entry?.rank || null,
          score: entry?.score || 0,
        });
        return;
      }

      res.json({
        rank: null,
        score: 0,
      });
    } catch (error) {
      throw error;
    }
  },
};


