'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { PlaylistDetailResponse } from '@/types/videos';

type YTPlayer = {
  loadVideoById: (id: string) => void;
  destroy: () => void;
};

type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, number>;
      events?: { onStateChange?: (e: { data: number }) => void };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_ENDED = 0;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(s);
    }
  });
}

function formatDuration(sec: number | null): string {
  if (sec == null) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

function PlaylistPlayer() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [data, setData] = useState<PlaylistDetailResponse | null>(null);
  const [error, setError] = useState('');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const playerHost = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const onEndedRef = useRef<() => void>(() => {});

  useEffect(() => {
    setLoggedIn(!!getToken());
  }, []);

  useEffect(() => {
    api
      .get<PlaylistDetailResponse>(`/videos/playlists/${encodeURIComponent(playlistId)}`, {
        timeoutMs: 30_000,
      })
      .then((d) => {
        setData(d);
        setCompleted(new Set(d.completedVideoIds));
        const requested = searchParams.get('v');
        const valid = requested && d.videos.some((v) => v.videoId === requested);
        setCurrentId(valid ? requested : d.nextVideoId);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load playlist'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  const videos = useMemo(() => data?.videos ?? [], [data]);
  const current = videos.find((v) => v.videoId === currentId) ?? null;
  const percent = videos.length ? Math.round((completed.size / videos.length) * 100) : 0;

  const selectVideo = useCallback(
    (videoId: string) => {
      setCurrentId(videoId);
      router.replace(`/videos/${playlistId}?v=${videoId}`, { scroll: false });
    },
    [playlistId, router],
  );

  const markWatched = useCallback(
    async (videoId: string) => {
      if (!getToken()) return;
      setSaving(true);
      try {
        const res = await api.post<{ completedVideoIds: string[] }>(
          `/videos/playlists/${encodeURIComponent(playlistId)}/complete`,
          { videoId },
        );
        setCompleted(new Set(res.completedVideoIds));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save progress');
      } finally {
        setSaving(false);
      }
    },
    [playlistId],
  );

  onEndedRef.current = () => {
    if (!currentId) return;
    void markWatched(currentId);
    const idx = videos.findIndex((v) => v.videoId === currentId);
    const next = videos[idx + 1];
    if (next) selectVideo(next.videoId);
  };

  useEffect(() => {
    if (!currentId || !playerHost.current) return;
    if (player.current) {
      player.current.loadVideoById(currentId);
      return;
    }
    let cancelled = false;
    void loadYouTubeApi().then((YT) => {
      if (cancelled || !playerHost.current) return;
      // YT swaps this node for an iframe; keep it outside React's tree.
      const mount = document.createElement('div');
      playerHost.current.appendChild(mount);
      player.current = new YT.Player(mount, {
        videoId: currentId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === YT_ENDED) onEndedRef.current();
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  useEffect(() => () => player.current?.destroy(), []);

  return (
    <DashboardShell navClassName="sticky top-0 z-50" mainClassName="min-h-0 overflow-y-auto p-6">
      <Link href="/videos" className="text-sm text-[var(--text-muted)] no-underline hover:text-green-700">
        ← All video courses
      </Link>

      {error && <p className="mt-4 text-red-700">{error}</p>}
      {!data && !error && <p className="mt-4 text-[var(--text-muted)]">Loading playlist…</p>}

      {data && (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <div ref={playerHost} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />
            </div>
            {current && (
              <div className="mt-4">
                <h1 className="text-xl font-semibold">{current.title}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {loggedIn ? (
                    <button
                      type="button"
                      disabled={saving || completed.has(current.videoId)}
                      onClick={() => void markWatched(current.videoId)}
                      className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {completed.has(current.videoId) ? '✓ Watched' : saving ? 'Saving…' : 'Mark as watched'}
                    </button>
                  ) : (
                    <Link
                      href={`/sign-in?redirect_url=/videos/${playlistId}`}
                      className="text-sm font-semibold text-green-700"
                    >
                      Log in to track your progress
                    </Link>
                  )}
                </div>
                <p className="mt-4 whitespace-pre-line text-sm text-[var(--text-muted)]">{current.description}</p>
              </div>
            )}
          </div>

          <aside className="flex max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)]">
            <div className="border-b border-[var(--border-theme)] p-4">
              <h2 className="font-semibold">{data.playlist?.title}</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {data.playlist?.channelTitle} · {completed.size}/{videos.length} watched
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-green-100">
                <div className="h-full bg-green-700" style={{ width: `${percent}%` }} />
              </div>
            </div>
            <ol className="flex-1 overflow-y-auto">
              {videos.map((v, i) => {
                const active = v.videoId === currentId;
                return (
                  <li key={v.videoId}>
                    <button
                      type="button"
                      onClick={() => selectVideo(v.videoId)}
                      className={`flex w-full gap-3 p-3 text-left transition hover:bg-green-50 ${active ? 'bg-green-100' : ''}`}
                    >
                      <span className="w-6 shrink-0 pt-1 text-xs text-[var(--text-muted)]">
                        {completed.has(v.videoId) ? '✓' : i + 1}
                      </span>
                      {v.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.thumbnail} alt="" className="aspect-video w-28 shrink-0 rounded object-cover" />
                      )}
                      <span className="min-w-0">
                        <span className={`line-clamp-2 text-sm ${active ? 'font-semibold text-green-800' : 'text-[var(--text-theme)]'}`}>
                          {v.title}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">{formatDuration(v.durationSeconds)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
      )}
    </DashboardShell>
  );
}

export default function PlaylistPage() {
  return (
    <Suspense fallback={null}>
      <PlaylistPlayer />
    </Suspense>
  );
}
