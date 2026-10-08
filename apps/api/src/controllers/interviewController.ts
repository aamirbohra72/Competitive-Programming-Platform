import { Response } from 'express';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import {
  createInterviewSession,
  disqualifyInterviewSession,
  finishInterviewSession,
  getInterviewSession,
  registerInterviewAwayWarning,
  submitInterviewAnswer,
  INTERVIEW_TEMPLATE_RESUME_10M,
} from '../services/interviewService';

const createSessionBodySchema = z.object({
  template: z.string().optional(),
  mode: z.enum(['PRACTICE', 'PROCTORED', 'PROCTORED_PLUS']).default('PRACTICE'),
});

const transcriptBodySchema = z.object({
  transcript: z.string().min(1, 'Transcript cannot be empty'),
});

const disqualifyBodySchema = z.object({
  reason: z.enum(['tab-hidden', 'window-blur', 'fullscreen-exit', 'camera-stopped', 'microphone-stopped', 'screen-share-stopped', 'prohibited-actions']),
});

const awayWarningBodySchema = z.object({
  reason: z.enum(['tab-hidden', 'window-blur', 'fullscreen-exit']),
});

function mapInterviewError(err: unknown): { status: number; message: string } | null {
  if (!(err instanceof Error)) return null;
  if (err instanceof z.ZodError || /failed to validate json|invalid json/i.test(err.message)) {
    return { status: 502, message: 'Groq returned an incomplete interview response. Please try again.' };
  }
  if (/Groq TLS certificate is not trusted/i.test(err.message)) {
    return { status: 503, message: 'The server cannot verify Groq’s TLS certificate. Start the Windows dev server with npm run dev:windows-ca.' };
  }
  if (/Groq (chat|transcription) request failed|fetch failed|network error/i.test(err.message)) {
    return { status: 503, message: 'Groq is temporarily unreachable. Please retry in a moment.' };
  }
  switch (err.message) {
    case 'GROQ_API_KEY_MISSING':
      return { status: 503, message: 'Groq is not configured (missing GROQ_API_KEY).' };
    case 'UNKNOWN_TEMPLATE':
      return { status: 400, message: 'Unknown interview template.' };
    case 'SESSION_NOT_FOUND':
      return { status: 404, message: 'Interview session not found.' };
    case 'SESSION_NOT_ACTIVE':
      return { status: 400, message: 'This interview is no longer active.' };
    case 'MOBILE_MONITOR_REQUIRED':
      return { status: 409, message: 'Connect the mobile camera before continuing this Proctored+ interview.' };
    case 'MOBILE_CHECKS_PENDING':
      return { status: 409, message: 'Keep the mobile camera connected. All three scheduled mobile checks must finish before the final answer or report.' };
    case 'TIME_EXPIRED':
      return { status: 400, message: 'Interview time has expired.' };
    case 'NO_MORE_QUESTIONS':
      return { status: 400, message: 'No further questions for this session.' };
    case 'EMPTY_TRANSCRIPT':
      return { status: 400, message: 'Could not use an empty answer. Record audio or type a transcript.' };
    case 'GROQ_API_KEY is not configured':
      return { status: 503, message: 'Groq is not configured (missing GROQ_API_KEY).' };
    default:
      if (/rate limit|\b429\b/i.test(err.message)) {
        return { status: 503, message: 'The Groq interviewer is busy right now (rate limited). Wait a minute and try again.' };
      }
      return null;
  }
}

export const interviewController = {
  async createSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const parsed = createSessionBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid interview mode or template.' });
        return;
      }
      const body = parsed.data;
      if (!req.file) {
        res.status(400).json({ error: 'A PDF resume is required for a resume-based interview.' });
        return;
      }
      let resumeText: string | undefined;
      if (req.file) {
        if (req.file.mimetype !== 'application/pdf' || req.file.buffer.subarray(0, 5).toString() !== '%PDF-') {
          res.status(400).json({ error: 'Upload a valid PDF resume.' });
          return;
        }
        try {
          const pdfParse = createRequire(__filename)('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
          resumeText = (await pdfParse(req.file.buffer)).text.replace(/\s+/g, ' ').trim().slice(0, 12000);
        } catch {
          res.status(400).json({ error: 'Could not read this PDF. Upload a text-based resume.' });
          return;
        }
        if (resumeText.length < 80) {
          res.status(400).json({ error: 'This resume has too little extractable text. Upload a text-based PDF.' });
          return;
        }
      }
      const template = body.template ?? INTERVIEW_TEMPLATE_RESUME_10M;
      const state = await createInterviewSession(req.user.userId, template, body.mode, resumeText);
      res.status(201).json(state);
    } catch (err) {
      const mapped = mapInterviewError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      throw err;
    }
  },

  async getSession(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    const state = await getInterviewSession(id, req.user.userId);
    if (!state) {
      res.status(404).json({ error: 'Interview session not found.' });
      return;
    }
    res.json(state);
  },

  async disqualifySession(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const parsed = disqualifyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid disqualification reason' });
      return;
    }
    try {
      const state = await disqualifyInterviewSession(req.params.id, req.user.userId, parsed.data.reason);
      res.json(state);
    } catch (err) {
      const mapped = mapInterviewError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      throw err;
    }
  },

  async registerAwayWarning(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const parsed = awayWarningBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid proctoring event' });
      return;
    }
    try {
      const state = await registerInterviewAwayWarning(req.params.id, req.user.userId);
      res.json(state);
    } catch (err) {
      const mapped = mapInterviewError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      throw err;
    }
  },

  async finishSession(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const state = await finishInterviewSession(req.params.id, req.user.userId);
      res.json(state);
    } catch (err) {
      const mapped = mapInterviewError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      throw err;
    }
  },

  async submitAnswer(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const file = req.file;

      let transcript: string | undefined;
      if (!file) {
        const raw = typeof req.body?.transcript === 'string' ? req.body.transcript : undefined;
        if (raw !== undefined) {
          const parsed = transcriptBodySchema.safeParse({ transcript: raw });
          if (!parsed.success) {
            res.status(400).json({ error: 'Invalid transcript', details: parsed.error.flatten() });
            return;
          }
          transcript = parsed.data.transcript;
        }
      }

      const result = await submitInterviewAnswer(id, req.user.userId, {
        audioBuffer: file?.buffer,
        audioFilename: file?.originalname,
        transcript,
      });

      res.json(result);
    } catch (err) {
      const mapped = mapInterviewError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      console.error('[interview] submitAnswer', err);
      res.status(500).json({
        error: 'Failed to process answer',
        message: process.env.NODE_ENV === 'development' && err instanceof Error ? err.message : undefined,
      });
    }
  },
};
