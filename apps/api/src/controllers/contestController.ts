import { Response } from 'express';
import { z } from 'zod';
import { prisma, ContestStatus, ContestKind, Prisma } from '@codeforces/db';
import { AuthRequest } from '../middleware/auth';
import {
  determineStatus,
  canRegisterForContest,
  canUnregisterFromContest,
  canViewContestProblems,
  contestRequiresRegistration,
  evaluateContestSubmit,
} from '../utils/contestRules';

const createContestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  kind: z.enum(['PRACTICE', 'RATED', 'UNRATED']).optional(),
  slug: z.string().min(1).optional(),
  isPublished: z.boolean().optional(),
});

const updateContestSchema = createContestSchema.partial();

export { determineStatus };

type ContestRow = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  status: ContestStatus;
  kind: ContestKind;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { challenges: number; registrations: number };
};

function enrichContest(
  contest: ContestRow,
  opts: { now?: Date; isRegistered?: boolean } = {},
) {
  const now = opts.now ?? new Date();
  const effectiveStatus = determineStatus(contest.startTime, contest.endTime, now);
  const startsInMs = Math.max(0, contest.startTime.getTime() - now.getTime());
  const endsInMs = Math.max(0, contest.endTime.getTime() - now.getTime());
  const durationMs = Math.max(0, contest.endTime.getTime() - contest.startTime.getTime());

  return {
    ...contest,
    status: effectiveStatus,
    effectiveStatus,
    problemCount: contest._count?.challenges ?? 0,
    participantCount: contest._count?.registrations ?? 0,
    isRegistered: opts.isRegistered,
    startsInMs,
    endsInMs,
    durationMs,
    _count: undefined,
  };
}

async function syncStaleStatuses(contests: ContestRow[], now = new Date()): Promise<void> {
  const stale = contests.filter(
    (c) => c.status !== determineStatus(c.startTime, c.endTime, now),
  );
  await Promise.all(
    stale.map((c) =>
      prisma.contest
        .update({
          where: { id: c.id },
          data: { status: determineStatus(c.startTime, c.endTime, now) },
        })
        .catch((err) => console.error('Failed to sync contest status', c.id, err)),
    ),
  );
}

async function registrationSetForUser(
  userId: string | undefined,
  contestIds: string[],
): Promise<Set<string>> {
  if (!userId || contestIds.length === 0) return new Set();
  const rows = await prisma.contestRegistration.findMany({
    where: { userId, contestId: { in: contestIds } },
    select: { contestId: true },
  });
  return new Set(rows.map((r) => r.contestId));
}

export const contestController = {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    const { status, page = '1', pageSize = '20', includePractice } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);
    const now = new Date();

    const where: Prisma.ContestWhereInput = {
      isPublished: true,
    };
    if (includePractice !== '1' && includePractice !== 'true') {
      where.kind = { not: ContestKind.PRACTICE };
    }

    const rows = await prisma.contest.findMany({
      where,
      orderBy: [{ startTime: 'desc' }],
      include: {
        _count: { select: { challenges: true, registrations: true } },
      },
    });

    await syncStaleStatuses(rows, now);

    const registered = await registrationSetForUser(
      req.user?.userId,
      rows.map((r) => r.id),
    );

    let enriched = rows.map((c) =>
      enrichContest(c, { now, isRegistered: registered.has(c.id) }),
    );

    if (status && typeof status === 'string') {
      enriched = enriched.filter((c) => c.effectiveStatus === status);
    }

    enriched.sort((a, b) => {
      const order = { LIVE: 0, UPCOMING: 1, ENDED: 2 } as const;
      const ao = order[a.effectiveStatus];
      const bo = order[b.effectiveStatus];
      if (ao !== bo) return ao - bo;
      if (a.effectiveStatus === 'UPCOMING') return a.startsInMs - b.startsInMs;
      if (a.effectiveStatus === 'LIVE') return a.endsInMs - b.endsInMs;
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

    const total = enriched.length;
    const data = enriched.slice(skip, skip + take);

    res.json({
      data,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)) || 1,
    });
  },

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const contest = await prisma.contest.findUnique({
      where: { id },
      include: {
        challenges: true,
        _count: { select: { challenges: true, registrations: true } },
      },
    });

    if (!contest) {
      res.status(404).json({ error: 'Contest not found' });
      return;
    }

    const now = new Date();
    await syncStaleStatuses([contest], now);

    let isRegistered = false;
    if (req.user?.userId) {
      const reg = await prisma.contestRegistration.findUnique({
        where: {
          userId_contestId: { userId: req.user.userId, contestId: contest.id },
        },
      });
      isRegistered = Boolean(reg);
    }

    res.json(enrichContest(contest, { now, isRegistered }));
  },

  async getChallenges(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const contest = await prisma.contest.findUnique({ where: { id } });
    if (!contest) {
      res.status(404).json({ error: 'Contest not found' });
      return;
    }

    const now = new Date();
    if (
      !canViewContestProblems({
        kind: contest.kind,
        startTime: contest.startTime,
        endTime: contest.endTime,
        now,
      })
    ) {
      res.status(403).json({
        error: 'Problem statements unlock when the contest starts',
        code: 'NOT_STARTED',
        effectiveStatus: determineStatus(contest.startTime, contest.endTime, now),
      });
      return;
    }

    const challenges = await prisma.challenge.findMany({
      where: { contestId: id },
      orderBy: { createdAt: 'asc' },
    });

    res.json(challenges);
  },

  async getMe(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const contest = await prisma.contest.findUnique({ where: { id } });
    if (!contest) {
      res.status(404).json({ error: 'Contest not found' });
      return;
    }

    const now = new Date();
    const effectiveStatus = determineStatus(contest.startTime, contest.endTime, now);
    const reg = await prisma.contestRegistration.findUnique({
      where: {
        userId_contestId: { userId: req.user.userId, contestId: contest.id },
      },
    });

    const registered = Boolean(reg);
    const decision = evaluateContestSubmit({
      kind: contest.kind,
      startTime: contest.startTime,
      endTime: contest.endTime,
      isRegistered: registered || !contestRequiresRegistration(contest.kind),
      isPublished: contest.isPublished,
      now,
    });

    res.json({
      contestId: contest.id,
      registered,
      registeredAt: reg?.registeredAt ?? null,
      effectiveStatus,
      kind: contest.kind,
      canRegister: !registered && canRegisterForContest({ ...contest, now }),
      canUnregister: registered && canUnregisterFromContest({ ...contest, now }),
      canSubmit: decision.allowed,
      countsForLeaderboard: decision.countsForLeaderboard,
      submitMode: decision.mode,
    });
  },

  async register(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const contest = await prisma.contest.findUnique({ where: { id } });
    if (!contest) {
      res.status(404).json({ error: 'Contest not found' });
      return;
    }

    const now = new Date();
    if (!canRegisterForContest({ ...contest, now })) {
      const reason =
        contest.kind === 'PRACTICE'
          ? 'Practice contests do not require registration'
          : !contest.isPublished
            ? 'Contest is not published'
            : 'Registration is closed for this contest';
      res.status(400).json({ error: reason });
      return;
    }

    const existing = await prisma.contestRegistration.findUnique({
      where: {
        userId_contestId: { userId: req.user.userId, contestId: contest.id },
      },
    });
    if (existing) {
      res.json({ registered: true, registration: existing, alreadyRegistered: true });
      return;
    }

    const registration = await prisma.contestRegistration.create({
      data: {
        userId: req.user.userId,
        contestId: contest.id,
      },
    });

    res.status(201).json({ registered: true, registration });
  },

  async unregister(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const contest = await prisma.contest.findUnique({ where: { id } });
    if (!contest) {
      res.status(404).json({ error: 'Contest not found' });
      return;
    }

    const now = new Date();
    if (!canUnregisterFromContest({ ...contest, now })) {
      res.status(400).json({
        error: 'You can only unregister before the contest starts',
      });
      return;
    }

    await prisma.contestRegistration.deleteMany({
      where: { userId: req.user.userId, contestId: contest.id },
    });

    res.json({ registered: false });
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = createContestSchema.parse(req.body);
      const startTime = new Date(data.startTime);
      const endTime = new Date(data.endTime);

      if (endTime <= startTime) {
        res.status(400).json({ error: 'End time must be after start time' });
        return;
      }

      const status = determineStatus(startTime, endTime);

      const contest = await prisma.contest.create({
        data: {
          name: data.name,
          description: data.description,
          startTime,
          endTime,
          status,
          kind: (data.kind as ContestKind) ?? ContestKind.UNRATED,
          slug: data.slug,
          isPublished: data.isPublished ?? true,
        },
        include: {
          _count: { select: { challenges: true, registrations: true } },
        },
      });

      res.status(201).json(enrichContest(contest));
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
      const data = updateContestSchema.parse(req.body);

      const existing = await prisma.contest.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Contest not found' });
        return;
      }

      const updateData: Prisma.ContestUpdateInput = {};

      if (data.name) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.kind) updateData.kind = data.kind as ContestKind;
      if (data.slug !== undefined) updateData.slug = data.slug;
      if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;

      const startTime = data.startTime ? new Date(data.startTime) : existing.startTime;
      const endTime = data.endTime ? new Date(data.endTime) : existing.endTime;

      if (endTime <= startTime) {
        res.status(400).json({ error: 'End time must be after start time' });
        return;
      }

      updateData.startTime = startTime;
      updateData.endTime = endTime;
      const newStatus = determineStatus(startTime, endTime);
      updateData.status = newStatus;

      if (newStatus === 'ENDED' && existing.status !== 'ENDED') {
        const { finalizeContestLeaderboard } = await import('../services/leaderboardService');
        finalizeContestLeaderboard(id).catch(console.error);
      }

      const contest = await prisma.contest.update({
        where: { id },
        data: updateData,
        include: {
          _count: { select: { challenges: true, registrations: true } },
        },
      });

      res.json(enrichContest(contest));
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      throw error;
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    await prisma.contest.delete({ where: { id } });
    res.status(204).send();
  },
};
