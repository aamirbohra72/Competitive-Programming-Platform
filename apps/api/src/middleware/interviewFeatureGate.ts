import { Request, Response, NextFunction } from 'express';

/**
 * In production, interview routes are off unless INTERVIEW_ENABLED=true.
 * Development is always allowed (LLM steps require GROQ_API_KEY).
 */
export function requireInterviewEnabled(_req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'production' && process.env.INTERVIEW_ENABLED !== 'true') {
    res.status(503).json({ error: 'Interview feature is not enabled on this deployment.' });
    return;
  }
  next();
}
