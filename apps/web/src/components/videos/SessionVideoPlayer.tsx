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

  return { videos, completed, loading, error, markWatched };
}

function formatDuration(sec: number | null): string {
  if (sec == null) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

type SessionVideoPlayerProps = {
  session: { title: string; meta?: string; dateLabel?: string };
  topicVideos: ReturnType<typeof useTopicVideos>;
  /** Opened in a new tab when no curated lectures match this session. */
  fallbackUrl: string;
  /** Fires whenever the learner starts a video (e.g. to award watch coins). */
  onStart?: () => void;
};

export function SessionVideoPlayer({ session, topicVideos, fallbackUrl, onStart }: SessionVideoPlayerProps) {
  const { videos, completed, loading, error, markWatched } = topicVideos;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getToken());
  }, []);

  const active = videos.find((v) => v.videoId === activeId) ?? null;
  const upNext = videos.find((v) => !completed.has(v.videoId)) ?? videos[0] ?? null;
  const hasVideos = videos.length > 0;

  const play = (videoId: string) => {
    onStart?.();
    setActiveId(videoId);
  };

  const startSession = () => {
    if (upNext) {
      play(upNext.videoId);
      return;
    }
    onStart?.();
    window.open(fallbackUrl, '_blank', 'noopener');
  };

  const metaLine = [
    session.meta,
    session.dateLabel,
    hasVideos ? `${completed.size}/${videos.length} lectures watched` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section>
      <div className="mb-3">
        <span className="inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          Session Recording
        </span>
        <h2 className="mt-2 text-xl font-bold text-[var(--text-theme)]">{session.title}</h2>
        {metaLine ? <p className="mt-1 text-sm text-[var(--text-muted)]">{metaLine}</p> : null}
      </div>

      <div className={hasVideos ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]' : 'max-w-3xl'}>
        <div>
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
            {active ? (
              <iframe
                key={active.videoId}
                src={`https://www.youtube-nocookie.com/embed/${active.videoId}?autoplay=1&rel=0&modestbranding=1`}
                title={active.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                onClick={startSession}
                disabled={loading}
                aria-label="Play session"
                className="group flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-600 to-violet-600 bg-cover bg-center"
                style={upNext?.thumbnail ? { backgroundImage: `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)), url(${upNext.thumbnail})` } : undefined}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-2xl text-blue-600 transition group-hover:scale-110">
                  ▶
                </span>
                <span className="max-w-[80%] text-center text-sm font-semibold text-white">
                  {loading ? 'Loading lectures…' : upNext ? `Up next: ${upNext.title}` : 'Watch recording'}
                </span>
              </button>
            )}
          </div>

          {active ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-[var(--text-muted)]">Now playing</p>
                <h3 className="text-base font-semibold text-[var(--text-theme)]">{active.title}</h3>
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/videos/${active.playlistId}?v=${active.videoId}`} className="text-xs font-semibold text-green-700">
                  Open in playlist →
                </Link>
                {loggedIn ? (
                  <button
                    type="button"
                    disabled={completed.has(active.videoId)}
                    onClick={() => void markWatched(active)}
                    className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {completed.has(active.videoId) ? '✓ Watched' : 'Mark lecture watched'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        </div>

        {hasVideos ? (
          <aside className="flex max-h-[28rem] flex-col overflow-hidden rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)]">
            <p className="border-b border-[var(--border-theme)] p-3 text-sm font-semibold text-[var(--text-theme)]">Lectures for this session</p>
            <ol className="flex-1 overflow-y-auto">
              {videos.map((v) => (
                <li key={v.videoId}>
                  <button
                    type="button"
                    onClick={() => play(v.videoId)}
                    className={`flex w-full gap-2 p-2.5 text-left hover:bg-green-50 ${v.videoId === activeId ? 'bg-green-100' : ''}`}
                  >
                    <span className="w-4 shrink-0 pt-0.5 text-xs text-green-700">{completed.has(v.videoId) ? '✓' : ''}</span>
                    {v.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnail} alt="" className="aspect-video w-24 shrink-0 rounded object-cover" />
                    )}
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-xs text-[var(--text-theme)]">{v.title}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">{formatDuration(v.durationSeconds)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
