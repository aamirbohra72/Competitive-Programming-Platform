import { Router } from 'express';
import multer from 'multer';
import { interviewController } from '../controllers/interviewController';
import { authenticate } from '../middleware/auth';
import { requireInterviewEnabled } from '../middleware/interviewFeatureGate';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const interviewRoutes = Router();

interviewRoutes.use(requireInterviewEnabled);
interviewRoutes.use(authenticate);

interviewRoutes.post('/sessions', (req, res, next) => {
  resumeUpload.single('resume')(req, res, (error) => {
    if (error) {
      res.status(error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
        .json({ error: 'Resume upload must be a PDF under 5 MB.' });
      return;
    }
    void interviewController.createSession(req, res).catch(next);
  });
});

interviewRoutes.get('/sessions/:id', (req, res, next) => {
  void interviewController.getSession(req, res).catch(next);
});

interviewRoutes.post('/sessions/:id/disqualify', (req, res, next) => {
  void interviewController.disqualifySession(req, res).catch(next);
});

interviewRoutes.post('/sessions/:id/away-warning', (req, res, next) => {
  void interviewController.registerAwayWarning(req, res).catch(next);
});

interviewRoutes.post('/sessions/:id/finish', (req, res, next) => {
  void interviewController.finishSession(req, res).catch(next);
});

interviewRoutes.post('/sessions/:id/answers', upload.single('audio'), (req, res, next) => {
  void interviewController.submitAnswer(req, res).catch(next);
});
