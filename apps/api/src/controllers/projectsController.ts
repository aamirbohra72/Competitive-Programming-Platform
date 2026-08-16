import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getProjectsHub, invalidateProjectsHub } from '../services/projectsLlmService';

export const projectsController = {
  async getHub(req: AuthRequest, res: Response): Promise<void> {
    const refresh = String(req.query.refresh || '') === '1';
    const pack = await getProjectsHub({ refresh });
    res.json(pack);
  },

  async refresh(_req: AuthRequest, res: Response): Promise<void> {
    await invalidateProjectsHub();
    const pack = await getProjectsHub({ refresh: true });
    res.json(pack);
  },
};
