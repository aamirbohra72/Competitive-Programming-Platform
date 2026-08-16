import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { AppError, requireUserId } from '../lib/errors';
import { markTopicComplete, scoreQuiz } from '../services/courseGeneratorService';
import {
  completeLearningItem,
  getCourseLearningProgress,
  getMyLearningSummary,
} from '../services/learningProgressService';
import { isPremiumCourseProduct, userHasEnrollment } from '../services/productCatalog';

const quizBodySchema = z.object({
  answers: z.array(z.number().int().min(0).max(3)),
});

const completeItemSchema = z.object({
  courseId: z.string().min(1),
  courseKind: z.enum(['catalog', 'generated']).optional(),
  title: z.string().optional(),
  itemId: z.string().min(1),
  itemType: z.enum(['tutorial', 'module', 'topic', 'assignment']),
  itemTitle: z.string().optional(),
  itemHref: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
  totalCount: z.number().int().min(1).max(500).optional(),
});

export const progressController = {
  async complete(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const { topicId } = req.params;
    await markTopicComplete(userId, topicId);
    const summary = await getMyLearningSummary(userId);
    res.json({ ok: true, streak: summary.streak });
  },

  async submitQuiz(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const { topicId } = req.params;
    const body = quizBodySchema.parse(req.body);
    const result = await scoreQuiz(userId, topicId, body.answers);
    const summary = await getMyLearningSummary(userId);
    res.json({ ...result, streak: summary.streak });
  },

  async completeItem(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const body = completeItemSchema.parse(req.body);
    const kind = body.courseKind ?? 'catalog';
    if (kind === 'catalog' && isPremiumCourseProduct(body.courseId)) {
      const enrolled = await userHasEnrollment(userId, body.courseId);
      if (!enrolled) {
        throw new AppError('ENROLLMENT_REQUIRED', 402, 'Enrollment required for this course');
      }
    }
    const result = await completeLearningItem({
      userId,
      ...body,
    });
    res.json(result);
  },

  async me(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const summary = await getMyLearningSummary(userId);
    res.json(summary);
  },

  async course(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const courseId = String(req.params.courseId || '');
    const progress = await getCourseLearningProgress(userId, courseId);
    res.json({ progress });
  },
};
