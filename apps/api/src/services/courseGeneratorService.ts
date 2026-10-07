import { prisma } from '@codeforces/db';
import { syncGeneratedTopicProgress } from './learningProgressService';
import {
  generateCourseStructure,
  generateMCQs,
  generateTopicContent,
  type CourseStructureDTO,
  type TopicType,
} from './groqCourseService';

const MAX_SOURCE_LENGTH = 50_000;

export type SourceType = 'text' | 'pdf' | 'topic';

export interface GenerateCourseInput {
  sourceType: SourceType;
  sourceContent: string;
  goal?: string;
  userId: string;
}

type TopicWorkItem = {
  topicId: string;
  title: string;
  type: string;
  unitContext: string;
};

type SanitizedMCQ = {
  id: string;
  question: string;
  options: string[];
  explanation: string;
};

export type SanitizedTopic = {
  id: string;
  unitId: string;
  title: string;
  type: string;
  order: number;
  estimatedMinutes: number;
  content: string;
  mcqs: SanitizedMCQ[];
  completed?: boolean;
  score?: number | null;
};

export type SanitizedUnit = {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  estimatedMinutes: number;
  tags: string[];
  topics: SanitizedTopic[];
};

export type SanitizedCourse = {
  id: string;
  title: string;
  description: string;
  sourceType: string;
  createdBy: string;
  createdAt: Date;
  units: SanitizedUnit[];
};

const courseInclude = {
  units: {
    orderBy: { order: 'asc' as const },
    include: {
      topics: {
        orderBy: { order: 'asc' as const },
        include: { mcqs: true },
      },
    },
  },
};

async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

function buildUnitContext(unit: CourseStructureDTO['units'][number], course: CourseStructureDTO): string {
  return `Course: ${course.title}\nUnit: ${unit.title}\nDescription: ${unit.description}\nTags: ${unit.tags.join(', ')}`;
}

export async function generateAndPersistCourse(input: GenerateCourseInput): Promise<SanitizedCourse> {
  const sourceContent = input.sourceContent.trim();
  if (!sourceContent) {
    throw new Error('sourceContent is required');
  }
  if (sourceContent.length > MAX_SOURCE_LENGTH) {
    throw new Error(`sourceContent exceeds ${MAX_SOURCE_LENGTH} characters`);
  }

  console.log('[courses] generating structure...');
  let structure: CourseStructureDTO;
  try {
    structure = await generateCourseStructure(sourceContent, input.goal);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[courses] structure generation failed:', msg);
    throw new Error(
      msg.includes('GROQ_API_KEY')
        ? msg
        : `AI outline failed: ${msg}. Check GROQ_API_KEY and API logs, then retry.`,
    );
  }
  console.log(
    '[courses] structure ready:',
    structure.title,
    `(${structure.units.length} units)`,
  );

  const course = await prisma.course.create({
    data: {
      title: structure.title,
      description: structure.description,
      sourceType: input.sourceType,
      sourceContent,
      createdBy: input.userId,
      units: {
        create: structure.units.map((unit) => ({
          title: unit.title,
          description: unit.description,
          order: unit.order,
          estimatedMinutes: unit.estimatedMinutes,
          tags: unit.tags,
          topics: {
            create: unit.topics.map((topic) => ({
              title: topic.title,
              type: topic.type,
              order: topic.order,
              estimatedMinutes: topic.estimatedMinutes,
              content: '',
            })),
          },
        })),
      },
    },
    include: courseInclude,
  });

  // Fill lessons/quizzes in the background so the HTTP response returns quickly.
  // The outline page polls until topic content is ready.
  void fillCourseContent(course.id, structure).catch((err) => {
    console.error('[courses] background content fill failed:', err);
  });

  return sanitizeCourse(course);
}

async function fillCourseContent(courseId: string, structure: CourseStructureDTO): Promise<void> {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    include: courseInclude,
  });

  const workItems: TopicWorkItem[] = [];
  for (const unit of course.units) {
    const structUnit = structure.units.find((u) => u.order === unit.order);
    const unitContext = structUnit
      ? buildUnitContext(structUnit, structure)
      : `Unit: ${unit.title}`;

    for (const topic of unit.topics) {
      workItems.push({
        topicId: topic.id,
        title: topic.title,
        type: topic.type,
        unitContext,
      });
    }
  }

  console.log(`[courses] filling ${workItems.length} topics for ${courseId}`);

  await batchProcess(workItems, 2, async (item) => {
    console.log(`[courses] writing topic: ${item.title}`);
    const content = await generateTopicContent(
      { title: item.title, type: item.type as TopicType },
      item.unitContext,
    );

    await prisma.topic.update({
      where: { id: item.topicId },
      data: { content },
    });

    if (item.type === 'diagnostic' || item.type === 'quiz') {
      const mcqs = await generateMCQs(content, 5);
      await prisma.mCQ.createMany({
        data: mcqs.map((mcq) => ({
          topicId: item.topicId,
          question: mcq.question,
          options: mcq.options,
          correctIndex: mcq.correctIndex,
          explanation: mcq.explanation,
        })),
      });
    }
  });

  console.log(`[courses] content fill completed for ${courseId}`);
}

function sanitizeMcq(mcq: {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}): SanitizedMCQ {
  return {
    id: mcq.id,
    question: mcq.question,
    options: mcq.options,
    explanation: mcq.explanation,
  };
}

function sanitizeCourse(
  course: {
    id: string;
    title: string;
    description: string;
    sourceType: string;
    createdBy: string;
    createdAt: Date;
    units: Array<{
      id: string;
      courseId: string;
      title: string;
      description: string;
      order: number;
      estimatedMinutes: number;
      tags: string[];
      topics: Array<{
        id: string;
        unitId: string;
        title: string;
        type: string;
        order: number;
        estimatedMinutes: number;
        content: string;
        mcqs: Array<{
          id: string;
          question: string;
          options: string[];
          correctIndex: number;
          explanation: string;
        }>;
      }>;
    }>;
  },
  progressMap?: Map<string, { completed: boolean; score: number | null }>,
): SanitizedCourse {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    sourceType: course.sourceType,
    createdBy: course.createdBy,
    createdAt: course.createdAt,
    units: course.units.map((unit) => ({
      id: unit.id,
      courseId: unit.courseId,
      title: unit.title,
      description: unit.description,
      order: unit.order,
      estimatedMinutes: unit.estimatedMinutes,
      tags: unit.tags,
      topics: unit.topics.map((topic) => {
        const progress = progressMap?.get(topic.id);
        return {
          id: topic.id,
          unitId: topic.unitId,
          title: topic.title,
          type: topic.type,
          order: topic.order,
          estimatedMinutes: topic.estimatedMinutes,
          content: topic.content,
          mcqs: topic.mcqs.map(sanitizeMcq),
          completed: progress?.completed,
          score: progress?.score ?? null,
        };
      }),
    })),
  };
}

export type GeneratedCourseSummary = {
  id: string;
  title: string;
  description: string;
  sourceType: string;
  createdAt: Date;
  unitCount: number;
  topicCount: number;
  estimatedMinutes: number;
};

export async function listGeneratedCoursesForUser(userId: string): Promise<GeneratedCourseSummary[]> {
  const courses = await prisma.course.findMany({
    where: { createdBy: userId },
    orderBy: { createdAt: 'desc' },
    include: {
      units: {
        include: {
          _count: { select: { topics: true } },
        },
      },
    },
  });

  return courses.map((course) => ({
    id: course.id,
    title: course.title,
    description: course.description,
    sourceType: course.sourceType,
    createdAt: course.createdAt,
    unitCount: course.units.length,
    topicCount: course.units.reduce((sum, u) => sum + u._count.topics, 0),
    estimatedMinutes: course.units.reduce((sum, u) => sum + u.estimatedMinutes, 0),
  }));
}

export async function getCourseById(id: string, userId?: string): Promise<SanitizedCourse | null> {
  const course = await prisma.course.findUnique({
    where: { id },
    include: courseInclude,
  });

  if (!course) return null;

  let progressMap: Map<string, { completed: boolean; score: number | null }> | undefined;
  if (userId) {
    const topicIds = course.units.flatMap((u) => u.topics.map((t) => t.id));
    const progressRows = await prisma.progress.findMany({
      where: { userId, topicId: { in: topicIds } },
    });
    progressMap = new Map(
      progressRows.map((p) => [p.topicId, { completed: p.completed, score: p.score }]),
    );
  }

  return sanitizeCourse(course, progressMap);
}

export async function markTopicComplete(userId: string, topicId: string): Promise<void> {
  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) {
    throw new Error('TOPIC_NOT_FOUND');
  }

  await prisma.progress.upsert({
    where: { userId_topicId: { userId, topicId } },
    create: { userId, topicId, completed: true },
    update: { completed: true },
  });

  await syncGeneratedTopicProgress(userId, topicId);
}

export interface QuizResult {
  score: number;
  total: number;
  results: Array<{ correct: boolean; explanation: string }>;
}

export async function scoreQuiz(
  userId: string,
  topicId: string,
  answers: number[],
): Promise<QuizResult> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { mcqs: true },
  });

  if (!topic) {
    throw new Error('TOPIC_NOT_FOUND');
  }

  if (topic.type !== 'diagnostic' && topic.type !== 'quiz') {
    throw new Error('TOPIC_NOT_QUIZ');
  }

  const mcqs = topic.mcqs;
  if (mcqs.length === 0) {
    throw new Error('NO_MCQS');
  }

  if (answers.length > mcqs.length) {
    throw new Error('INVALID_ANSWERS');
  }

  const results = mcqs.slice(0, answers.length).map((mcq, i) => {
    const selected = answers[i] ?? -1;
    const correct = selected === mcq.correctIndex;
    return { correct, explanation: mcq.explanation };
  });

  const score = results.filter((r) => r.correct).length;
  const total = mcqs.length;
  const allAnswered = answers.length === mcqs.length;

  if (allAnswered) {
    await prisma.progress.upsert({
      where: { userId_topicId: { userId, topicId } },
      create: { userId, topicId, completed: true, score },
      update: { completed: true, score },
    });
    await syncGeneratedTopicProgress(userId, topicId, {
      score: Math.round((score / Math.max(total, 1)) * 100),
    });
  }

  return { score, total, results };
}
