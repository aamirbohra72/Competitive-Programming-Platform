'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/DashboardShell';
import { api } from '@/lib/api';
import type { VideoTracksResponse } from '@/types/videos';

export default function VideosPage() {
  const [data, setData] = useState<VideoTracksResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<VideoTracksResponse>('/videos/tracks', { timeoutMs: 30_000 })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load videos'));
  }, []);

  const cw = data?.continueWatching;

  return (
    <DashboardShell navClassName="sticky top-0 z-50" mainClassName="min-h-0 overflow-y-auto p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="mb-2 font-nav-brand text-3xl font-semibold text-[var(--text-theme)]">Video Courses</h1>
        <p className="text-[var(--text-muted)]">Curated playlists with progress tracked just for you.</p>
      </div>

      {error && <p className="mb-4 text-red-700">{error}</p>}
      {!data && !error && <p className="text-[var(--text-muted)]">Loading videos…</p>}

      {cw?.lastVideoId && (
        <Link
          href={`/videos/${cw.playlistId}`}
          className="mb-8 block rounded-lg border border-green-300 bg-green-50 p-5 no-underline transition hover:border-green-500"
        >
          <p className="text-sm font-semibold text-green-700">Continue watching · {cw.percent}% complete</p>
          <p className="mt-1 text-lg font-semibold text-[var(--text-theme)]">{cw.playlistTitle}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Last watched: {cw.lastVideoTitle}</p>
        </Link>
      )}

      {data?.tracks.map((track) => (
        <section key={track.slug} className="mb-10">
          <h2 className="text-xl font-semibold text-[var(--text-theme)]">{track.title}</h2>
          <p className="mb-4 text-sm text-[var(--text-muted)]">{track.description}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-6">
            {track.playlists.map((p) => (
              <Link
                key={p.id}
                href={`/videos/${p.id}`}
                className="flex flex-col overflow-hidden rounded-lg border border-[var(--border-theme)] bg-white text-inherit no-underline transition hover:-translate-y-0.5 hover:border-green-500 hover:shadow-md hover:shadow-green-900/10"
              >
                {p.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail} alt="" className="aspect-video w-full object-cover" />
                )}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-semibold text-[var(--text-theme)]">{p.title}</h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {p.channelTitle} · {p.itemCount} videos
                  </p>
                  <div className="mt-auto pt-4">
                    <div className="h-1.5 w-full overflow-hidden rounded bg-green-100">
                      <div
                        className="h-full bg-green-700"
                        style={{ width: `${p.progress?.percent ?? 0}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {p.progress
                        ? `${p.progress.completedCount} watched · ${p.progress.percent}%`
                        : 'Not started'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </DashboardShell>
  );
}
