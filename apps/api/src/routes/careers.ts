import { Router } from 'express';
import { careersController } from '../controllers/careersController';

export const careersRoutes = Router();

careersRoutes.get('/hub', (req, res, next) => {
  void careersController.getHub(req, res).catch(next);
});
careersRoutes.post('/hub/refresh', (req, res, next) => {
  void careersController.refreshHub(req, res).catch(next);
});
careersRoutes.post('/resume/suggest', (req, res, next) => {
  void careersController.suggestResume(req, res).catch(next);
});
