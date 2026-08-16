import { Response } from 'express';
import { z } from 'zod';
import { prisma, SubmissionStatus } from '@codeforces/db';
import { AuthRequest } from '../middleware/auth';
import { evaluateCode } from '../services/aiService';
import { addToLeaderboard } from '../services/redisService';
import { DockerUnavailableError, judgeHasCapacity } from '../services/dockerJudgeService';
import { AppError, requireUserId } from '../lib/errors';
import {
  getAcceptedSolutionForUser,
  saveAcceptedSolution,
} from '../services/acceptedSolutionService';
import { evaluateContestSubmit } from '../utils/contestRules';

const createSubmissionSchema = z.object({
  challengeId: z.string().min(1),
  language: z.enum(['javascript', 'python', 'java', 'cpp']),
  sourceCode: z.string().min(1).max(100_000),
});

function publicSubmission(submission: {
  id: string;
  userId: string;
  challengeId: string;
  language: string;
  sourceCode: string;
  status: SubmissionStatus;
  score: number;
  aiResponse: string | null;
  resultJson: string | null;
  hintText: string | null;
  submittedAt: Date;
  updatedAt: Date;
  challenge?: unknown;
}) {
  return submission;
}

export const submissionController = {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { page = '1', pageSize = '10', challengeId, status } = req.query;
      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);

      const where: {
        userId: string;
        challengeId?: string;
        status?: SubmissionStatus;
      } = {
        userId: req.user.userId,
      };

      if (challengeId && typeof challengeId === 'string') {
        where.challengeId = challengeId;
      }

      if (status && typeof status === 'string') {
        where.status = status as SubmissionStatus;
      }

      const [submissions, total] = await Promise.all([
        prisma.submission.findMany({
          where,
          skip,
          take,
          orderBy: { submittedAt: 'desc' },
          include: {
            challenge: {
              select: {
                id: true,
                title: true,
                slug: true,
                contest: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
        prisma.submission.count({ where }),
      ]);

      res.json({
        data: submissions.map(publicSubmission),
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
      });
    } catch (error) {
      throw error;
    }
  },

  async getAllAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', pageSize = '10', challengeId, status, userId } = req.query;
      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);

      const where: {
        challengeId?: string;
        status?: SubmissionStatus;
        userId?: string;
      } = {};

      if (challengeId && typeof challengeId === 'string') {
        where.challengeId = challengeId;
      }

      if (status && typeof status === 'string') {
        where.status = status as SubmissionStatus;
      }

      if (userId && typeof userId === 'string') {
        where.userId = userId;
      }

      const [submissions, total] = await Promise.all([
        prisma.submission.findMany({
          where,
          skip,
          take,
          orderBy: { submittedAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
            challenge: {
              select: {
                id: true,
                title: true,
                slug: true,
                contest: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
        prisma.submission.count({ where }),
      ]);

      res.json({
        data: submissions,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
      });
    } catch (error) {
      throw error;
    }
  },

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const submission = await prisma.submission.findUnique({
        where: { id },
        include: {
          challenge: {
            include: {
              contest: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      if (!submission) {
        res.status(404).json({ error: 'Submission not found' });
        return;
      }

      if (submission.userId !== req.user.userId && req.user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      res.json(publicSubmission(submission));
    } catch (error) {
      throw error;
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const data = createSubmissionSchema.parse(req.body);

      const challenge = await prisma.challenge.findUnique({
        where: { id: data.challengeId },
        include: {
          contest: true,
        },
      });

      if (!challenge) {
        res.status(404).json({ error: 'Challenge not found' });
        return;
      }

      if (!challenge.judgeReady) {
        res.status(400).json({ error: 'Judging is not ready for this challenge yet.' });
        return;
      }

      if (!challenge.allowedLanguages.map((l) => l.toLowerCase()).includes(data.language.toLowerCase())) {
        res.status(400).json({
          error: `Language not allowed. Use one of: ${challenge.allowedLanguages.join(', ')}`,
        });
        return;
      }

      const contest = challenge.contest;
      const now = new Date();

      const registration =
        contest.kind === 'PRACTICE'
          ? null
          : await prisma.contestRegistration.findUnique({
              where: {
                userId_contestId: {
                  userId: req.user.userId,
                  contestId: contest.id,
                },
              },
            });

      const decision = evaluateContestSubmit({
        kind: contest.kind,
        startTime: contest.startTime,
        endTime: contest.endTime,
        isRegistered: Boolean(registration),
        isPublished: contest.isPublished,
        now,
      });

      if (!decision.allowed) {
        const status = decision.code === 'NOT_REGISTERED' ? 403 : 400;
        res.status(status).json({
          error: decision.message || 'Submission not allowed for this contest',
          code: decision.code,
          submitMode: decision.mode,
        });
        return;
      }

      const countsForLeaderboard = decision.countsForLeaderboard;

      if (!judgeHasCapacity()) {
        throw new AppError('JUDGE_BUSY', 429, 'Judge is busy, try again shortly');
      }

      const submission = await prisma.submission.create({
        data: {
          userId: req.user.userId,
          challengeId: data.challengeId,
          language: data.language,
          sourceCode: data.sourceCode,
          status: SubmissionStatus.PENDING,
        },
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              slug: true,
              contest: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      const userId = req.user.userId;

      evaluateCode(data.sourceCode, data.language, data.challengeId)
        .then(async (result) => {
          await prisma.submission.update({
            where: { id: submission.id },
            data: {
              status: result.status as SubmissionStatus,
              score: result.score,
              aiResponse: result.feedback,
              resultJson: result.resultJson,
              hintText: result.hintText,
            },
          });

          if (result.status === 'ACCEPTED') {
            try {
              await saveAcceptedSolution({
                userId,
                challengeId: data.challengeId,
                submissionId: submission.id,
                language: data.language,
                sourceCode: data.sourceCode,
                score: result.score,
              });
            } catch (err) {
              console.error('[accepted-solution] Failed to persist accepted solution:', err);
            }

            if (countsForLeaderboard) {
              await addToLeaderboard(challenge.contest.id, userId, result.score);
            }
          }
        })
        .catch(async (error) => {
          console.error('Error evaluating submission:', error);
          const message =
            error instanceof DockerUnavailableError
              ? 'Judge unavailable: Docker is required but not running.'
              : 'Error during code evaluation';
          await prisma.submission
            .update({
              where: { id: submission.id },
              data: {
                status: SubmissionStatus.RUNTIME_ERROR,
                aiResponse: message,
                resultJson: JSON.stringify({ status: 'RUNTIME_ERROR', feedback: message }),
                hintText: message,
              },
            })
            .catch(console.error);
        });

      res.status(201).json(publicSubmission(submission));
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      throw error;
    }
  },

  /** GET /submissions/accepted/:challengeId — unlock Solution tab after AC */
  async getAccepted(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const challengeId = String(req.params.challengeId || '');
    if (!challengeId) {
      res.status(400).json({ error: 'challengeId is required' });
      return;
    }

    const solution = await getAcceptedSolutionForUser(userId, challengeId);
    if (!solution) {
      res.status(404).json({
        error: 'No accepted solution yet',
        code: 'NOT_SOLVED',
        solved: false,
      });
      return;
    }

    res.json({
      solved: true,
      solution: {
        id: solution.id,
        challengeId: solution.challengeId,
        submissionId: solution.submissionId,
        language: solution.language,
        sourceCode: solution.sourceCode,
        score: solution.score,
        firstAcceptedAt: solution.firstAcceptedAt,
        updatedAt: solution.updatedAt,
      },
    });
  },
};
