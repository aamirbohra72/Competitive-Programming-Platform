import { Suspense } from 'react';
import LoginRedirectClient from './LoginRedirectClient';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--surface-panel)] text-[var(--text-muted)]">
          Redirecting to sign in…
        </div>
      }
    >
      <LoginRedirectClient />
    </Suspense>
  );
}
