import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '@codeforces/db';
import { AuthRequest } from '../middleware/auth';
import { AppError, requireUserId } from '../lib/errors';
import { completeLearningItem } from '../services/learningProgressService';
import {
  VIDEO_TRACKS,
  findTrackForPlaylist,
  findTopicVideos,
  getPlaylistVideos,
  getPlaylistsMeta,
  isCuratedPlaylist,
} from '../services/youtubeService';

const courseIdFor = (playlistId: string) => `yt:${playlistId}`;

const completeSchema = z.object({
  videoId: z.string().regex(/^[\w-]{6,20}$/),
});

const topicSchema = z.object({
  track: z.string().min(1).max(40),
  keywords: z
    .string()
    .min(1)
    .max(600)
    .transform((s) => s.split(',').map((k) => k.trim()).filter((k) => k.length > 0 && k.length <= 60).slice(0, 20)),
  limit: z.coerce.number().int().min(1).max(30).default(12),
});

async function userProgressMap(userId: string | undefined, playlistIds: string[]) {
  if (!userId) return new Map<string, { percent: number; completedCount: number; lastItemId: string | null; lastItemTitle: string | null; lastActivityAt: Date }>();
  const rows = await prisma.courseLearningProgress.findMany({
    where: { userId, courseId: { in: playlistIds.map(courseIdFor) } },
    select: {
      courseId: true,
      percent: true,
      completedCount: true,
      lastItemId: true,
      lastItemTitle: true,
      lastActivityAt: true,
    },
  });
  return new Map(rows.map((r) => [r.courseId.slice(3), r]));
}

export const videoController = {
  async topicVideos(req: AuthRequest, res: Response): Promise<void> {
    const q = topicSchema.parse(req.query);
    const videos = await findTopicVideos(q.track, q.keywords, q.limit);

    let completedVideoIds: string[] = [];
    const userId = req.user?.userId;
    if (userId && videos.length) {
      const items = await prisma.courseLearningItem.findMany({
        where: {
          completed: true,
          itemId: { in: videos.map((v) => v.videoId) },
          progress: { userId, courseKind: 'youtube' },
        },
        select: { itemId: true },
      });
      completedVideoIds = items.map((i) => i.itemId);
    }

    res.json({ videos, completedVideoIds });
  },
  async listTracks(req: AuthRequest, res: Response): Promise<void> {
    const allIds = VIDEO_TRACKS.flatMap((t) => t.playlistIds);
    const [metas, progress] = await Promise.all([
      getPlaylistsMeta(allIds),
      userProgressMap(req.user?.userId, allIds),
    ]);

    const tracks = VIDEO_TRACKS.map((t) => ({
      slug: t.slug,
      title: t.title,
      instructor: t.instructor,
      description: t.description,
      playlists: metas
        .filter((m) => t.playlistIds.includes(m.id))
        .map((m) => {
          const p = progress.get(m.id);
          return {
            ...m,
            progress: p
              ? {
                  percent: p.percent,
                  completedCount: p.completedCount,
                  lastVideoId: p.lastItemId,
                  lastVideoTitle: p.lastItemTitle,
                  lastActivityAt: p.lastActivityAt,
                }
              : null,
          };
        }),
    }));

    const recent = [...progress.entries()]
      .filter(([, p]) => p.percent < 100)
      .sort((a, b) => b[1].lastActivityAt.getTime() - a[1].lastActivityAt.getTime())[0];
    const continueWatching = recent
      ? {
          playlistId: recent[0],
          playlistTitle: metas.find((m) => m.id === recent[0])?.title ?? null,
          lastVideoId: recent[1].lastItemId,
          lastVideoTitle: recent[1].lastItemTitle,
          percent: recent[1].percent,
        }
      : null;

    res.json({ tracks, continueWatching });
  },

  async getPlaylist(req: AuthRequest, res: Response): Promise<void> {
    const playlistId = String(req.params.playlistId || '');
    if (!isCuratedPlaylist(playlistId)) {
      throw new AppError('PLAYLIST_NOT_FOUND', 404, 'Playlist not found');
    }

    const [[meta], videos] = await Promise.all([
      getPlaylistsMeta([playlistId]),
      getPlaylistVideos(playlistId),
    ]);

    let completedVideoIds: string[] = [];
    let lastVideoId: string | null = null;
    const userId = req.user?.userId;
    if (userId) {
      const progress = await prisma.courseLearningProgress.findUnique({
        where: { userId_courseId: { userId, courseId: courseIdFor(playlistId) } },
        include: { items: { where: { completed: true }, select: { itemId: true } } },
      });
      completedVideoIds = progress?.items.map((i) => i.itemId) ?? [];
      lastVideoId = progress?.lastItemId ?? null;
    }

    const done = new Set(completedVideoIds);
    const lastIdx = lastVideoId ? videos.findIndex((v) => v.videoId === lastVideoId) : -1;
    const nextVideo =
      videos.slice(lastIdx + 1).find((v) => !done.has(v.videoId)) ??
      videos.find((v) => !done.has(v.videoId)) ??
      videos[0] ??
      null;

    res.json({
      playlist: meta ?? null,
      track: findTrackForPlaylist(playlistId)?.slug ?? null,
      videos,
      completedVideoIds,
      nextVideoId: nextVideo?.videoId ?? null,
    });
  },

  async completeVideo(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const playlistId = String(req.params.playlistId || '');
    const { videoId } = completeSchema.parse(req.body);

    const videos = await getPlaylistVideos(playlistId);
    const video = videos.find((v) => v.videoId === videoId);
    if (!video) throw new AppError('VIDEO_NOT_FOUND', 404, 'Video not in this playlist');

    const [meta] = await getPlaylistsMeta([playlistId]);
    const result = await completeLearningItem({
      userId,
      courseId: courseIdFor(playlistId),
      courseKind: 'youtube',
      title: meta?.title,
      itemId: videoId,
      itemType: 'video',
      itemTitle: video.title,
      itemHref: `/videos/${playlistId}?v=${videoId}`,
      totalCount: Math.min(Math.max(videos.length, 1), 500),
    });

    res.json({
      percent: result.progress.percent,
      completedVideoIds: result.progress.items.filter((i) => i.completed).map((i) => i.itemId),
      streak: result.streak,
    });
  },
};
