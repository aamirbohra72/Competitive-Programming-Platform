import { Prisma } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, KNOWN_ERROR_CODES } from '../lib/errors';
import { DockerUnavailableError } from '../services/dockerJudgeService';

function isPrismaKnown(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError;
}

function logUnexpected(err: unknown): void {
  console.error('Error:', err);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      logUnexpected(err);
    }
    res.status(err.httpStatus).json({
      error: err.expose ? err.message : 'Internal server error',
      code: err.code,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors,
    });
    return;
  }

  if (err instanceof DockerUnavailableError) {
    res.status(503).json({
      error: 'Judge unavailable',
      message: 'Docker is required to run code. Start Docker Desktop, or set JUDGE_ENABLED=false if you are not using the judge.',
      code: 'JUDGE_UNAVAILABLE',
    });
    return;
  }

  if (isPrismaKnown(err)) {
    if (err.code === 'P2021') {
      res.status(503).json({
        error:
          'Database is missing tables. From the repo root run: npm run db:migrate (or npm run db:push in local dev).',
        ...(process.env.NODE_ENV === 'development' && { code: err.code, meta: err.meta }),
      });
      return;
    }
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Duplicate record', code: 'P2002' });
      return;
    }
  }

  if (err instanceof Error) {
    const known = KNOWN_ERROR_CODES[err.message];
    if (known) {
      res.status(known.status).json({ error: known.message, code: err.message });
      return;
    }
    if (err.message.includes('GROQ_API_KEY')) {
      res.status(503).json({
        error: 'Groq is not configured (missing GROQ_API_KEY).',
        code: 'GROQ_API_KEY_MISSING',
      });
      return;
    }
  }

  logUnexpected(err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? message : undefined,
  });
}
