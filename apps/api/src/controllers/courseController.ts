import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { AppError, requireUserId } from '../lib/errors';
import {
  getCoursePack,
  getCourseTutorial,
  invalidateCoursePack,
  isLlmCourse,
  listLlmCourseIds,
} from '../services/courseLlmService';
import {
  generateAndPersistCourse,
  getCourseById,
  listGeneratedCoursesForUser,
  type SourceType,
} from '../services/courseGeneratorService';
import { userHasEnrollment } from '../services/productCatalog';

const generateBodySchema = z.object({
  sourceType: z.enum(['text', 'pdf', 'topic']),
  sourceContent: z.string().min(1),
  goal: z.string().optional(),
});

export const courseController = {
  async listLlmCourses(_req: AuthRequest, res: Response): Promise<void> {
    res.json({ courseIds: listLlmCourseIds() });
  },

  async listMine(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const courses = await listGeneratedCoursesForUser(userId);
    res.json({ courses });
  },

  async generate(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const body = generateBodySchema.parse(req.body);

    const hasAiCredit = await userHasEnrollment(userId, 'ai-generate');
    if (!hasAiCredit) {
      throw new AppError(
        'AI_CREDIT_REQUIRED',
        402,
        'AI course credit required. Buy it on the Billing page, then try again.',
      );
    }

    const course = await generateAndPersistCourse({
      sourceType: body.sourceType as SourceType,
      sourceContent: body.sourceContent,
      goal: body.goal,
      userId,
    });
    res.status(201).json(course);
  },

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const course = await getCourseById(id, req.user?.userId);
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    res.json(course);
  },

  async extractPdf(req: AuthRequest, res: Response): Promise<void> {
    if (!req.file) {
      res.status(400).json({ error: 'PDF file is required' });
      return;
    }

    const pdfParse = (await import('pdf-parse')).default as (
      buffer: Buffer,
    ) => Promise<{ text: string }>;
    const result = await pdfParse(req.file.buffer);
    const text = (result.text ?? '').trim();
    if (!text) {
      res.status(400).json({ error: 'Could not extract text from PDF' });
      return;
    }
    res.json({ text });
  },

  async getPack(req: AuthRequest, res: Response): Promise<void> {
    const courseId = req.params.courseId;
    const refresh = String(req.query.refresh || '') === '1';
    if (!isLlmCourse(courseId)) {
      throw new AppError(
        'COURSE_NOT_LLM_ENABLED',
        404,
        'This course is not configured for live LLM content.',
      );
    }
    const pack = await getCoursePack(courseId, { refresh });
    res.json(pack);
  },

  async getTutorial(req: AuthRequest, res: Response): Promise<void> {
    const { courseId, tutorialId } = req.params;
    const refresh = String(req.query.refresh || '') === '1';
    const data = await getCourseTutorial(courseId, tutorialId, refresh);
    res.json(data);
  },

  async refreshPack(req: AuthRequest, res: Response): Promise<void> {
    const courseId = req.params.courseId;
    await invalidateCoursePack(courseId);
    const pack = await getCoursePack(courseId, { refresh: true });
    res.json(pack);
  },
};
