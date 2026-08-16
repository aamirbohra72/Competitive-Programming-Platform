import jwt from 'jsonwebtoken';
import type { UserRole } from '@codeforces/types';

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export function generateToken(payload: JWTPayload): string {
  // @ts-expect-error - jsonwebtoken types have issues with expiresIn string values
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): JWTPayload {
  try {
    // Tolerate small OS clock drift when verifying our own API JWTs
    return jwt.verify(token, JWT_SECRET, { clockTolerance: 60 }) as JWTPayload;
  } catch {
    throw new Error('Invalid or expired token');
  }
}

// Export OTP utilities
export * from './otp';
