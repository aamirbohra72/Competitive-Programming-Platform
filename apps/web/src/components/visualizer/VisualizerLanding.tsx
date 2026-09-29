'use client';

import Link from 'next/link';
import { visualizerTracks } from '@/data/visualizer-tracks';
import { cn } from '@/lib/cn';

const STATUS_STYLES: Record<string, string> = {
  live: 'border-green-300 bg-green-50 text-green-800',
  bonus: 'border-amber-300 bg-amber-50 text-amber-800',
  new: 'border-sky-300 bg-sky-50 text-sky-800',
  'coming-soon': 'border-[var(--border-theme)] bg-[var(--surface-panel)] text-[var(--text-muted)]',
};

function HeroPreview() {
  const cells = [2, 7, 11, 15, 20, 25];
  return (
    <div className="rounded-lg border border-[var(--border-theme)] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        <span>two pointers · target 26</span>
        <span className="text-green-700">live</span>
      </div>
      <div className="flex items-end justify-center gap-2">
        {cells.map((v, i) => {
          const hot = i === 0 || i === 5;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-lg border text-sm font-semibold',
                  hot
                    ? 'border-green-400 bg-green-50 text-green-800'
                    : 'border-[var(--border-theme)] bg-[var(--surface-panel)] text-[var(--text-theme)]',
                )}
              >
                {v}
              </div>
              <span className="text-[10px] text-[var(--text-muted)]">[{i}]</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex justify-between px-2 text-xs">
        <span className="text-green-700">▲ left</span>
        <span className="text-sky-700">▲ right</span>
      </div>
      <p className="mt-3 rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] px-3 py-2 text-center text-sm text-[var(--text-muted)]">
        2 + 25 = 27 &gt; 26 — move right inward
      </p>
    </div>
  );
}

function ApproachPreview() {
  return (
    <div className="rounded-lg border border-[var(--border-theme)] bg-white p-5">
      <div className="mb-4 flex gap-4 text-sm">
        <span className="text-[var(--text-muted)]">Brute force</span>
        <span className="border-b-2 border-green-600 pb-0.5 font-medium text-[var(--text-theme)]">
          Optimized
        </span>
      </div>
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs text-[var(--text-muted)]">
            <span>time</span>
            <span className="font-mono">O(n²) → O(n)</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-green-100">
            <div className="h-full w-[28%] rounded-full bg-green-700" />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-[var(--text-muted)]">
            <span>space</span>
            <span className="font-mono">O(1)</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-green-100">
            <div className="h-full w-full rounded-full bg-green-700" />
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        Tap an approach to leap — the cost falls as you go.
      </p>
    </div>
  );
}

function TrackCard({
  track,
}: {
  track: (typeof visualizerTracks)[number];
}) {
  const playable = Boolean(track.href);
  const statusLabel =
    track.status === 'live'
      ? 'LIVE'
      : track.status === 'bonus'
        ? 'BONUS'
        : track.status === 'new'
          ? 'NEW'
          : 'SOON';

  const inner = (
    <article
      className={cn(
        'group flex h-full flex-col rounded-lg border border-[var(--border-theme)] bg-white p-5 transition',
        playable && 'hover:border-green-400 hover:bg-green-50',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-theme)]">{track.title}</h3>
          <p className="text-sm text-[var(--text-muted)]">{track.subtitle}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            STATUS_STYLES[track.status],
          )}
        >
          {statusLabel}
        </span>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-[var(--text-muted)]">{track.description}</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {track.tags.slice(0, 8).map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-[var(--border-theme)] bg-[var(--surface-panel)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]"
          >
            {tag}
          </span>
        ))}
        {track.tags.length > 8 ? (
          <span className="px-1 text-[11px] text-[var(--text-muted)]">+more</span>
        ) : null}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-[var(--border-theme)] pt-3 text-sm">
        <span className="text-[var(--text-muted)]">{track.stats}</span>
        {playable ? (
          <span className="font-medium text-green-700 group-hover:text-green-800">
            Enter →
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">Coming soon</span>
        )}
      </div>
    </article>
  );

  if (playable && track.href) {
    return (
      <Link href={track.href} className="block h-full">
        {inner}
      </Link>
    );
  }

  return inner;
}

export function VisualizerLanding() {
  return (
    <div className="min-h-screen w-full bg-[var(--surface-page)] text-[var(--text-theme)]">
      {/* Hero */}
      <section className="border-b border-[var(--border-theme)] bg-[var(--surface-panel)]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 lg:grid-cols-2 lg:items-center lg:py-20">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
              Watch the algorithm think
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Algorithms you can{' '}
              <span className="text-green-700">see.</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
              Every pattern, stepped through one frame at a time — pointers gliding,
              trees recursing, DP tables filling in. Browse 180+ interview patterns and
              press play to watch the idea unfold.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/visualizer/dsa"
                className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Start with DSA →
              </Link>
              <a
                href="#tracks"
                className="rounded-md border border-[var(--border-theme)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--text-theme)] transition hover:border-green-400 hover:text-green-700"
              >
                Choose a track
              </a>
            </div>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* Compare approaches */}
      <section className="border-b border-[var(--border-theme)]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 lg:grid-cols-2 lg:items-center">
          <ApproachPreview />
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Never stop at the{' '}
              <span className="text-green-700">first</span> answer.
            </h2>
            <p className="text-base leading-relaxed text-[var(--text-muted)]">
              Every problem carries its approaches side by side — the obvious brute force
              and the sharp optimization. Jump between them in a tap and watch the time and
              space complexity fall, so you learn the why, not just the trick.
            </p>
            <Link
              href="/visualizer/dsa"
              className="text-sm font-medium text-green-700 hover:text-green-800"
            >
              See it on a real problem →
            </Link>
          </div>
        </div>
      </section>

      {/* Pick a track */}
      <section id="tracks" className="py-14 sm:py-16">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Pick a track
            </h2>
            <p className="mt-2 text-[var(--text-muted)]">
              Codeforces Visual teaches each topic the same way — by animating it. Jump
              straight in.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {visualizerTracks.map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border-theme)] py-8 text-center text-xs text-[var(--text-muted)]">
        Codeforces Visual · step-by-step pattern animations
      </footer>
    </div>
  );
}
