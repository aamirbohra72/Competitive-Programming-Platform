import { z } from 'zod';
import { groqChat } from './groqAiService';
import { cacheDel, cacheGet, cacheSet } from './redisService';

const CACHE_KEY = 'projects-hub:hackathon:v1';
const CACHE_TTL_SECONDS = 60 * 45; // 45 minutes
const memoryCache = new Map<string, { expiresAt: number; pack: ProjectsHub }>();

const trackSchema = z.enum(['colosseum', 'genai', 'agentic']);

const projectIdeaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(3),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  shortDesc: z.string().min(20),
  track: trackSchema,
  hackathon: z.string().min(3),
  domains: z.array(z.string()).min(1).max(5),
  technologies: z.array(z.string()).min(2).max(8),
  prizeAngle: z.string().min(10),
  mvpFeatures: z.array(z.string()).min(3).max(8),
  stretchGoals: z.array(z.string()).min(2).max(6),
  whyUnique: z.array(z.string()).min(2).max(5),
  resources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().min(1),
      }),
    )
    .max(4)
    .optional()
    .default([]),
});

const hubSchema = z.object({
  generatedAt: z.string(),
  source: z.literal('groq'),
  headline: z.string(),
  summary: z.string(),
  tracks: z.array(
    z.object({
      id: trackSchema,
      title: z.string(),
      blurb: z.string(),
      accent: z.string(),
    }),
  ),
  projects: z.array(projectIdeaSchema).min(6).max(18),
});

export type ProjectIdea = z.infer<typeof projectIdeaSchema>;
export type ProjectsHub = z.infer<typeof hubSchema>;

function extractJsonObject(raw: string): string {
  const t = raw.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (m) return m[1].trim();
  return t;
}

const SYSTEM = `You are a hackathon coach who designs high-signal project ideas for competitive builders.
Output ONLY valid JSON matching the schema the user provides. No markdown fences.`;

const USER_PROMPT = `Generate a fresh "Projects Hub" of hackathon-ready ideas focused on:

1) Solana Colosseum / blockchain hackathons (DeFi, NFTs, on-chain agents, infra, consumer crypto)
2) GenAI hackathons (RAG, multimodal, evals, fine-tuning products)
3) Agentic AI / AI Agents (tool-using agents, multi-agent systems, MCP, autonomous workflows)

Schema:
{
  "generatedAt": ISO string,
  "source": "groq",
  "headline": string,
  "summary": string (1-2 sentences),
  "tracks": [
    { "id": "colosseum"|"genai"|"agentic", "title": string, "blurb": string, "accent": "#hex" }
  ],
  "projects": [
    {
      "id": string (slug),
      "title": string,
      "difficulty": "Easy"|"Medium"|"Hard",
      "shortDesc": string,
      "track": "colosseum"|"genai"|"agentic",
      "hackathon": string (e.g. "Solana Colosseum", "GenAI Hackathon 2026", "Agentic AI Sprint"),
      "domains": string[],
      "technologies": string[],
      "prizeAngle": string (why judges / bounty programs would love it),
      "mvpFeatures": string[],
      "stretchGoals": string[],
      "whyUnique": string[],
      "resources": [{ "title": string, "url": string }]
    }
  ]
}

Rules:
- Include exactly 3 tracks: colosseum, genai, agentic (with distinct accent colors).
- Generate 12 projects total: 4 per track.
- Mix Easy/Medium/Hard.
- Make ideas concrete and buildable in a weekend–2 weeks, not vague.
- For colosseum: prefer Solana stack (Anchor, Web3.js, Helius, Jupiter, etc.) when relevant.
- For genai/agentic: prefer modern stacks (Next.js, Python, LangGraph/CrewAI-style patterns, vector DBs, MCP).
- Resource URLs must be real official docs when possible (docs.solana.com, groq.com, openai.com, etc.).
- generatedAt must be current ISO time.`;

async function generateHubWithLlm(): Promise<ProjectsHub> {
  if (!process.env.GROQ_API_KEY?.trim()) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const raw = await groqChat(SYSTEM, USER_PROMPT, {
    model: process.env.GROQ_CHAT_MODEL?.trim() || 'llama-3.3-70b-versatile',
    jsonMode: true,
  });

  const parsed: unknown = JSON.parse(extractJsonObject(raw));
  const hub = hubSchema.parse({
    ...(parsed as object),
    generatedAt: new Date().toISOString(),
    source: 'groq',
  });

  // Drop non-http resource links the model occasionally invents
  return {
    ...hub,
    projects: hub.projects.map((p) => ({
      ...p,
      resources: (p.resources || []).filter((r) => /^https?:\/\//i.test(r.url)),
    })),
  };
}

export async function getProjectsHub(options?: { refresh?: boolean }): Promise<ProjectsHub> {
  const refresh = Boolean(options?.refresh);

  if (!refresh) {
    const mem = memoryCache.get(CACHE_KEY);
    if (mem && mem.expiresAt > Date.now()) {
      return mem.pack;
    }
    const cached = await cacheGet(CACHE_KEY);
    if (cached) {
      try {
        const pack = hubSchema.parse(JSON.parse(cached));
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

  const pack = await generateHubWithLlm();
  memoryCache.set(CACHE_KEY, {
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    pack,
  });
  await cacheSet(CACHE_KEY, JSON.stringify(pack), CACHE_TTL_SECONDS);
  return pack;
}

export async function invalidateProjectsHub(): Promise<void> {
  memoryCache.delete(CACHE_KEY);
  await cacheDel(CACHE_KEY);
}
