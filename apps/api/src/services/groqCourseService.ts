import { z } from 'zod';
import { groqChat } from './groqAiService';
import { withRetry } from '../lib/retry';

const LARGE_MODEL = 'openai/gpt-oss-120b';
const SMALL_MODEL = 'openai/gpt-oss-20b';

const topicTypeSchema = z.enum([
  'diagnostic',
  'lesson',
  'guided_practice',
  'quiz',
  'summary',
]);

const topicStructureSchema = z.object({
  title: z.string().min(1),
  type: topicTypeSchema,
  order: z.number().int().positive(),
  estimatedMinutes: z.number().int().positive(),
});

const unitStructureSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  order: z.number().int().positive(),
  estimatedMinutes: z.number().int().positive(),
  tags: z.array(z.string()),
  topics: z.array(topicStructureSchema).min(1),
});

export const courseStructureSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  units: z.array(unitStructureSchema).min(1),
});

export type CourseStructureDTO = z.infer<typeof courseStructureSchema>;
export type TopicType = z.infer<typeof topicTypeSchema>;

export const mcqSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string(),
});

export const mcqListSchema = z.array(mcqSchema).min(1);

export type MCQDTO = z.infer<typeof mcqSchema>;

function extractJsonObject(raw: string): string {
  const t = raw.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (m) return m[1].trim();
  return t;
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (msg.includes('429') || msg.includes('rate limit')) return true;
  if (msg.includes('timed out') || msg.includes('timeout')) return true;
  if (/\b5\d{2}\b/.test(msg)) return true;
  if (msg.includes('json') || msg.includes('zod') || msg.includes('parse')) return true;
  return false;
}

function parseJson<T>(raw: string, schema: z.ZodType<T>): T {
  const text = extractJsonObject(raw);
  const parsed: unknown = JSON.parse(text);
  return schema.parse(parsed);
}

async function chatComplete(
  model: string,
  system: string,
  user: string,
  jsonMode: boolean,
): Promise<string> {
  return withRetry(
    () =>
      groqChat(system, user, {
        model,
        jsonMode,
      }),
    { attempts: 2, isRetryable: isRetryableError },
  );
}

const STRUCTURE_SYSTEM_PROMPT = `You are an expert curriculum designer. Output ONLY valid JSON matching this exact shape:
{
  "title": string,
  "description": string,
  "units": [{
    "title": string,
    "description": string,
    "order": number (1-based),
    "estimatedMinutes": number,
    "tags": string[],
    "topics": [{
      "title": string,
      "type": "diagnostic" | "lesson" | "guided_practice" | "quiz" | "summary",
      "order": number (1-based within unit),
      "estimatedMinutes": number
    }]
  }]
}

Rules:
- Create exactly 3 units with realistic time estimates.
- Each unit should have 2-4 topics (keep the course compact).
- The FIRST topic of the FIRST unit MUST be type "diagnostic".
- The LAST topic of the LAST unit MUST be type "summary".
- Include a mix of lesson, guided_practice, and quiz topics in between.
- Each unit needs 3-6 descriptive tags.
- No markdown, no commentary — JSON only.`;

export async function generateCourseStructure(
  sourceContent: string,
  goal?: string,
): Promise<CourseStructureDTO> {
  const userPrompt = JSON.stringify({
    sourceContent: sourceContent.slice(0, 12000),
    goal: goal ?? null,
  });

  // Structure uses small model for speed/reliability; content uses large.
  let raw = await chatComplete(SMALL_MODEL, STRUCTURE_SYSTEM_PROMPT, userPrompt, true);

  try {
    return parseJson(raw, courseStructureSchema);
  } catch (firstErr) {
    const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    const retryUser = `${userPrompt}\n\nPrevious response failed validation: ${errMsg}. Fix the JSON.`;
    raw = await chatComplete(SMALL_MODEL, STRUCTURE_SYSTEM_PROMPT, retryUser, true);
    return parseJson(raw, courseStructureSchema);
  }
}

export async function generateTopicContent(
  topic: { title: string; type: TopicType },
  unitContext: string,
): Promise<string> {
  const system = `You write high-quality educational markdown for a self-paced online course.
Write real teaching content (not a summary). Use headings, bullet lists, code blocks where appropriate.
The content must stand alone — a learner should understand the topic without other materials.
Topic type "${topic.type}" guidance:
- diagnostic: brief orientation + what will be assessed
- lesson: thorough explanation with examples
- guided_practice: step-by-step exercises with instructions
- quiz: short review material before the quiz
- summary: recap key takeaways and next steps
Return ONLY markdown, no JSON wrapper.`;

  const user = JSON.stringify({
    topicTitle: topic.title,
    topicType: topic.type,
    unitContext,
  });

  return chatComplete(LARGE_MODEL, system, user, false);
}

export async function generateMCQs(topicContent: string, count = 5): Promise<MCQDTO[]> {
  const system = `You create multiple-choice questions for an online course quiz.
Output ONLY valid JSON: { "mcqs": [{ "question": string, "options": [string,string,string,string], "correctIndex": 0-3, "explanation": string }] }
Each question must have exactly 4 options and one correct answer.`;

  const user = JSON.stringify({
    topicContent: topicContent.slice(0, 12000),
    count,
  });

  const raw = await chatComplete(SMALL_MODEL, system, user, true);
  const wrapperSchema = z.object({ mcqs: mcqListSchema });
  const parsed = parseJson(raw, wrapperSchema);
  return parsed.mcqs.slice(0, count);
}
