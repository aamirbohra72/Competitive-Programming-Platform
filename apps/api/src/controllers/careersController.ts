import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getCareersHub, invalidateCareersHub } from '../services/careersJobsService';
import { suggestResumeImprovements, type ResumeData } from '../services/resumeLlmService';

export const careersController = {
  async getHub(req: AuthRequest, res: Response): Promise<void> {
    const refresh = String(req.query.refresh || '') === '1';
    const pack = await getCareersHub({ refresh });
    res.json(pack);
  },

  async refreshHub(_req: AuthRequest, res: Response): Promise<void> {
    await invalidateCareersHub();
    const pack = await getCareersHub({ refresh: true });
    res.json(pack);
  },

  async suggestResume(req: AuthRequest, res: Response): Promise<void> {
    const body = (req.body ?? {}) as ResumeData;
    const suggestions = await suggestResumeImprovements(body);
    res.json(suggestions);
  },
};
