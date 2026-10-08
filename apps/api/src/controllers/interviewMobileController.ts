import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth';
import { sessionPublicState } from '../services/interviewService';
import {
  claimMobilePairing, createMobilePairing, getMobileStatus, mobileHeartbeat,
  startMobileInterview, submitMobilePhoto,
} from '../services/interviewMobileService';

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
function deviceToken(req: Request) {
  return tokenSchema.parse(req.headers.authorization?.replace(/^Bearer /, ''));
}

export async function mobileAction(res: Response, action: () => Promise<unknown>) {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json(await action()); }
  catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Invalid mobile monitoring request.' }); return; }
    const message = error instanceof Error ? error.message : '';
    const errors: Record<string, [number, string]> = {
      MOBILE_TOKEN_INVALID: [401, 'Pairing link expired or already used. Generate a new QR code on your laptop.'],
      MOBILE_NOT_APPLICABLE: [400, 'Mobile monitoring is only available for resume-based Proctored+ interviews.'],
      MOBILE_ALREADY_STARTED: [409, 'This mobile interview has already started.'],
      MOBILE_MONITOR_REQUIRED: [409, 'Keep the phone camera open and connected before starting.'],
      MOBILE_VISION_UNAVAILABLE: [503, 'Mobile photo assessment is not configured. Contact the administrator.'],
      MOBILE_CAPTURE_INVALID: [409, 'This photo request expired or has already been submitted.'],
      MOBILE_IMAGE_INVALID: [400, 'Send a JPEG photo smaller than 512 KB.'],
      MOBILE_RETRY: [409, 'Monitoring state changed. Please retry.'],
      SESSION_NOT_FOUND: [404, 'Interview session not found.'],
      SESSION_NOT_ACTIVE: [410, 'The interview has ended. You can close the mobile camera.'],
    };
    const mapped = errors[message];
    if (!mapped) throw error;
    res.status(mapped[0]).json({ error: mapped[1] });
  }
}

export const interviewMobileController = {
  pair(req: AuthRequest, res: Response) {
    return mobileAction(res, async () => {
      if (!req.user) throw new Error('SESSION_NOT_FOUND');
      return createMobilePairing(req.params.id, req.user.userId);
    });
  },
  status(req: AuthRequest, res: Response) {
    return mobileAction(res, async () => {
      if (!req.user) throw new Error('SESSION_NOT_FOUND');
      return getMobileStatus(req.params.id, req.user.userId);
    });
  },
  start(req: AuthRequest, res: Response) {
    return mobileAction(res, async () => {
      if (!req.user) throw new Error('SESSION_NOT_FOUND');
      return sessionPublicState(await startMobileInterview(req.params.id, req.user.userId));
    });
  },
  claim(req: Request, res: Response) {
    return mobileAction(res, () => claimMobilePairing(tokenSchema.parse(req.body?.token)));
  },
  heartbeat(req: Request, res: Response) {
    return mobileAction(res, () => mobileHeartbeat(deviceToken(req)));
  },
  photo(req: Request, res: Response) {
    return mobileAction(res, () => {
      if (!req.file || req.file.mimetype !== 'image/jpeg') throw new Error('MOBILE_IMAGE_INVALID');
      return submitMobilePhoto(deviceToken(req), z.string().regex(/^[a-f0-9]{32}$/).parse(req.body?.captureId), req.file.buffer);
    });
  },
};