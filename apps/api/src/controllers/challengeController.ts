import { Response } from 'express';
import { z } from 'zod';
import { ContestKind, prisma } from '@codeforces/db';
import { AuthRequest } from '../middleware/auth';
import { canViewContestProblems, determineStatus } from '../utils/contestRules';

const createChallengeSchema = z.object({
  contestId: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  difficulty: z.string(),
  inputFormat: z.string(),
  outputFormat: z.string(),
  constraints: z.string(),
  sampleInput: z.string(),
  sampleOutput: z.string(),
  practiceLanguage: z.string().nullable().optional(),
  companies: z.array(z.string()).optional(),
  estimatedTime: z.string().nullable().optional(),
});

const updateChallengeSchema = createChallengeSchema.partial().omit({ contestId: true });

function parseCompaniesQuery(raw: unknown): string[] {
  if (raw == null || raw === '') return [];
  const parts = Array.isArray(raw) ? raw : [raw];
  return parts
    .flatMap((p) => String(p).split(','))
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Distinct company names from practice-catalog challenges (for /practice sidebar). */
async function getDistinctCompanyNames(): Promise<string[]> {
  const rows = await prisma.challenge.findMany({
    where: { contest: { kind: ContestKind.PRACTICE, isPublished: true } },
    select: { companies: true },
  });
  const set = new Set<string>();
  for (const r of rows) {
    for (const c of r.companies) {
      set.add(c);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export const challengeController = {
  async getCompanies(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const names = await getDistinctCompanyNames();
      res.json(names);
    } catch (error) {
      throw error;
    }
  },

  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { difficulty, search, language } = req.query;
      const companiesFilter = parseCompaniesQuery(req.query.companies);

      const where: any = {};

      if (difficulty && difficulty !== 'All') {
        where.difficulty = { equals: String(difficulty), mode: 'insensitive' };
      }

      if (language && language !== 'All') {
        where.practiceLanguage = String(language);
      }

      if (companiesFilter.length > 0) {
        where.companies = { hasSome: companiesFilter };
      }

      if (search) {
        where.OR = [
          { title: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      // Practice catalog: only challenges hosted on the PRACTICE contest.
      // Rated/unrated contest problems are served via /contests/:id.
      where.contest = {
        kind: ContestKind.PRACTICE,
        isPublished: true,
      };

      const challenges = await prisma.challenge.findMany({
        where,
        include: {
          contest: {
            select: {
              id: true,
              name: true,
              kind: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json(challenges);
    } catch (error) {
      throw error;
    }
  },

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const challenge = await prisma.challenge.findUnique({
        where: { id },
        include: {
          contest: {
            select: {
              id: true,
              name: true,
              kind: true,
              status: true,
              startTime: true,
              endTime: true,
              isPublished: true,
            },
          },
          testCases: {
            where: { isSample: true },
            select: {
              id: true,
              name: true,
              input: true,
              expectedOutput: true,
              isSample: true,
              order: true,
            },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!challenge) {
        res.status(404).json({ error: 'Challenge not found' });
        return;
      }

      const now = new Date();
      const effectiveStatus = determineStatus(
        challenge.contest.startTime,
        challenge.contest.endTime,
        now,
      );

      if (
        !canViewContestProblems({
          kind: challenge.contest.kind,
          startTime: challenge.contest.startTime,
          endTime: challenge.contest.endTime,
          now,
        })
      ) {
        res.status(403).json({
          error: 'Challenge is not available yet. Contest has not started.',
          code: 'NOT_STARTED',
          contestId: challenge.contest.id,
          effectiveStatus,
        });
        return;
      }

      const sampleCount = challenge.testCases.length;
      const hiddenCount = await prisma.challengeTestCase.count({
        where: { challengeId: challenge.id, isHidden: true },
      });

      res.json({
        ...challenge,
        sampleTestCases: challenge.testCases,
        testCaseSummary: {
          sampleCount,
          hiddenCount,
          totalCount: sampleCount + hiddenCount,
        },
      });
    } catch (error) {
      throw error;
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = createChallengeSchema.parse(req.body);

      // Verify contest exists
      const contest = await prisma.contest.findUnique({
        where: { id: data.contestId },
      });

      if (!contest) {
        res.status(404).json({ error: 'Contest not found' });
        return;
      }

      const challenge = await prisma.challenge.create({
        data: {
          contestId: data.contestId,
          title: data.title,
          description: data.description,
          difficulty: data.difficulty,
          inputFormat: data.inputFormat,
          outputFormat: data.outputFormat,
          constraints: data.constraints,
          sampleInput: data.sampleInput,
          sampleOutput: data.sampleOutput,
          practiceLanguage: data.practiceLanguage ?? undefined,
          companies: data.companies ?? undefined,
          estimatedTime: data.estimatedTime ?? undefined,
        },
      });

      res.status(201).json(challenge);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      throw error;
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = updateChallengeSchema.parse(req.body);

      const existing = await prisma.challenge.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Challenge not found' });
        return;
      }

      const challenge = await prisma.challenge.update({
        where: { id },
        data,
      });

      res.json(challenge);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      throw error;
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await prisma.challenge.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      throw error;
    }
  },
};

