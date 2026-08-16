import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { chatWithCompanion, parseCompanionRequest } from '../services/companionService';

export const companionController = {
  async chat(req: AuthRequest, res: Response): Promise<void> {
    const input = parseCompanionRequest(req.body);
    const result = await chatWithCompanion(input);
    res.json(result);
  },
};
