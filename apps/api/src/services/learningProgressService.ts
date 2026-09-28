import { prisma } from '@codeforces/db';

export type CompleteLearningItemInput = {
  userId: string;
  courseId: string;
  courseKind?: 'catalog' | 'generated' | 'youtube';
  title?: string;
  itemId: string;
  itemType: 'tutorial' | 'module' | 'topic' | 'assignment' | 'video';
  itemTitle?: string;
  itemHref?: string;
  score?: number;
  totalCount?: number;
};

function utcDateString(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function daysBetweenUtc(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00.000Z`) - Date.parse(`${a}T00:00:00.000Z`);
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export async function touchLearningStreak(userId: string) {
  const today = utcDateString();
  const existing = await prisma.learningStreak.findUnique({ where: { userId } });

  if (!existing) {
    return prisma.learningStreak.create({
      data: {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
      },
    });
  }

  if (existing.lastActiveDate === today) {
    return existing;
  }

  const gap = existing.lastActiveDate ? daysBetweenUtc(existing.lastActiveDate, today) : 999;
  const currentStreak = gap === 1 ? existing.currentStreak + 1 : 1;
  const longestStreak = Math.max(existing.longestStreak, currentStreak);

  return prisma.learningStreak.update({
    where: { userId },
    data: {
      currentStreak,
      longestStreak,
      lastActiveDate: today,
    },
  });
}

async function recomputeProgress(progressId: string, totalCountHint?: number) {
  const items = await prisma.courseLearningItem.findMany({ where: { progressId } });
  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = Math.max(totalCountHint ?? 0, items.length, 1);
  const percent = Math.min(100, Math.round((completedCount / totalCount) * 100));
  const completed = percent >= 80 || (totalCount > 0 && completedCount >= totalCount);

  return prisma.courseLearningProgress.update({
    where: { id: progressId },
    data: {
      completedCount,
      totalCount,
      percent,
      completed,
      lastActivityAt: new Date(),
    },
    include: { items: true },
  });
}

export async function completeLearningItem(input: CompleteLearningItemInput) {
  const courseKind = input.courseKind || 'catalog';

  const progress = await prisma.courseLearningProgress.upsert({
    where: {
      userId_courseId: { userId: input.userId, courseId: input.courseId },
    },
    create: {
      userId: input.userId,
      courseId: input.courseId,
      courseKind,
      title: input.title,
      totalCount: input.totalCount ?? 0,
      lastItemId: input.itemId,
      lastItemTitle: input.itemTitle,
      lastItemHref: input.itemHref,
      lastActivityAt: new Date(),
    },
    update: {
      title: input.title ?? undefined,
      courseKind,
      lastItemId: input.itemId,
      lastItemTitle: input.itemTitle,
      lastItemHref: input.itemHref,
      lastActivityAt: new Date(),
      ...(typeof input.totalCount === 'number' ? { totalCount: input.totalCount } : {}),
    },
  });

  await prisma.courseLearningItem.upsert({
    where: {
      progressId_itemId: { progressId: progress.id, itemId: input.itemId },
    },
    create: {
      progressId: progress.id,
      itemId: input.itemId,
      itemType: input.itemType,
      title: input.itemTitle,
      completed: true,
      score: input.score ?? null,
      completedAt: new Date(),
    },
    update: {
      itemType: input.itemType,
      title: input.itemTitle ?? undefined,
      completed: true,
      score: input.score ?? undefined,
      completedAt: new Date(),
    },
  });

  const [updated, streak] = await Promise.all([
    recomputeProgress(progress.id, input.totalCount ?? progress.totalCount),
    touchLearningStreak(input.userId),
  ]);

  return { progress: updated, streak };
}

export async function getMyLearningSummary(userId: string) {
  const [courses, streak, enrollments] = await Promise.all([
    prisma.courseLearningProgress.findMany({
      where: { userId },
      include: { items: { orderBy: { updatedAt: 'desc' } } },
      orderBy: { lastActivityAt: 'desc' },
    }),
    prisma.learningStreak.findUnique({ where: { userId } }),
    prisma.enrollment.findMany({
      where: { userId },
      select: { productId: true, createdAt: true },
    }),
  ]);

  const continueLearning =
    courses.find((c) => c.lastItemHref && !c.completed) ||
    courses.find((c) => c.lastItemHref) ||
    null;

  return {
    courses,
    streak: streak || {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
    },
    enrollments,
    continueLearning: continueLearning
      ? {
          courseId: continueLearning.courseId,
          title: continueLearning.title,
          percent: continueLearning.percent,
          lastItemId: continueLearning.lastItemId,
          lastItemTitle: continueLearning.lastItemTitle,
          lastItemHref: continueLearning.lastItemHref,
          completed: continueLearning.completed,
        }
      : null,
  };
}

export async function getCourseLearningProgress(userId: string, courseId: string) {
  return prisma.courseLearningProgress.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: { items: true },
  });
}

/** Sync generated-notebook topic completion into CourseLearningProgress. */
export async function syncGeneratedTopicProgress(
  userId: string,
  topicId: string,
  opts?: { score?: number },
) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      unit: {
        include: {
          course: {
            include: {
              units: { include: { topics: { select: { id: true, title: true } } } },
            },
          },
        },
      },
    },
  });
  if (!topic) return null;

  const course = topic.unit.course;
  const allTopics = course.units.flatMap((u) => u.topics);
  const totalCount = allTopics.length;

  return completeLearningItem({
    userId,
    courseId: course.id,
    courseKind: 'generated',
    title: course.title,
    itemId: topic.id,
    itemType: 'topic',
    itemTitle: topic.title,
    itemHref: `/learn/notebook/${course.id}/topics/${topic.id}`,
    score: opts?.score,
    totalCount,
  });
}
