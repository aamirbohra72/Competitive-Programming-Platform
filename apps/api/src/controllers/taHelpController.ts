import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '@codeforces/db';
import { AppError, requireUserId } from '../lib/errors';
import {
  claimTaHelpRequest,
  countWaitingVideoCalls,
  createTaHelpRequest,
  getTaHelpRequest,
  isStaffRole,
  listMyTaHelpRequests,
  listTaQueue,
  replyToTaHelpRequest,
  submitTaHelpFeedback,
  updateTaHelpStatus,
} from '../services/taHelpService';

const createSchema = z.object({
  title: z.string().min(4).max(200),
  type: z.enum(['text', 'video']),
  problem: z.string().min(2).max(200),
  topic: z.string().min(1).max(80),
  language: z.string().min(1).max(40),
  description: z.string().min(20).max(5000),
  preferredSlot: z.string().max(120).optional(),
  source: z.enum(['web', 'companion']).optional(),
});

const replySchema = z.object({
  body: z.string().min(2).max(5000),
});

const statusSchema = z.object({
  status: z.enum(['OPEN_POOL', 'RESOLVED', 'WAITING']),
});

const feedbackSchema = z.object({
  satisfied: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export const taHelpController = {
  async create(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const body = createSchema.parse(req.body);
    const request = await createTaHelpRequest({
      userId,
      ...body,
    });
    res.status(201).json({ request });
  },

  async mine(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const requests = await listMyTaHelpRequests(userId);
    const waitingVideo = await countWaitingVideoCalls(userId);
    res.json({ requests, waitingVideo });
  },

  async queue(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    if (!isStaffRole(req.user?.role)) {
      throw new AppError('FORBIDDEN', 403, 'TA or admin access required');
    }
    const requests = await listTaQueue();
    res.json({ requests });
  },

  async getOne(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const detail = await getTaHelpRequest(String(req.params.id));
    if (!detail) {
      throw new AppError('REQUEST_NOT_FOUND', 404, 'Help request not found');
    }
    const staff = isStaffRole(req.user?.role);
    if (!staff && detail.userId !== userId) {
      throw new AppError('FORBIDDEN', 403, 'Not allowed');
    }
    res.json({ request: detail });
  },

  async claim(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    if (!isStaffRole(req.user?.role)) {
      throw new AppError('FORBIDDEN', 403, 'TA or admin access required');
    }
    const request = await claimTaHelpRequest(String(req.params.id), userId);
    res.json({ request });
  },

  async reply(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const body = replySchema.parse(req.body);
    const staff = isStaffRole(req.user?.role);
    const request = await replyToTaHelpRequest({
      requestId: String(req.params.id),
      authorId: userId,
      authorRole: staff ? 'ta' : 'learner',
      body: body.body,
    });
    res.json({ request });
  },

  async status(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const body = statusSchema.parse(req.body);
    const request = await updateTaHelpStatus({
      requestId: String(req.params.id),
      status: body.status,
      actorId: userId,
      asStaff: isStaffRole(req.user?.role),
    });
    res.json({ request });
  },

  async feedback(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const body = feedbackSchema.parse(req.body);
    const request = await submitTaHelpFeedback({
      requestId: String(req.params.id),
      userId,
      satisfied: body.satisfied,
      rating: body.rating,
    });
    res.json({ request });
  },

  /** Promote current user to TA (dev/admin helper — ADMIN only). */
  async promoteSelf(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    if (req.user?.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 403, 'Admin only');
    }
    const targetId = String(req.body?.userId || userId);
    const user = await prisma.user.update({
      where: { id: targetId },
      data: { role: 'TA' },
      select: { id: true, email: true, username: true, role: true },
    });
    res.json({ user });
  },
};
