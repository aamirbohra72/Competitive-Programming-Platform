import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  getBlogHub,
  getBlogPostFromHub,
  invalidateBlogHub,
} from '../services/blogLlmService';

export const blogController = {
  async getHub(req: AuthRequest, res: Response): Promise<void> {
    const refresh = String(req.query.refresh || '') === '1';
    const pack = await getBlogHub({ refresh });
    res.json(pack);
  },

  async refresh(_req: AuthRequest, res: Response): Promise<void> {
    await invalidateBlogHub();
    const pack = await getBlogHub({ refresh: true });
    res.json(pack);
  },

  async getPost(req: AuthRequest, res: Response): Promise<void> {
    const id = String(req.params.id || '');
    const post = await getBlogPostFromHub(id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    res.json(post);
  },
};
