import { Router } from 'express';
import multer from 'multer';
import { courseController } from '../controllers/courseController';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { requireCourseEnrollment } from '../middleware/requireEnrollment';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const courseRoutes = Router();

courseRoutes.get('/llm-enabled', courseController.listLlmCourses);
courseRoutes.get('/mine', authenticate, (req, res, next) => {
  void courseController.listMine(req, res).catch(next);
});

const GENERATE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — LLM course generation is slow

courseRoutes.post('/generate', authenticate, (req, res, next) => {
  req.setTimeout(GENERATE_TIMEOUT_MS);
  res.setTimeout(GENERATE_TIMEOUT_MS);
  void courseController.generate(req, res).catch(next);
});
courseRoutes.post('/extract-pdf', authenticate, upload.single('file'), (req, res, next) => {
  void courseController.extractPdf(req, res).catch(next);
});
courseRoutes.get('/:id', optionalAuthenticate, (req, res, next) => {
  void courseController.getById(req, res).catch(next);
});
courseRoutes.get(
  '/:courseId/pack',
  optionalAuthenticate,
  requireCourseEnrollment('courseId'),
  (req, res, next) => {
    void courseController.getPack(req, res).catch(next);
  },
);
courseRoutes.post(
  '/:courseId/pack/refresh',
  optionalAuthenticate,
  requireCourseEnrollment('courseId'),
  (req, res, next) => {
    void courseController.refreshPack(req, res).catch(next);
  },
);
courseRoutes.get(
  '/:courseId/tutorials/:tutorialId',
  optionalAuthenticate,
  requireCourseEnrollment('courseId'),
  (req, res, next) => {
    void courseController.getTutorial(req, res).catch(next);
  },
);
