import { z } from 'zod';
import { groqChatJson } from './groqAiService';
import { cacheDel, cacheGet, cacheSet } from './redisService';

const questionSchema = z.object({
  id: z.string(),
  type: z.enum(['multiple_choice', 'short_answer', 'long_answer']),
  marks: z.number(),
  question: z.string(),
  options: z.array(z.string()).optional(),
  correct_answer: z.string().optional(),
  expected_answer: z.string().optional(),
  explanation: z.string(),
});

const flashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
});

const notesSchema = z.object({
  title: z.string(),
  introduction: z.string(),
  keyConcepts: z
    .array(
      z.object({
        heading: z.string(),
        body: z.string(),
      }),
    )
    .min(2),
});

const tutorialSchema = z.object({
  id: z.string(),
  title: z.string(),
  dateLabel: z.string(),
  duration: z.string(),
  estimatedTimeLeft: z.string(),
  videoTitle: z.string(),
  videoMeta: z.string(),
  questions: z.array(questionSchema).min(6).max(10),
  flashcards: z.array(flashcardSchema).min(6).max(12),
  notes: notesSchema,
  coinsPerCorrect: z.number().default(2),
  completionBonusCoins: z.number().default(8),
  watchSessionCoins: z.number().default(3),
});

const packSchema = z.object({
  courseId: z.string(),
  courseTitle: z.string(),
  topic: z.string(),
  generatedAt: z.string().optional(),
  source: z.literal('llm').default('llm'),
  tutorials: z.array(tutorialSchema).min(2).max(4),
});

export type LlmCoursePack = z.infer<typeof packSchema>;

const memoryCache = new Map<string, { expiresAt: number; pack: LlmCoursePack }>();

const COURSE_PROFILES: Record<
  string,
  { title: string; topic: string; focus: string }
> = {
  '3': {
    title: 'Salaam React',
    topic: 'React.js and modern JavaScript frontend',
    focus:
      'ONLY React + JavaScript frontend concepts: hooks, components, state, props, effects, context, performance, forms, routing, patterns. Do NOT include backend, system design infra, databases, Kafka, Redis, or Java/Python.',
  },
};

function extractJsonObject(raw: string): string {
  const t = raw.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (m) return m[1].trim();
  return t;
}

function cacheKey(courseId: string) {
  return `course-pack:llm:${courseId}`;
}

export function isLlmCourse(courseId: string): boolean {
  return Boolean(COURSE_PROFILES[courseId]);
}

export function listLlmCourseIds(): string[] {
  return Object.keys(COURSE_PROFILES);
}

async function generatePackWithLlm(courseId: string): Promise<LlmCoursePack> {
  const profile = COURSE_PROFILES[courseId];
  if (!profile) {
    throw new Error('COURSE_NOT_LLM_ENABLED');
  }

  if (!process.env.GROQ_API_KEY?.trim()) {
    throw new Error('GROQ_API_KEY_MISSING');
  }

  const system = `You are a senior React/JavaScript curriculum designer.
Return STRICT JSON only (no markdown). Content must be educational, accurate, and interview-relevant.
Scope lock: ${profile.focus}`;

  const user = `Create a live course pack for "${profile.title}" (courseId="${courseId}").

Return JSON with this shape:
{
  "courseId": "${courseId}",
  "courseTitle": "${profile.title}",
  "topic": "${profile.topic}",
  "source": "llm",
  "tutorials": [
    {
      "id": "react-t1",
      "title": "Day 1 — ...",
      "dateLabel": "Sun, 12 Jul 2026",
      "duration": "2h 00m",
      "estimatedTimeLeft": "3 hours left",
      "videoTitle": "...",
      "videoMeta": "7:00 PM · Recording available",
      "coinsPerCorrect": 2,
      "completionBonusCoins": 8,
      "watchSessionCoins": 3,
      "questions": [
        {
          "id": "Q1",
          "type": "multiple_choice",
          "marks": 4,
          "question": "...",
          "options": ["A","B","C","D"],
          "correct_answer": "exact option text",
          "explanation": "..."
        }
      ],
      "flashcards": [{ "id": "f1", "front": "...", "back": "..." }],
      "notes": {
        "title": "Revision Notes: ...",
        "introduction": "...",
        "keyConcepts": [{ "heading": "...", "body": "..." }]
      }
    }
  ]
}

Hard requirements:
- Exactly 3 tutorials: react-t1, react-t2, react-t3
- Each tutorial: exactly 8 questions (mix mostly multiple_choice, 1-2 short_answer allowed)
- Each tutorial: 8 flashcards
- Each tutorial notes: introduction + exactly 4 keyConcepts
- Question ids Q1..Q8 local to each tutorial
- For multiple_choice: correct_answer MUST exactly match one options[] string
- Content ONLY about React/JS frontend`;

  const raw = await groqChatJson(system, user);
  const parsed = packSchema.parse(JSON.parse(extractJsonObject(raw)));
  return {
    ...parsed,
    courseId,
    courseTitle: profile.title,
    topic: profile.topic,
    source: 'llm',
    generatedAt: new Date().toISOString(),
  };
}

export async function getCoursePack(
  courseId: string,
  opts: { refresh?: boolean } = {},
): Promise<LlmCoursePack> {
  if (!isLlmCourse(courseId)) {
    throw new Error('COURSE_NOT_LLM_ENABLED');
  }

  const key = cacheKey(courseId);
  const now = Date.now();

  if (!opts.refresh) {
    const mem = memoryCache.get(key);
    if (mem && mem.expiresAt > now) return mem.pack;

    const cached = await cacheGet(key);
    if (cached) {
      const pack = packSchema.parse(JSON.parse(cached));
      memoryCache.set(key, { pack, expiresAt: now + 60 * 60 * 1000 });
      return pack;
    }
  }

  const pack = await generatePackWithLlm(courseId);
  memoryCache.set(key, { pack, expiresAt: now + 60 * 60 * 1000 });
  await cacheSet(key, JSON.stringify(pack), 60 * 60 * 24);
  return pack;
}

export async function getCourseTutorial(courseId: string, tutorialId: string, refresh = false) {
  const pack = await getCoursePack(courseId, { refresh });
  const tutorial = pack.tutorials.find((t) => t.id === tutorialId);
  if (!tutorial) throw new Error('TUTORIAL_NOT_FOUND');
  return { packMeta: { courseId: pack.courseId, courseTitle: pack.courseTitle, topic: pack.topic, generatedAt: pack.generatedAt, source: pack.source }, tutorial };
}

export async function invalidateCoursePack(courseId: string) {
  const key = cacheKey(courseId);
  memoryCache.delete(key);
  await cacheDel(key);
}
