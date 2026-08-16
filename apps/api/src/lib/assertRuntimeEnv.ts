const DEFAULT_JWT_SECRETS = new Set([
  '',
  'your-secret-key-change-in-production',
  'change-me',
  'change-me-in-production',
]);

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function paymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED !== 'false';
}

/**
 * Fail closed in production when secrets / database / payment keys are missing.
 */
export function assertRuntimeEnv(): void {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required');
  }

  if (!isProduction()) return;

  const jwt = process.env.JWT_SECRET?.trim() ?? '';
  if (DEFAULT_JWT_SECRETS.has(jwt)) {
    throw new Error(
      'JWT_SECRET is missing or using a default value. Set a strong secret before starting in production.',
    );
  }

  if (paymentsEnabled()) {
    if (!process.env.RAZORPAY_KEY_ID?.trim() || !process.env.RAZORPAY_KEY_SECRET?.trim()) {
      throw new Error(
        'Razorpay keys are required in production (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET). Set PAYMENTS_ENABLED=false to disable payments.',
      );
    }
    if (!process.env.RAZORPAY_WEBHOOK_SECRET?.trim()) {
      throw new Error(
        'RAZORPAY_WEBHOOK_SECRET is required in production so paid enrollments survive a closed checkout tab.',
      );
    }
  }
}
