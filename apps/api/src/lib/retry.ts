function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (msg.includes('429') || msg.includes('rate limit')) return true;
  if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('etimedout')) return true;
  if (msg.includes('econnreset') || msg.includes('econnrefused') || msg.includes('enotfound')) return true;
  if (msg.includes('fetch failed') || msg.includes('socket hang up') || msg.includes('network')) return true;
  if (/\b5\d{2}\b/.test(msg)) return true;
  return false;
}

/**
 * Retry transient I/O (Razorpay / Mistral / Brevo). Never retries 4xx except 429.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; isRetryable?: (err: unknown) => boolean } = {},
): Promise<T> {
  const attempts = options.attempts ?? 2;
  const isRetryable = options.isRetryable ?? isRetryableNetworkError;
  let lastError: unknown;
  for (let attempt = 0; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= attempts || !isRetryable(err)) {
        throw err;
      }
      const delayMs = 400 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
