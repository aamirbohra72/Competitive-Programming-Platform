import { Router } from 'express';
import multer from 'multer';
import { interviewController } from '../controllers/interviewController';
import { authenticate } from '../middleware/auth';
import { requireInterviewEnabled } from '../middleware/interviewFeatureGate';
import { interviewMobileController } from '../controllers/interviewMobileController';

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

interviewRoutes.post('/mobile/claim', (req, res, next) => {
  void interviewMobileController.claim(req, res).catch(next);
});
interviewRoutes.post('/mobile/heartbeat', (req, res, next) => {
  void interviewMobileController.heartbeat(req, res).catch(next);
});
interviewRoutes.post('/mobile/photos', (req, res, next) => {
  const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024, files: 1, fields: 1 } });
  photoUpload.single('photo')(req, res, (error) => {
    if (error) { res.status(400).json({ error: 'Send one JPEG photo smaller than 512 KB.' }); return; }
    void interviewMobileController.photo(req, res).catch(next);
  });
});

interviewRoutes.use(authenticate);

interviewRoutes.post('/sessions/:id/mobile/pair', (req, res, next) => {
  void interviewMobileController.pair(req, res).catch(next);
});
interviewRoutes.get('/sessions/:id/mobile', (req, res, next) => {
  void interviewMobileController.status(req, res).catch(next);
});
interviewRoutes.post('/sessions/:id/mobile/start', (req, res, next) => {
  void interviewMobileController.start(req, res).catch(next);
});

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
