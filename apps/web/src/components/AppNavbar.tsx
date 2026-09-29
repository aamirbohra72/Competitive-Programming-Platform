'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { getUser, getToken, isAdmin } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { SidebarTrigger } from '@/components/SidebarTrigger';
import { SupportCompanion } from '@/components/support/SupportCompanion';

export type AppNavbarProps = {
  className?: string;
  activeHref?: string;
  activePage?: string;
};

const PRIMARY_LINKS = [
  { href: '/practice', label: 'Practice' },
  { href: '/learn', label: 'Courses' },
  { href: '/contests', label: 'Contests' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/blog', label: 'Blog' },
  { href: '/billing', label: 'Billing' },
  { href: '/affiliate', label: 'Affiliate' },
  { href: '/referral', label: 'Referral' },
] as const;

function linkIsActive(pathname: string, href: string, override?: string) {
  if (override) {
    return override === href || (href !== '/' && override.startsWith(href));
  }
  if (pathname === href) return true;
  if (
    href === '/leaderboard' ||
    href === '/blog' ||
    href === '/projects' ||
    href === '/billing' ||
    href === '/affiliate' ||
    href === '/referral'
  ) {
    return pathname === href;
  }
  return pathname.startsWith(`${href}/`);
}

export function AppNavbar({ className, activeHref, activePage }: AppNavbarProps) {
  const pathname = usePathname() ?? '';
  const resolvedActive = activeHref ?? activePage;
  const [username, setUsername] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [streak, setStreak] = useState(0);

  const refreshLocalProfile = useCallback(() => {
    const u = getUser();
    setUsername(u?.username ?? null);
    setIsAdminUser(isAdmin());
    const raw = typeof window !== 'undefined' ? localStorage.getItem('streak') : null;
    setStreak(parseInt(raw ?? '0', 10) || 0);
  }, []);

  useEffect(() => {
    refreshLocalProfile();
    const onAuth = () => refreshLocalProfile();
    window.addEventListener('auth-changed', onAuth);
    window.addEventListener('learning-progress:updated', onAuth);
    return () => {
      window.removeEventListener('auth-changed', onAuth);
      window.removeEventListener('learning-progress:updated', onAuth);
    };
  }, [refreshLocalProfile]);

  useEffect(() => {
    if (!getToken()) return;
    void api
      .get<{ streak: { currentStreak: number } }>('/progress/me')
      .then((data) => {
        const n = data.streak?.currentStreak || 0;
        localStorage.setItem('streak', String(n));
        setStreak(n);
      })
      .catch(() => undefined);
  }, []);

  return (
    <nav
      role="navigation"
      aria-label="Main"
      className={cn('border-b border-nav-border bg-nav-bg text-[var(--text-theme)]', className)}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
        <div className="relative z-10 flex shrink-0 items-center gap-2 bg-nav-bg sm:gap-3">
          <SidebarTrigger />
          <Link
            href="/"
            className="font-nav-brand truncate text-xl font-bold tracking-tight text-[var(--text-theme)] transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Codeforces
          </Link>
        </div>

        <div className="hidden min-w-0 flex-1 items-center overflow-x-auto md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-x-0.5 lg:gap-x-1">
            {PRIMARY_LINKS.map(({ href, label }) => {
              const active = linkIsActive(pathname, href, resolvedActive);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-green-50 hover:text-[var(--text-theme)] lg:px-2.5',
                    active && 'bg-green-50 !text-[var(--accent-theme)]',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-x-2 bg-nav-bg sm:gap-x-3">
          <SupportCompanion />
          <SignedIn>
            {isAdminUser && (
              <Link
                href="/admin/dashboard"
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:bg-green-50 hover:text-[var(--text-theme)]',
                  pathname.startsWith('/admin') && 'bg-green-50 !text-[var(--accent-theme)]',
                )}
              >
                Admin
              </Link>
            )}
            <Link
              href="/submissions"
              className={cn(
                  'hidden rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:bg-green-50 hover:text-[var(--text-theme)] sm:inline-block',
                  pathname.startsWith('/submissions') && 'bg-green-50 !text-[var(--accent-theme)]',
              )}
            >
              Submissions
            </Link>
            <div
              className="hidden items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-400 sm:flex"
              title="Streak"
            >
              <span className="text-base" aria-hidden>
                🔥
              </span>
              <span className="text-xs font-semibold">{streak} Day Streak</span>
            </div>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'h-8 w-8',
                },
              }}
            >
              <UserButton.MenuItems>
                {username ? (
                  <UserButton.Link label="My profile" href={`/${username}`} labelIcon={<span>👤</span>} />
                ) : null}
                <UserButton.Link label="Submissions" href="/submissions" labelIcon={<span>📝</span>} />
                <UserButton.Link label="Billing" href="/billing" labelIcon={<span>💳</span>} />
              </UserButton.MenuItems>
            </UserButton>
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                Login
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-md border border-[var(--border-theme)] px-3 py-1.5 text-sm font-medium text-[var(--text-theme)] hover:bg-green-50"
              >
                Sign up
              </button>
            </SignUpButton>
          </SignedOut>
        </div>
      </div>
    </nav>
  );
}
