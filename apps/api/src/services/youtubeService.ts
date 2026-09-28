import { AppError } from '../lib/errors';
import { cacheGet, cacheSet } from './redisService';

const YT_API = 'https://www.googleapis.com/youtube/v3';
const CACHE_TTL_SECONDS = 6 * 60 * 60;
const MAX_VIDEOS_PER_PLAYLIST = 300;

export type VideoTrack = {
  slug: string;
  title: string;
  instructor: string;
  description: string;
  playlistIds: string[];
};

// Only curated playlists are served, so the API key can't be used to proxy arbitrary YouTube queries.
export const VIDEO_TRACKS: VideoTrack[] = [
  {
    slug: 'react',
    title: 'React with Akshay Saini',
    instructor: 'Akshay Saini',
    description: 'Namaste React and frontend machine-coding rounds using React.',
    playlistIds: ['PLlasXeu85E9dg5N37gDfclwzTqtoW7h5j', 'PLlasXeu85E9cciv04MYWscodnbRFqACsH'],
  },
  {
    slug: 'chai-react',
    title: 'Chai aur React with Hitesh Choudhary',
    instructor: 'Hitesh Choudhary',
    description: 'React from JSX and hooks to router, context, Redux Toolkit and a production mega project.',
    playlistIds: ['PLu71SKxNbfoDqgPchmvIsL4hTnJIrtige'],
  },
  {
    slug: 'node',
    title: 'Chai aur JavaScript Backend with Hitesh Choudhary',
    instructor: 'Hitesh Choudhary',
    description: 'Node.js backend: project setup, Express routing, MongoDB modelling, JWT auth and deployment.',
    playlistIds: ['PLu71SKxNbfoBGh_8p_NS-ZAh6v7HhYqHW'],
  },
  {
    slug: 'dsa',
    title: 'DSA with Shradha Khapra',
    instructor: 'Shradha Khapra',
    description: 'Complete C++ DSA course plus topic-wise deep dives for interviews.',
    playlistIds: [
      'PLfqMhTWNBTe137I_EPQd34TsgV6IO55pt',
      'PLGjplNEQ1it-OKRcYlCEDpTiIB1YOcvn6',
      'PLGjplNEQ1it-kmrbYmzQfLWjVOFj6JpEV',
      'PLGjplNEQ1it-W0hmxxAB1P2XP2fZiYuUu',
      'PLGjplNEQ1it-0w_PkFtKzH0ZExo6Lvm6R',
    ],
  },
  {
    slug: 'javascript',
    title: 'Namaste JavaScript with Akshay Saini',
    instructor: 'Akshay Saini',
    description: 'Execution context, hoisting, closures, event loop, promises and async/await.',
    playlistIds: ['PLlasXeu85E9cQ32gLCvAvr9vNaUccPVNP', 'PLlasXeu85E9eWOpw9jxHOQyGMRiBZ60aX'],
  },
  {
    slug: 'python',
    title: 'Python with Shradha Khapra',
    instructor: 'Shradha Khapra',
    description: 'Python full course: data types, collections, loops, functions, file I/O and OOP.',
    playlistIds: ['PLGjplNEQ1it8-0CmoljS5yeV-GlKSUEt0'],
  },
  {
    slug: 'system-design',
    title: 'System Design with The Desi Architect',
    instructor: 'The Desi Architect',
    description: 'Zero to Architect, interview cheat codes, caching and real Indian-scale case studies.',
    playlistIds: [
      'PLAqYPSK9xbanG0KUXdGiqILNrirM1sDzN',
      'PLAqYPSK9xbanrKpqEv6mEZkpafKoFgiv8',
      'PLGDkQASsRwX0',
      'PLAqYPSK9xbakfls7VHqI9aq3WEdf3p8RT',
      'PLAqYPSK9xbamC417fbJG14POtVuX91w2v',
      'PLAqYPSK9xbanS_sXS9nK0T3hTf9Sl587r',
    ],
  },
];

export type PlaylistMeta = {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnail: string | null;
  itemCount: number;
};

export type PlaylistVideo = {
  videoId: string;
  position: number;
  title: string;
  description: string;
  thumbnail: string | null;
  durationSeconds: number | null;
};

type YtThumbs = Record<string, { url: string } | undefined> | undefined;

const memoryCache = new Map<string, { expiresAt: number; value: string }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > Date.now()) return JSON.parse(mem.value) as T;

  const hit = await cacheGet(key);
  if (hit) return JSON.parse(hit) as T;

  const value = await load();
  const raw = JSON.stringify(value);
  memoryCache.set(key, { expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000, value: raw });
  await cacheSet(key, raw, CACHE_TTL_SECONDS);
  return value;
}

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw new AppError('YOUTUBE_NOT_CONFIGURED', 503, 'YouTube integration is not configured');
  return key;
}

async function ytGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: apiKey() });
  const res = await fetch(`${YT_API}/${path}?${qs.toString()}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error('YouTube API error', res.status, await res.text().catch(() => ''));
    throw new AppError('YOUTUBE_UPSTREAM_ERROR', 502, 'Failed to load videos from YouTube');
  }
  return (await res.json()) as T;
}

function bestThumb(thumbs: YtThumbs): string | null {
  if (!thumbs) return null;
  return (thumbs.maxres ?? thumbs.high ?? thumbs.medium ?? thumbs.default)?.url ?? null;
}

/** ISO-8601 duration (PT1H2M3S) -> seconds. */
function parseDuration(iso: string | undefined): number | null {
  const m = iso?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function isCuratedPlaylist(playlistId: string): boolean {
  return VIDEO_TRACKS.some((t) => t.playlistIds.includes(playlistId));
}

export type TopicVideo = PlaylistVideo & { playlistId: string; score: number };

const NON_LECTURE = /quick update|major update|life update|views|subscribers party|trailer|setup c\+\+ compiler/;

/** Pick videos round-robin across topic keywords so every sub-topic gets coverage, then return in lecture order. */
export async function findTopicVideos(
  trackSlug: string,
  keywords: string[],
  limit: number,
): Promise<TopicVideo[]> {
  const track = VIDEO_TRACKS.find((t) => t.slug === trackSlug);
  if (!track) throw new AppError('TRACK_NOT_FOUND', 404, 'Track not found');

  const terms = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  const lists = await Promise.all(track.playlistIds.map((id) => getPlaylistVideos(id)));

  const seen = new Set<string>();
  const all: (TopicVideo & { order: number; lower: string })[] = [];
  lists.forEach((videos, listIdx) => {
    for (const v of videos) {
      if (seen.has(v.videoId)) continue;
      seen.add(v.videoId);
      const lower = v.title.toLowerCase();
      if (NON_LECTURE.test(lower)) continue;
      const score = terms.filter((t) => lower.includes(t)).length;
      if (score > 0) {
        all.push({ ...v, playlistId: track.playlistIds[listIdx], score, lower, order: listIdx * 10_000 + v.position });
      }
    }
  });

  const buckets = terms.map((t) => all.filter((v) => v.lower.includes(t)));
  const picked = new Map<string, (typeof all)[number]>();
  while (picked.size < limit && buckets.some((b) => b.length)) {
    for (const bucket of buckets) {
      if (picked.size >= limit) break;
      let next = bucket.shift();
      while (next && picked.has(next.videoId)) next = bucket.shift();
      if (next) picked.set(next.videoId, next);
    }
  }

  return [...picked.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, lower: _lower, ...v }) => v);
}


export function findTrackForPlaylist(playlistId: string): VideoTrack | undefined {
  return VIDEO_TRACKS.find((t) => t.playlistIds.includes(playlistId));
}

export async function getPlaylistsMeta(ids: string[]): Promise<PlaylistMeta[]> {
  const key = `yt:playlists:${[...ids].sort().join(',')}`;
  const list = await cached(key, async () => {
    const data = await ytGet<{
      items: {
        id: string;
        snippet: { title: string; description: string; channelTitle: string; thumbnails: YtThumbs };
        contentDetails: { itemCount: number };
      }[];
    }>('playlists', { part: 'snippet,contentDetails', id: ids.join(','), maxResults: '50' });
    return data.items.map<PlaylistMeta>((p) => ({
      id: p.id,
      title: p.snippet.title,
      description: p.snippet.description,
      channelTitle: p.snippet.channelTitle,
      thumbnail: bestThumb(p.snippet.thumbnails),
      itemCount: p.contentDetails.itemCount,
    }));
  });
  return ids.map((id) => list.find((p) => p.id === id)).filter((p): p is PlaylistMeta => !!p);
}

export async function getPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
  if (!isCuratedPlaylist(playlistId)) {
    throw new AppError('PLAYLIST_NOT_FOUND', 404, 'Playlist not found');
  }

  return cached(`yt:playlist-videos:${playlistId}`, async () => {
    const videos: PlaylistVideo[] = [];
    let pageToken = '';
    do {
      const page = await ytGet<{
        nextPageToken?: string;
        items: {
          snippet: {
            title: string;
            description: string;
            position: number;
            thumbnails: YtThumbs;
            resourceId: { videoId: string };
          };
        }[];
      }>('playlistItems', {
        part: 'snippet',
        playlistId,
        maxResults: '50',
        ...(pageToken ? { pageToken } : {}),
      });
      for (const item of page.items) {
        const s = item.snippet;
        if (s.title === 'Private video' || s.title === 'Deleted video') continue;
        videos.push({
          videoId: s.resourceId.videoId,
          position: s.position,
          title: s.title,
          description: s.description.slice(0, 500),
          thumbnail: bestThumb(s.thumbnails),
          durationSeconds: null,
        });
      }
      pageToken = page.nextPageToken ?? '';
    } while (pageToken && videos.length < MAX_VIDEOS_PER_PLAYLIST);

    for (let i = 0; i < videos.length; i += 50) {
      const chunk = videos.slice(i, i + 50);
      const details = await ytGet<{ items: { id: string; contentDetails: { duration: string } }[] }>(
        'videos',
        { part: 'contentDetails', id: chunk.map((v) => v.videoId).join(',') },
      );
      for (const d of details.items) {
        const v = chunk.find((x) => x.videoId === d.id);
        if (v) v.durationSeconds = parseDuration(d.contentDetails.duration);
      }
    }

    return videos.sort((a, b) => a.position - b.position);
  });
}
