import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '@codeforces/db';
import { AuthRequest } from '../middleware/auth';
import { evaluateCode } from '../services/aiService';
import { DockerUnavailableError, isDockerJudgeAvailable, judgeHasCapacity } from '../services/dockerJudgeService';
import { AppError } from '../lib/errors';

const executeCodeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(100_000),
  language: z.enum(['javascript', 'python', 'java', 'cpp']).default('javascript'),
  challengeId: z.string().min(1),
  timeout: z.number().optional().default(5000),
});

export const executionController = {
  async execute(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const data = executeCodeSchema.parse(req.body);
      if (!judgeHasCapacity()) {
        throw new AppError('JUDGE_BUSY', 429, 'Judge is busy, try again shortly');
      }
      const available = await isDockerJudgeAvailable();
      if (!available) {
        res.status(503).json({
          error: 'Judge unavailable',
          message: 'Docker is required to run code. Start Docker Desktop and ensure image codeforces-judge:1 exists.',
        });
        return;
      }

      const challenge = await prisma.challenge.findUnique({
        where: { id: data.challengeId },
        select: {
          id: true,
          judgeReady: true,
          allowedLanguages: true,
        },
      });

      if (!challenge) {
        res.status(404).json({ error: 'Challenge not found' });
        return;
      }

      if (!challenge.allowedLanguages.map((l) => l.toLowerCase()).includes(data.language.toLowerCase())) {
        res.status(400).json({
          error: `Language not allowed. Use one of: ${challenge.allowedLanguages.join(', ')}`,
        });
        return;
      }

      // Run sample tests only — never hidden cases on /execute
      const result = await evaluateCode(data.code, data.language, data.challengeId, {
        sampleOnly: true,
      });

      res.json({
        success: result.status === 'ACCEPTED',
        status: result.status,
        score: result.score,
        output: result.feedback,
        error: result.status === 'ACCEPTED' ? null : result.feedback,
        result: JSON.parse(result.resultJson),
        hintText: result.hintText,
        exitCode: result.status === 'ACCEPTED' ? 0 : 1,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (error instanceof DockerUnavailableError) {
        res.status(503).json({ error: 'Judge unavailable', message: error.message });
        return;
      }
      throw error;
    }
  },
};
