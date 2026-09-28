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
    <DashboardShell navClassName="sticky top-0 z-50" mainClassName="min-h-0 overflow-y-auto p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-semibold">Video Courses</h1>
        <p className="text-[#b0b0b0]">Curated playlists with progress tracked just for you.</p>
      </div>

      {error && <p className="mb-4 text-red-400">{error}</p>}
      {!data && !error && <p className="text-[#b0b0b0]">Loading videos…</p>}

      {cw?.lastVideoId && (
        <Link
          href={`/videos/${cw.playlistId}`}
          className="mb-8 block rounded-xl border border-dashed border-[#22c55e] bg-[#22c55e]/10 p-5 no-underline"
        >
          <p className="text-sm text-[#22c55e]">Continue watching · {cw.percent}% complete</p>
          <p className="mt-1 text-lg font-semibold text-white">{cw.playlistTitle}</p>
          <p className="mt-1 text-sm text-[#b0b0b0]">Last watched: {cw.lastVideoTitle}</p>
        </Link>
      )}

      {data?.tracks.map((track) => (
        <section key={track.slug} className="mb-10">
          <h2 className="text-xl font-semibold">{track.title}</h2>
          <p className="mb-4 text-sm text-[#b0b0b0]">{track.description}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
            {track.playlists.map((p) => (
              <Link
                key={p.id}
                href={`/videos/${p.id}`}
                className="flex flex-col overflow-hidden rounded-xl border border-[#3a3a3a] bg-[#2a2a2a] text-inherit no-underline transition hover:-translate-y-0.5 hover:border-[#22c55e]"
              >
                {p.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail} alt="" className="aspect-video w-full object-cover" />
                )}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-semibold text-white">{p.title}</h3>
                  <p className="mt-1 text-xs text-[#b0b0b0]">
                    {p.channelTitle} · {p.itemCount} videos
                  </p>
                  <div className="mt-auto pt-4">
                    <div className="h-1.5 w-full overflow-hidden rounded bg-[#3a3a3a]">
                      <div
                        className="h-full bg-[#22c55e]"
                        style={{ width: `${p.progress?.percent ?? 0}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-[#b0b0b0]">
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
