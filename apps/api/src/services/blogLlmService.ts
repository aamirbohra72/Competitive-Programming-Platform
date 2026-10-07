import { z } from 'zod';
import { groqChat } from './groqAiService';
import { cacheDel, cacheGet, cacheSet } from './redisService';

const CACHE_KEY = 'blog-hub:live:v1';
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour
const memoryCache = new Map<string, { expiresAt: number; pack: BlogHub }>();

const categorySchema = z
  .string()
  .transform((v) => {
    const n = v.toLowerCase().replace(/\s+/g, '-');
    if (n.includes('system')) return 'system-design';
    if (n.includes('chain') || n.includes('solana') || n.includes('crypto') || n.includes('web3')) {
      return 'blockchain';
    }
    if (n.includes('career') || n.includes('interview') || n.includes('job')) return 'careers';
    if (n.includes('contest') || n.includes('compet')) return 'contest';
    if (n.includes('algo') || n.includes('dsa')) return 'algorithms';
    if (n.includes('genai') || n.includes('gen-ai') || n.includes('agent') || n === 'ai' || n.startsWith('ai-')) {
      return 'genai';
    }
    if (n.includes('gen')) return 'genai';
    return 'algorithms';
  });

const postSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(3),
  author: z.union([z.string().min(1), z.null()]).optional().transform((v) => v || 'Editorial'),
  date: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v && String(v).length >= 4 ? String(v) : new Date().toISOString().slice(0, 10))),
  excerpt: z.string().min(8),
  readMinutes: z.coerce.number().int().min(2).max(30).catch(6),
  tags: z
    .array(z.string())
    .optional()
    .transform((t) => (t && t.length ? t.slice(0, 5) : ['Engineering'])),
  category: categorySchema.catch('algorithms'),
  featured: z.boolean().optional().default(false),
  body: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((b) => {
      if (Array.isArray(b)) return b.map((x) => String(x).trim()).filter((x) => x.length >= 8).slice(0, 10);
      if (typeof b === 'string' && b.trim()) {
        return b
          .split(/\n\n+/)
          .map((x) => x.trim())
          .filter((x) => x.length >= 8)
          .slice(0, 10);
      }
      return [] as string[];
    }),
});

const hubSchema = z.object({
  generatedAt: z.string(),
  source: z.literal('groq'),
  headline: z.string().default('Live engineering notes'),
  summary: z.string().default('Fresh articles generated for builders.'),
  posts: z.array(z.unknown()).min(1),
});

export type BlogLivePost = z.infer<typeof postSchema> & { source: 'groq' };
export type BlogHub = Omit<z.infer<typeof hubSchema>, 'posts'> & {
  posts: BlogLivePost[];
};

function extractJsonObject(raw: string): string {
  const t = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/m.exec(t);
  const candidate = (fenced ? fenced[1] : t).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) return candidate.slice(start, end + 1);
  return candidate;
}

/** Soft-repair common LLM JSON issues (trailing commas, smart quotes). */
function softRepairJson(text: string): string {
  return text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

/** Pull complete `{...}` objects from a truncated `"posts": [...]` array. */
function salvagePostsArray(text: string): unknown[] {
  const marker = /"posts"\s*:\s*\[/.exec(text);
  if (!marker || marker.index == null) return [];
  const from = text.indexOf('[', marker.index);
  if (from < 0) return [];

  const posts: unknown[] = [];
  let i = from + 1;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i += 1;
    if (i >= text.length || text[i] === ']') break;
    if (text[i] !== '{') break;

    let depth = 0;
    let inString = false;
    let escape = false;
    const start = i;
    for (; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const slice = softRepairJson(text.slice(start, i + 1));
          try {
            posts.push(JSON.parse(slice));
          } catch {
            /* skip broken object */
          }
          i += 1;
          break;
        }
      }
    }
    if (depth !== 0) break;
  }
  return posts;
}

function parseLlmJson(raw: string): unknown {
  const extracted = extractJsonObject(raw);
  const attempts = [extracted, softRepairJson(extracted)];

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      /* try next */
    }
  }

  const salvaged = salvagePostsArray(extracted);
  if (salvaged.length > 0) {
    return {
      generatedAt: new Date().toISOString(),
      source: 'groq',
      headline: 'Live engineering notes',
      summary: 'Fresh articles generated for builders.',
      posts: salvaged,
    };
  }

  throw new SyntaxError('Unable to parse blog hub JSON from model output');
}

function buildFallbackHub(): BlogHub {
  const today = new Date().toISOString().slice(0, 10);
  const posts: BlogLivePost[] = [
    {
      id: 'ai-contest-warmup-checklist',
      title: 'Contest Warmup Checklist That Actually Helps',
      author: 'Editorial',
      date: today,
      excerpt: 'A short pre-round ritual so you stop burning the first 10 minutes on setup mistakes.',
      readMinutes: 5,
      tags: ['Contest', 'DSA'],
      category: 'contest',
      featured: true,
      body: [
        'Open the problemset and skim constraints before writing any code. Mark A/B as “implementation” vs “idea” so you pick the right first solve.',
        'Keep a personal snippet pack for I/O, binary search, DSU, and modular arithmetic. Paste, then adapt — do not retype under time pressure.',
        'If stuck for 12–15 minutes, write a brute force or switch problems. Contest ranking rewards solved count more than sunk-cost perfection.',
      ],
      source: 'groq',
    },
    {
      id: 'ai-system-design-latency-budget',
      title: 'Latency Budgets for APIs You Can Defend in Interviews',
      author: 'Editorial',
      date: today,
      excerpt: 'Break p99 into network, app, and datastore slices — then decide where caching actually pays off.',
      readMinutes: 7,
      tags: ['System Design', 'Backend'],
      category: 'system-design',
      featured: true,
      body: [
        'Start with a target: e.g. p99 < 200ms for reads. Allocate budget to DNS/TLS, app CPU, DB, and downstream calls before picking tech.',
        'Cache only after measuring hot keys. Prefer read-through with TTL + soft refresh over “cache everything” that hides consistency bugs.',
        'Document failure modes: cache stampede, thundering herd, and stale reads. Interviewers care that you name the tradeoffs.',
      ],
      source: 'groq',
    },
    {
      id: 'ai-rag-eval-playbook',
      title: 'A Minimal RAG Eval Loop Before You Ship Agents',
      author: 'Editorial',
      date: today,
      excerpt: 'Skip vibe-checks: score retrieval hit-rate and answer faithfulness on a tiny golden set.',
      readMinutes: 6,
      tags: ['GenAI', 'Agents'],
      category: 'genai',
      featured: false,
      body: [
        'Build 20–40 labeled questions with expected source docs. Measure recall@k for retrieval before tuning the LLM prompt.',
        'Grade answers for groundedness: does each claim cite retrieved context? Fail closed when retrieval is empty.',
        'Only then add tools/agents. Tool loops amplify bad retrieval — fix the index and chunking first.',
      ],
      source: 'groq',
    },
    {
      id: 'ai-solana-hackathon-scope',
      title: 'Scoping a Solana Hackathon MVP in One Weekend',
      author: 'Editorial',
      date: today,
      excerpt: 'Ship one user journey on-chain; leave the marketplace and social graph for after the demo.',
      readMinutes: 6,
      tags: ['Blockchain', 'Solana'],
      category: 'blockchain',
      featured: false,
      body: [
        'Pick a single happy path: create → confirm → display state. Prefer one program instruction with clear accounts over a kitchen-sink IDL.',
        'Use local validator + a scripted seed for demos. Judges hate waiting on mainnet congestion mid-pitch.',
        'Write the README like a product brief: problem, why Solana, architecture diagram, and how to reproduce the demo in under three minutes.',
      ],
      source: 'groq',
    },
    {
      id: 'ai-interview-story-bank',
      title: 'Build a Story Bank for Behavioral Rounds',
      author: 'Editorial',
      date: today,
      excerpt: 'Five reusable stories beat twenty vague anecdotes when interview panels dig into conflict and ownership.',
      readMinutes: 5,
      tags: ['Careers', 'Interview'],
      category: 'careers',
      featured: false,
      body: [
        'Maintain stories for: conflict, failure, mentoring, ambiguous requirements, and measurable impact. Use situation → action → result.',
        'Quantify outcomes (latency, revenue, reliability, team velocity). If you cannot measure it, tighten the story until you can.',
        'Practice out loud at 90 seconds. Panels interrupt — your structure should survive a mid-story pivot.',
      ],
      source: 'groq',
    },
    {
      id: 'ai-dsa-pattern-drill',
      title: 'Pattern Drills Beat Random Problem Grinding',
      author: 'Editorial',
      date: today,
      excerpt: 'Rotate two-pointers, graphs, DP, and greedy in short focused blocks instead of endless random queues.',
      readMinutes: 5,
      tags: ['Algorithms', 'Practice'],
      category: 'algorithms',
      featured: false,
      body: [
        'Spend 45–60 minutes on one pattern with 3 problems of rising difficulty. Write the invariant in one sentence before coding.',
        'After each AC, note the failure mode you almost hit (off-by-one, visited set, modulo). That note compounds more than another random Easy.',
        'Weekly: redo one problem from cold start without looking at your old code. Retention is the real rating gain.',
      ],
      source: 'groq',
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    source: 'groq',
    headline: 'Engineering notes for builders',
    summary: 'Curated articles while live generation is unavailable.',
    posts,
  };
}

function normalizePosts(rawPosts: unknown[]): BlogLivePost[] {
  const seen = new Set<string>();
  const posts: BlogLivePost[] = [];
  for (const rawPost of rawPosts) {
    const result = postSchema.safeParse(rawPost);
    if (!result.success) continue;
    const p = result.data;
    let id = p.id.startsWith('ai-') ? p.id : `ai-${p.id}`;
    id = id.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    const body =
      p.body.length >= 2
        ? p.body
        : [
            p.excerpt,
            'Key takeaway: ship a small, measurable improvement first, then expand coverage with tests and metrics.',
            'Next step: pick one pattern from this note and apply it in your next practice session or hackathon sprint.',
          ];
    posts.push({
      id,
      title: p.title,
      author: p.author,
      date: p.date,
      excerpt: p.excerpt,
      readMinutes: p.readMinutes,
      tags: p.tags,
      category: p.category as BlogLivePost['category'],
      featured: Boolean(p.featured),
      body,
      source: 'groq',
    });
  }
  return posts;
}

const SYSTEM = `You are a technical editor for a competitive programming and software engineering platform.
Write crisp, practical blog posts. Output ONLY valid JSON. No markdown fences. Keep body paragraphs short.`;

const USER_PROMPT = `Generate a fresh engineering blog pack for builders who practice DSA, ship systems, and join hackathons.

Themes to cover across the pack (mix them):
- Algorithms / contest strategy
- System design
- GenAI / Agentic AI / AI agents
- Blockchain / Solana Colosseum style builder notes
- Careers / interview prep

Schema:
{
  "generatedAt": ISO string,
  "source": "groq",
  "headline": string,
  "summary": string,
  "posts": [
    {
      "id": string (slug like "ai-rag-eval-playbook"),
      "title": string,
      "author": string (realistic first+last or handle),
      "date": "YYYY-MM-DD",
      "excerpt": string (1-2 sentences),
      "readMinutes": number,
      "tags": string[],
      "category": "algorithms"|"system-design"|"genai"|"blockchain"|"careers"|"contest",
      "featured": boolean,
      "body": string[] (3-5 short paragraphs, plain text, actionable, no markdown headings)
    }
  ]
}

Rules:
- Generate exactly 6 posts.
- Mark exactly 2 as featured: true.
- Vary categories; include at least one genai, one blockchain, one algorithms/contest, one careers.
- IDs must be unique kebab-case and start with "ai-".
- Body paragraphs should teach something concrete (patterns, tradeoffs, checklists).
- Keep JSON compact — avoid long paragraphs so the response is not truncated.
- date should be recent (within the last 14 days of **2026-08-01**).
- generatedAt must be current ISO time.`;

async function generateHubWithLlm(): Promise<BlogHub> {
  if (!process.env.GROQ_API_KEY?.trim()) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const raw = await groqChat(SYSTEM, USER_PROMPT, {
    model: process.env.GROQ_CHAT_MODEL?.trim() || 'llama-3.3-70b-versatile',
    jsonMode: true,
  });

  const parsed: unknown = parseLlmJson(raw);
  const hub = hubSchema.parse({
    ...(parsed as object),
    generatedAt: new Date().toISOString(),
    source: 'groq',
  });

  const posts = normalizePosts(hub.posts);

  if (posts.length < 3) {
    throw new Error(`Groq returned too few valid blog posts (${posts.length})`);
  }

  // Ensure at least one featured highlight
  if (!posts.some((p) => p.featured)) {
    posts[0].featured = true;
    if (posts[1]) posts[1].featured = true;
  }

  return { ...hub, posts };
}

export async function getBlogHub(options?: { refresh?: boolean }): Promise<BlogHub> {
  const refresh = Boolean(options?.refresh);

  if (!refresh) {
    const mem = memoryCache.get(CACHE_KEY);
    if (mem && mem.expiresAt > Date.now()) {
      return mem.pack;
    }
    const cached = await cacheGet(CACHE_KEY);
    if (cached) {
      try {
        const raw = JSON.parse(cached) as BlogHub;
        const posts = normalizePosts(raw.posts || []);
        if (posts.length < 3) throw new Error('stale cache');
        const pack: BlogHub = {
          generatedAt: raw.generatedAt || new Date().toISOString(),
          source: 'groq',
          headline: raw.headline || 'Live engineering notes',
          summary: raw.summary || 'Fresh articles generated for builders.',
          posts,
        };
        memoryCache.set(CACHE_KEY, {
          expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
          pack,
        });
        return pack;
      } catch {
        /* regenerate */
      }
    }
  }

  let pack: BlogHub;
  try {
    pack = await generateHubWithLlm();
  } catch (err) {
    console.error('[blog] live generation failed, serving fallback pack:', err);
    pack = buildFallbackHub();
  }

  memoryCache.set(CACHE_KEY, {
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    pack,
  });
  await cacheSet(CACHE_KEY, JSON.stringify(pack), CACHE_TTL_SECONDS);
  return pack;
}

export async function getBlogPostFromHub(id: string): Promise<BlogLivePost | undefined> {
  const hub = await getBlogHub();
  return hub.posts.find((p) => p.id === id);
}

export async function invalidateBlogHub(): Promise<void> {
  memoryCache.delete(CACHE_KEY);
  await cacheDel(CACHE_KEY);
}
