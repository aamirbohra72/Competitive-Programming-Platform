import { Router } from 'express';
import { communicationController } from '../controllers/communicationController';

export const communicationRoutes = Router();

communicationRoutes.get('/types', (req, res, next) => {
  void communicationController.listTypes(req, res).catch(next);
});

communicationRoutes.post('/scenario', (req, res, next) => {
  void communicationController.createScenario(req, res).catch(next);
});

communicationRoutes.post('/coach', (req, res, next) => {
  void communicationController.coach(req, res).catch(next);
});
