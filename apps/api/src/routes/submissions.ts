import { Router } from 'express';
import { submissionController } from '../controllers/submissionController';
import { authenticate, requireAdmin } from '../middleware/auth';

export const submissionRoutes = Router();

submissionRoutes.use(authenticate);

submissionRoutes.get('/', (req, res, next) => {
  void submissionController.getAll(req, res).catch(next);
});
// Static paths before /:id
submissionRoutes.get('/accepted/:challengeId', (req, res, next) => {
  void submissionController.getAccepted(req, res).catch(next);
});
submissionRoutes.get('/admin/all', requireAdmin, (req, res, next) => {
  void submissionController.getAllAdmin(req, res).catch(next);
});
submissionRoutes.get('/:id', (req, res, next) => {
  void submissionController.getById(req, res).catch(next);
});
submissionRoutes.post('/', (req, res, next) => {
  void submissionController.create(req, res).catch(next);
});
