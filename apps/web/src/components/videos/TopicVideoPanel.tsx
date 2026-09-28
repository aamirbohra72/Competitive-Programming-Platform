'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { PlaylistVideo } from '@/types/videos';

export type VideoTopic = { track: string; keywords: string[] };
export type TopicVideo = PlaylistVideo & { playlistId: string };

export function useTopicVideos(topic: VideoTopic | undefined) {
  const [videos, setVideos] = useState<TopicVideo[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const track = topic?.track;
  const keywords = topic?.keywords.join(',');

  useEffect(() => {
    if (!track || !keywords) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ track, keywords, limit: '15' });
    api
      .get<{ videos: TopicVideo[]; completedVideoIds: string[] }>(`/videos/topic?${qs}`, { timeoutMs: 30_000 })
      .then((d) => {
        if (cancelled) return;
        setVideos(d.videos);
        setCompleted(new Set(d.completedVideoIds));
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load videos'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [track, keywords]);

  const markWatched = useCallback(async (v: TopicVideo) => {
    if (!getToken()) return;
    try {
      await api.post(`/videos/playlists/${encodeURIComponent(v.playlistId)}/complete`, { videoId: v.videoId });
      setCompleted((prev) => new Set(prev).add(v.videoId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save progress');
    }
  }, []);

  const firstUnwatched = videos.find((v) => !completed.has(v.videoId)) ?? videos[0] ?? null;

  return { videos, completed, loading, error, markWatched, firstUnwatched };
}

function formatDuration(sec: number | null): string {
  if (sec == null) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

type PanelProps = ReturnType<typeof useTopicVideos> & {
  activeId: string | null;
  onSelect: (videoId: string) => void;
};

export function TopicVideoPanel({ videos, completed, loading, error, markWatched, activeId, onSelect }: PanelProps) {
  const active = videos.find((v) => v.videoId === activeId) ?? null;
  const loggedIn = typeof window !== 'undefined' && !!getToken();

  if (loading) return <p className="mt-4 text-sm text-[#b0b0b0]">Loading topic lectures…</p>;
  if (error && !videos.length) return <p className="mt-4 text-sm text-red-400">{error}</p>;
  if (!videos.length) return null;

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        {active ? (
          <>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                key={active.videoId}
                src={`https://www.youtube-nocookie.com/embed/${active.videoId}?autoplay=1&rel=0&modestbranding=1`}
                title={active.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">{active.title}</h3>
              {loggedIn ? (
                <button
                  type="button"
                  disabled={completed.has(active.videoId)}
                  onClick={() => void markWatched(active)}
                  className="rounded-md bg-[#22c55e] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {completed.has(active.videoId) ? '✓ Watched' : 'Mark lecture watched'}
                </button>
              ) : null}
            </div>
            <Link
              href={`/videos/${active.playlistId}?v=${active.videoId}`}
              className="mt-1 inline-block text-xs text-[#22c55e]"
            >
              Open in full playlist →
            </Link>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(videos.find((v) => !completed.has(v.videoId))?.videoId ?? videos[0].videoId)}
            className="flex aspect-video w-full items-center justify-center rounded-xl border border-[#3a3a3a] bg-[#1f1f1f] text-[#b0b0b0] hover:text-white"
          >
            ▶ Start topic lectures
          </button>
        )}
      </div>

      <aside className="flex max-h-[28rem] flex-col overflow-hidden rounded-xl border border-[#3a3a3a] bg-[#242424]">
        <div className="border-b border-[#3a3a3a] p-3">
          <p className="text-sm font-semibold">Lectures for this topic</p>
          <p className="text-xs text-[#b0b0b0]">
            {completed.size}/{videos.length} watched
          </p>
        </div>
        <ol className="flex-1 overflow-y-auto">
          {videos.map((v) => (
            <li key={v.videoId}>
              <button
                type="button"
                onClick={() => onSelect(v.videoId)}
                className={`flex w-full gap-2 p-2.5 text-left hover:bg-[#333] ${v.videoId === activeId ? 'bg-[#22c55e]/15' : ''}`}
              >
                <span className="w-4 shrink-0 pt-0.5 text-xs text-[#22c55e]">{completed.has(v.videoId) ? '✓' : ''}</span>
                {v.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail} alt="" className="aspect-video w-24 shrink-0 rounded object-cover" />
                )}
                <span className="min-w-0">
                  <span className="line-clamp-2 text-xs text-[#ddd]">{v.title}</span>
                  <span className="text-[11px] text-[#888]">{formatDuration(v.durationSeconds)}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
