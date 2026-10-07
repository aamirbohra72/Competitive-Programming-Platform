export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly expose: boolean;

  constructor(code: string, httpStatus: number, message?: string, expose = true) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.expose = expose;
  }
}

export function unauthenticated(): AppError {
  return new AppError('UNAUTHENTICATED', 401, 'Authentication required');
}

export function requireUserId(userId: string | undefined): string {
  if (!userId) throw unauthenticated();
  return userId;
}

/** Known Error.message codes from services that still throw plain Error. */
export const KNOWN_ERROR_CODES: Record<string, { status: number; message: string }> = {
  RAZORPAY_KEYS_MISSING: { status: 503, message: 'Razorpay is not configured' },
  RAZORPAY_WEBHOOK_SECRET_MISSING: { status: 503, message: 'Razorpay webhook is not configured' },
  PRODUCT_NOT_FOUND: { status: 404, message: 'Product not found' },
  ALREADY_ENROLLED: { status: 409, message: 'Already enrolled in this product' },
  INVALID_SIGNATURE: { status: 400, message: 'Payment signature verification failed' },
  ORDER_NOT_FOUND: { status: 404, message: 'Payment order not found' },
  ORDER_NOT_FULFILLABLE: { status: 409, message: 'Payment could not be fulfilled' },
  ENROLLMENT_REQUIRED: { status: 402, message: 'Enrollment required for this course' },
  AI_CREDIT_REQUIRED: {
    status: 402,
    message: 'AI course credit required. Buy it on the Billing page, then try again.',
  },
  JUDGE_BUSY: { status: 429, message: 'Judge is busy, try again shortly' },
  COURSE_NOT_LLM_ENABLED: { status: 404, message: 'This course is not configured for live LLM content.' },
  GROQ_API_KEY_MISSING: { status: 503, message: 'Groq is not configured (missing GROQ_API_KEY).' },
  TUTORIAL_NOT_FOUND: { status: 404, message: 'Resource not found.' },
  TOPIC_NOT_FOUND: { status: 404, message: 'Topic not found' },
  TOPIC_NOT_QUIZ: { status: 400, message: 'This topic does not have a quiz' },
  NO_MCQS: { status: 400, message: 'No quiz questions available for this topic' },
  REQUEST_NOT_FOUND: { status: 404, message: 'Help request not found' },
  NOT_CLAIMABLE: { status: 409, message: 'Request is not available to claim' },
  FORBIDDEN: { status: 403, message: 'Not allowed' },
  EMPTY_REPLY: { status: 400, message: 'Reply cannot be empty' },
  USER_NOT_FOUND: { status: 404, message: 'User not found' },
};
