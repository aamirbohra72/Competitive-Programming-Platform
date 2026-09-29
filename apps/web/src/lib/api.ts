import { getToken, setToken, removeToken } from '@/lib/auth';

const configuredApiUrl = (
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api'
).replace(/\/+$/, '');
const API_URL = configuredApiUrl.endsWith('/api')
  ? configuredApiUrl
  : `${configuredApiUrl}/api`;

export interface ApiError {
  error: string;
  details?: unknown;
}

type RequestOptions = RequestInit & {
  /** Abort after this many ms (useful for long Mistral calls). */
  timeoutMs?: number;
  /** Internal: already retried after a re-exchange */
  _retriedAuth?: boolean;
};

function networkHint(endpoint: string): string {
  const isGenerate = endpoint.includes('/generate') || endpoint.includes('/pack');
  if (isGenerate) {
    return 'Network error talking to the API (connection reset or timeout). Course outline generation can take up to 2 minutes — wait and retry, confirm the API is on http://127.0.0.1:3001, and check the API terminal for Mistral errors.';
  }
  return 'Network error talking to the API. Ensure the API is running on http://127.0.0.1:3001 and that you are signed in.';
}

async function waitForFreshToken(timeoutMs = 3500): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  window.dispatchEvent(new Event('auth-reexchange'));
  const start = Date.now();
  const previous = getToken();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 200));
    const next = getToken();
    if (next && next !== previous) return next;
    if (!previous && next) return next;
  }
  return getToken();
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? getToken() : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const { timeoutMs, _retriedAuth, ...fetchInit } = options;
  const controller = typeof timeoutMs === 'number' ? new AbortController() : null;
  const timer =
    controller && timeoutMs
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : null;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...fetchInit,
      headers,
      signal: controller?.signal ?? fetchInit.signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${Math.round((timeoutMs || 0) / 1000)}s. ${networkHint(endpoint)}`,
      );
    }
    if (err instanceof TypeError) {
      throw new Error(networkHint(endpoint));
    }
    throw err;
  } finally {
    if (timer) window.clearTimeout(timer);
  }

  if (!response.ok) {
    let message = 'An error occurred';
    try {
      const errBody = (await response.json()) as ApiError & { message?: string };
      message = errBody.error || errBody.message || message;
    } catch {
      message = `${response.status} ${response.statusText}`;
    }

    // Stale API JWT or failed clerk-exchange — refresh once and retry
    if (
      response.status === 401 &&
      !_retriedAuth &&
      typeof window !== 'undefined' &&
      !endpoint.includes('/auth/clerk-exchange')
    ) {
      removeToken();
      const fresh = await waitForFreshToken();
      if (fresh) {
        setToken(fresh);
        return request<T>(endpoint, { ...options, _retriedAuth: true });
      }
      throw new Error(
        'Session expired. Sync your Windows clock (Settings → Time → Sync now), then sign out and sign in again.',
      );
    }

    if (response.status === 401) {
      message =
        message === 'An error occurred' || message === 'Invalid or expired token'
          ? 'Session expired. Sync your Windows clock (Settings → Time → Sync now), then sign out and sign in again.'
          : message;
    }
    throw new Error(message);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string, options?: { timeoutMs?: number }) =>
    request<T>(endpoint, { method: 'GET', timeoutMs: options?.timeoutMs }),
  post: <T>(endpoint: string, data?: unknown, options?: { timeoutMs?: number }) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      timeoutMs: options?.timeoutMs,
    }),
  postForm: async <T>(endpoint: string, formData: FormData): Promise<T> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    }).catch((err: unknown) => {
      const hint =
        'Network error talking to the API (connection reset or timeout). Ensure the API is running on http://127.0.0.1:3001.';
      if (err instanceof TypeError) {
        throw new Error(hint);
      }
      throw err;
    });
    if (!response.ok) {
      let message = 'An error occurred';
      try {
        const errBody = (await response.json()) as ApiError & { message?: string };
        message = errBody.error || errBody.message || message;
      } catch {
        message = `${response.status} ${response.statusText}`;
      }
      throw new Error(message);
    }
    return response.json();
  },
  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
