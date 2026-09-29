'use client';

import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { cn } from '@/lib/cn';
import { ContinueLearningBanner } from '@/components/home/ContinueLearningBanner';

const quickLinks = [
  {
    href: '/learn',
    title: 'Browse courses',
    desc: 'Structured paths, DSA, React, and more — learn at your pace.',
    emoji: '📚',
    accent: 'from-amber-500 to-orange-600',
    cta: 'Open Courses',
  },
  {
    href: '/practice',
    title: 'Start practicing',
    desc: 'Solve challenges, filter by difficulty, and track your progress.',
    emoji: '⚡',
    accent: 'from-emerald-500 to-green-600',
    cta: 'Go to Practice',
  },
  {
    href: '/contests',
    title: 'Join contests',
    desc: 'Compete in timed rounds and climb the leaderboard.',
    emoji: '🏆',
    accent: 'from-blue-500 to-indigo-600',
    cta: 'View Contests',
  },
  {
    href: '/projects',
    title: 'Project ideas',
    desc: 'Full-stack prompts, domains, and tech stacks to build your portfolio.',
    emoji: '💡',
    accent: 'from-violet-500 to-purple-600',
    cta: 'Explore Projects',
  },
] as const;

function ActionCard({
  href,
  title,
  desc,
  emoji,
  accent,
  cta,
}: (typeof quickLinks)[number]) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border border-[var(--border-theme)] bg-white',
        'transition-all duration-200 hover:-translate-y-1 hover:border-green-400 hover:shadow-lg hover:shadow-green-900/10',
      )}
    >
      <div
        className={cn(
          'relative flex h-28 items-center justify-center bg-gradient-to-br text-4xl',
          accent,
        )}
      >
        <span aria-hidden className="drop-shadow-md">
          {emoji}
        </span>
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.12),transparent_50%)]"
          aria-hidden
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold text-[var(--text-theme)] group-hover:text-green-700">{title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--text-muted)]">{desc}</p>
        <span className="mt-4 inline-flex items-center text-sm font-semibold text-green-700">
          {cta}
          <span className="ml-1 transition-transform group-hover:translate-x-0.5" aria-hidden>
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

export function HomeLanding() {
  return (
    <div className="scroll-smooth pb-16">
      <section className="relative overflow-hidden border-b border-[var(--border-theme)] bg-[var(--surface-panel)] px-6 py-12 sm:px-8 lg:px-10 lg:py-16">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,197,94,0.12),transparent)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
            Codeforces Platform
          </p>
          <h1 className="font-nav-brand text-4xl font-bold leading-tight text-[var(--text-theme)] sm:text-5xl lg:text-6xl">
            <SignedIn>Welcome back.</SignedIn>
            <SignedOut>Build. Compete.</SignedOut>{' '}
            <span className="text-green-700">Ship faster.</span> Compete smarter.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--text-muted)]">
            A competitive programming hub for contests, curated courses, and daily practice — styled for focus, built for
            growth.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/learn"
              className="inline-flex rounded-lg bg-green-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Browse courses
            </Link>
            <Link
              href="/practice"
              className="inline-flex rounded-lg border border-[var(--border-theme)] bg-white px-6 py-3 text-sm font-semibold text-[var(--text-theme)] transition hover:border-green-400 hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
            >
              Start practicing
            </Link>
            <SignedOut>
              <Link
                href="/sign-in"
                className="inline-flex rounded-lg px-6 py-3 text-sm font-semibold text-[var(--text-muted)] transition hover:text-green-700"
              >
                Login
              </Link>
            </SignedOut>
          </div>
        </div>
      </section>

      <ContinueLearningBanner />

      <section className="px-6 py-12 sm:px-8 lg:px-10">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-theme)]">Jump in</h2>
            <p className="mt-1 text-[var(--text-muted)]">Pick a track to keep learning and building.</p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((item) => (
            <ActionCard key={item.href} {...item} />
          ))}
        </div>
      </section>

      <section className="mx-6 border-t border-[var(--border-theme)] bg-[var(--surface-panel)] px-6 py-8 sm:mx-8 lg:mx-10">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-theme)]">Ready for a contest?</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Check live and upcoming rounds — climb the leaderboard.</p>
          </div>
          <Link
            href="/contests"
            className="inline-flex shrink-0 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            View contests
          </Link>
        </div>
      </section>
    </div>
  );
}
