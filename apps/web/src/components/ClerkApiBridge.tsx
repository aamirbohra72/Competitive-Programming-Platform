'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useRef } from 'react';
import { setToken, setUser, removeToken, removeUser, getToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api';

export function clearLocalAuth() {
  removeToken();
  removeUser();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth-changed'));
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Clerk is the only UI auth. After sign-in we exchange for our API JWT
 * so Express routes (leaderboard, courses, payments, etc.) keep working.
 */
export function ClerkApiBridge() {
  const { isSignedIn, isLoaded, getToken: getClerkToken } = useAuth();
  const exchanging = useRef(false);
  const pending = useRef(false);
  const lastSignedIn = useRef<boolean | null>(null);

  const runExchange = useCallback(async (): Promise<boolean> => {
    if (exchanging.current) {
      pending.current = true;
      return Boolean(getToken());
    }
    exchanging.current = true;
    try {
      do {
        pending.current = false;
        let ok = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const clerkToken = await getClerkToken({ skipCache: true });
          if (!clerkToken) {
            await sleep(400 * (attempt + 1));
            continue;
          }

          const res = await fetch(`${API_URL}/auth/clerk-exchange`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${clerkToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (res.ok) {
            const data = (await res.json()) as {
              token: string;
              user: { id: string; email: string; username: string; role: 'ADMIN' | 'USER' | 'TA' };
            };
            setToken(data.token);
            setUser(data.user);
            window.dispatchEvent(new Event('auth-changed'));
            ok = true;
            break;
          }

          if (res.status === 401) {
            await sleep(500 * (attempt + 1));
            continue;
          }

          const body = (await res.json().catch(() => ({}))) as { error?: string };
          console.error('[ClerkApiBridge]', body.error || res.statusText);
          break;
        }
        if (ok && !pending.current) return true;
      } while (pending.current);

      return Boolean(getToken());
    } catch (err) {
      console.error('[ClerkApiBridge] exchange failed', err);
      return Boolean(getToken());
    } finally {
      exchanging.current = false;
    }
  }, [getClerkToken]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      if (lastSignedIn.current === true) {
        clearLocalAuth();
      }
      lastSignedIn.current = false;
      return;
    }

    lastSignedIn.current = true;
    void runExchange();
  }, [isLoaded, isSignedIn, runExchange]);

  // Re-exchange when API reports 401, or when the tab becomes visible again
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const onReauth = () => {
      void runExchange();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runExchange();
    };

    window.addEventListener('auth-reexchange', onReauth);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('auth-reexchange', onReauth);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isLoaded, isSignedIn, runExchange]);

  return null;
}

/** Ask ClerkApiBridge to mint a fresh API JWT. Resolves after a short wait. */
export async function ensureApiSession(timeoutMs = 4000): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new Event('auth-reexchange'));
  const start = Date.now();
  const previous = getToken();
  while (Date.now() - start < timeoutMs) {
    await sleep(200);
    const next = getToken();
    if (next && next !== previous) return true;
    if (next) return true;
  }
  return Boolean(getToken());
}
