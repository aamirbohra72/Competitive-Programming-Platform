import { z } from 'zod';
import { groqChat } from './groqAiService';
import { cacheGet, cacheSet } from './redisService';

export const MEETING_TYPES = [
  'daily-standup',
  'sprint-planning',
  'one-on-one',
  'design-review',
  'incident-retro',
  'stakeholder-update',
] as const;

export type MeetingType = (typeof MEETING_TYPES)[number];

const meetingTypeSchema = z.enum(MEETING_TYPES);

const scenarioSchema = z.object({
  meetingType: meetingTypeSchema,
  title: z.string().min(3),
  setting: z.string().min(8),
  yourRole: z.string().min(3),
  others: z.array(z.string()).min(1).max(6),
  prompt: z.string().min(20),
  goals: z.array(z.string()).min(2).max(5),
  pitfalls: z.array(z.string()).min(2).max(5),
  sampleStrongAnswer: z.string().min(20),
});

const stringList = z
  .array(z.string())
  .optional()
  .transform((arr) => (arr ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 5));

const coachSchema = z.object({
  score: z.coerce.number().min(0).max(100).catch(70),
  verdict: z.string().min(3).catch('Keep practicing — tighten clarity and the ask.'),
  strengths: stringList,
  improvements: stringList,
  rewritten: z.string().min(8).catch(''),
  nextTip: z.string().min(3).catch('Practice the rewrite out loud once under 60 seconds.'),
});

export type MeetingScenario = z.infer<typeof scenarioSchema> & {
  source: 'groq' | 'fallback';
  generatedAt: string;
};

export type MeetingCoachResult = {
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  rewritten: string;
  nextTip: string;
  source: 'groq' | 'fallback';
};

function normalizeCoach(
  parsed: z.infer<typeof coachSchema>,
  sampleStrongAnswer: string,
): Omit<MeetingCoachResult, 'source'> {
  const strengths =
    parsed.strengths.length > 0
      ? parsed.strengths
      : ['You submitted a full spoken response'];
  const improvements =
    parsed.improvements.length > 0
      ? parsed.improvements
      : ['Lead with the outcome, then one clear ask'];
  const rewritten =
    parsed.rewritten.trim().length >= 20 ? parsed.rewritten.trim() : sampleStrongAnswer;

  return {
    score: parsed.score,
    verdict: parsed.verdict,
    strengths,
    improvements,
    rewritten,
    nextTip: parsed.nextTip,
  };
}

export type MeetingTypeMeta = {
  id: MeetingType;
  title: string;
  blurb: string;
  duration: string;
  focus: string[];
};

export const MEETING_TYPE_META: MeetingTypeMeta[] = [
  {
    id: 'daily-standup',
    title: 'Daily standup',
    blurb: 'Share yesterday, today, and blockers in under a minute without rambling.',
    duration: '15 min',
    focus: ['Clarity', 'Blockers', 'Brevity'],
  },
  {
    id: 'sprint-planning',
    title: 'Sprint planning',
    blurb: 'Negotiate scope, estimate honestly, and surface risks early.',
    duration: '45–90 min',
    focus: ['Scope', 'Tradeoffs', 'Ownership'],
  },
  {
    id: 'one-on-one',
    title: '1:1 with manager',
    blurb: 'Drive the agenda: growth, feedback, and unblocking your career path.',
    duration: '30 min',
    focus: ['Feedback', 'Growth', 'Priorities'],
  },
  {
    id: 'design-review',
    title: 'Design review',
    blurb: 'Present options, defend tradeoffs, and invite critique without getting defensive.',
    duration: '45 min',
    focus: ['Tradeoffs', 'Diagrams', 'Listening'],
  },
  {
    id: 'incident-retro',
    title: 'Incident retro',
    blurb: 'Blame-free root cause, concrete actions, and calm clarity under pressure.',
    duration: '45–60 min',
    focus: ['RCA', 'Actions', 'Tone'],
  },
  {
    id: 'stakeholder-update',
    title: 'Stakeholder update',
    blurb: 'Translate engineering progress into outcomes non-engineers care about.',
    duration: '20–30 min',
    focus: ['Outcomes', 'Risks', 'Asks'],
  },
];

const FALLBACK: Record<MeetingType, Omit<MeetingScenario, 'source' | 'generatedAt'>> = {
  'daily-standup': {
    meetingType: 'daily-standup',
    title: 'Auth middleware regression',
    setting:
      'Remote standup on Zoom. Your squad ships a payments checkout fix this week. Two teammates are waiting on your PR.',
    yourRole: 'Mid-level backend engineer',
    others: ['Tech lead (facilitator)', 'Frontend peer', 'QA'],
    prompt:
      'Give a crisp standup update: what you finished yesterday, what you will do today, and one blocker — without dumping implementation detail.',
    goals: [
      'Keep update under ~45 seconds',
      'Name the blocker and who can unblock you',
      'Connect work to the checkout release',
    ],
    pitfalls: ['Listing every commit', 'Hiding the blocker', 'No clear ask'],
    sampleStrongAnswer:
      'Yesterday I finished the JWT clock-skew fix and added regression tests. Today I am pairing with frontend to verify checkout login, then opening the PR for review. Blocker: I need staging Redis credentials from infra — I will ping #infra after standup if I do not hear back by 11.',
  },
  'sprint-planning': {
    meetingType: 'sprint-planning',
    title: 'Cut scope for flaky judge queue',
    setting:
      'Sprint planning. Product wants three features. Engineering capacity is thin after an on-call week.',
    yourRole: 'Software engineer owning the judge service',
    others: ['PM', 'Eng manager', 'Two engineers'],
    prompt:
      'Argue for cutting or sequencing work so the flaky judge queue is fixed first. Be collaborative, not combative.',
    goals: [
      'Quantify user impact of the flake',
      'Propose a sequenced plan',
      'Offer a smaller win if full fix does not fit',
    ],
    pitfalls: ['Absolute “no” without options', 'Ignoring product goals', 'No estimate'],
    sampleStrongAnswer:
      'I support the roadmap, but the judge flake is blocking practice submissions for ~8% of runs. I recommend sequencing: (1) stabilize queue retries this sprint (3 points), (2) ship feature A behind a flag if capacity remains. That protects learners and still moves the product needle.',
  },
  'one-on-one': {
    meetingType: 'one-on-one',
    title: 'Growth conversation',
    setting: 'Monthly 1:1 with your engineering manager. You want more ownership of system design work.',
    yourRole: 'Frontend engineer (2 years experience)',
    others: ['Engineering manager'],
    prompt:
      'Open the 1:1 with a clear agenda and a specific ask for growth opportunities in the next quarter.',
    goals: ['Lead with outcomes', 'Make a specific ask', 'Invite feedback'],
    pitfalls: ['Vague “I want to grow”', 'Only complaining', 'No follow-ups'],
    sampleStrongAnswer:
      'Agenda for today: project status, feedback on my last design doc, and a growth ask. I would like to own the next API contract for the billing page with a senior shadow. Success looks like I write the RFC and present it in design review by end of next month. What gaps do you see?',
  },
  'design-review': {
    meetingType: 'design-review',
    title: 'Caching layer for leaderboard',
    setting: 'Design review with seniors. You propose Redis for the platform leaderboard.',
    yourRole: 'Author of the design doc',
    others: ['Staff engineer', 'Backend peer', 'SRE'],
    prompt:
      'Walk through two options (DB aggregation vs Redis) and recommend one with clear tradeoffs.',
    goals: ['State the recommendation first', 'Name failure modes', 'Invite dissent'],
    pitfalls: ['Hiding risks', 'Slide-reading', 'Defensiveness'],
    sampleStrongAnswer:
      'Recommendation: Redis sorted sets for live contest boards, Postgres as source of truth on finalize. Alternative is pure SQL — simpler ops, but p99 climbs during contests. Main risks are Redis downtime (fall back to DB) and stale ranks (TTL + write-through on AC). What would change your mind?',
  },
  'incident-retro': {
    meetingType: 'incident-retro',
    title: 'Payment webhook timeout',
    setting: 'Blameless retro after checkout webhooks timed out for 22 minutes.',
    yourRole: 'On-call engineer who mitigated',
    others: ['EM', 'PM', 'SRE', 'Backend peers'],
    prompt:
      'Summarize timeline, impact, root cause, and two concrete action items without blaming individuals.',
    goals: ['Facts first', 'Systemic causes', 'Owners + dates for actions'],
    pitfalls: ['Finger-pointing', 'No actions', 'Too much jargon'],
    sampleStrongAnswer:
      'Impact: 22 minutes of missed payment confirmations (~40 orders delayed). Timeline: alert 14:02 → mitigated 14:24 by raising webhook workers. Root cause: single worker pool saturated after a traffic spike; no backlog SLO. Actions: (1) autoscale workers by queue depth — @sre by Fri, (2) add synthetic webhook canary — @me by next Tue.',
  },
  'stakeholder-update': {
    meetingType: 'stakeholder-update',
    title: 'Interview feature status',
    setting: 'Weekly update with a non-technical stakeholder funding the interview product.',
    yourRole: 'Engineer demoing progress',
    others: ['Product lead', 'Business stakeholder'],
    prompt:
      'Give a 2-minute status: outcome, progress, risk, and one decision you need from them.',
    goals: ['Lead with user outcome', 'One clear ask', 'Honest risk'],
    pitfalls: ['Jargon dump', 'No ask', 'Over-promising'],
    sampleStrongAnswer:
      'Outcome: candidates can finish a timed JS interview with AI feedback. This week we shipped scoring and recording upload. Risk: transcription latency on long answers. Ask: approve a 1-week slip to add a progress spinner and timeout messaging before marketing the beta.',
  },
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

function softRepairJson(text: string): string {
  return text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

function parseJsonLoose(raw: string): unknown {
  const extracted = extractJsonObject(raw);
  for (const attempt of [extracted, softRepairJson(extracted)]) {
    try {
      return JSON.parse(attempt);
    } catch {
      /* continue */
    }
  }
  throw new SyntaxError('Unable to parse communication JSON');
}

function fallbackScenario(meetingType: MeetingType): MeetingScenario {
  return {
    ...FALLBACK[meetingType],
    source: 'fallback',
    generatedAt: new Date().toISOString(),
  };
}

const SCENARIO_SYSTEM = `You are a communication coach for software engineers.
Create realistic workplace meeting practice scenarios.
Output ONLY valid JSON. No markdown fences. Keep strings concise.`;

function scenarioUserPrompt(meetingType: MeetingType): string {
  const meta = MEETING_TYPE_META.find((m) => m.id === meetingType)!;
  return `Generate one practice scenario for a software developer meeting.

Meeting type: ${meetingType} (${meta.title})
Focus areas: ${meta.focus.join(', ')}

Schema:
{
  "meetingType": "${meetingType}",
  "title": string,
  "setting": string,
  "yourRole": string,
  "others": string[],
  "prompt": string,
  "goals": string[],
  "pitfalls": string[],
  "sampleStrongAnswer": string
}

Rules:
- Scenario must feel like a real day-to-day eng meeting in 2026.
- Prompt asks the learner what they would say / how they would facilitate.
- sampleStrongAnswer should be a model spoken response (not bullet notes).
- Keep JSON compact.`;
}

const COACH_SYSTEM = `You are a supportive communication coach for software developers.
Score the learner's meeting response and rewrite a stronger version.
Output ONLY valid JSON. No markdown fences.`;

function coachUserPrompt(input: {
  meetingType: MeetingType;
  scenario: MeetingScenario;
  userResponse: string;
}): string {
  return `Meeting type: ${input.meetingType}
Scenario title: ${input.scenario.title}
Setting: ${input.scenario.setting}
Role: ${input.scenario.yourRole}
Prompt: ${input.scenario.prompt}
Goals: ${input.scenario.goals.join('; ')}

Learner's response:
"""
${input.userResponse}
"""

Schema:
{
  "score": number (0-100),
  "verdict": string,
  "strengths": string[] (1-5 non-empty items),
  "improvements": string[] (1-5 non-empty items),
  "rewritten": string,
  "nextTip": string
}

Rules:
- Be specific to software-team meetings.
- strengths and improvements MUST each include at least one concrete bullet.
- rewritten should be something they could say out loud.
- Keep JSON compact.`;
}

export function listMeetingTypes(): MeetingTypeMeta[] {
  return MEETING_TYPE_META;
}

export async function generateMeetingScenario(meetingTypeRaw: string): Promise<MeetingScenario> {
  const meetingType = meetingTypeSchema.parse(meetingTypeRaw);
  const cacheKey = `communication:scenario:${meetingType}:v1`;

  const cached = await cacheGet(cacheKey);
  if (cached) {
    try {
      const parsed = scenarioSchema.parse(JSON.parse(cached));
      return { ...parsed, source: 'groq', generatedAt: new Date().toISOString() };
    } catch {
      /* regenerate */
    }
  }

  if (!process.env.GROQ_API_KEY?.trim()) {
    return fallbackScenario(meetingType);
  }

  try {
    const raw = await groqChat(SCENARIO_SYSTEM, scenarioUserPrompt(meetingType), {
      model: process.env.GROQ_CHAT_MODEL?.trim() || 'llama-3.3-70b-versatile',
      jsonMode: true,
    });
    const parsed = scenarioSchema.parse({
      ...(parseJsonLoose(raw) as object),
      meetingType,
    });
    const pack: MeetingScenario = {
      ...parsed,
      source: 'groq',
      generatedAt: new Date().toISOString(),
    };
    await cacheSet(cacheKey, JSON.stringify(parsed), 60 * 30);
    return pack;
  } catch (err) {
    console.error('[communication] scenario generation failed:', err);
    return fallbackScenario(meetingType);
  }
}

export async function coachMeetingResponse(input: {
  meetingType: string;
  scenario: unknown;
  userResponse: string;
}): Promise<MeetingCoachResult> {
  const meetingType = meetingTypeSchema.parse(input.meetingType);
  const userResponse = z.string().min(20).max(4000).parse(input.userResponse);
  const scenario = scenarioSchema.parse(input.scenario);

  if (!process.env.GROQ_API_KEY?.trim()) {
    return {
      score: 70,
      verdict: 'Solid structure — tighten the ask and cut jargon (offline coach mode).',
      strengths: ['You addressed the prompt', 'Tone is professional'],
      improvements: ['Add a concrete ask or next step', 'Lead with the outcome in one sentence'],
      rewritten: scenario.sampleStrongAnswer,
      nextTip: 'Practice out loud once under 60 seconds.',
      source: 'fallback',
    };
  }

  try {
    const raw = await groqChat(
      COACH_SYSTEM,
      coachUserPrompt({ meetingType, scenario: { ...scenario, source: 'groq', generatedAt: '' }, userResponse }),
      {
        model: process.env.GROQ_CHAT_MODEL?.trim() || 'llama-3.3-70b-versatile',
        jsonMode: true,
      },
    );
    const parsed = coachSchema.parse(parseJsonLoose(raw));
    return { ...normalizeCoach(parsed, scenario.sampleStrongAnswer), source: 'groq' };
  } catch (err) {
    console.error('[communication] coach failed:', err);
    return {
      score: 68,
      verdict: 'Coach unavailable — compare against the sample strong answer.',
      strengths: ['You attempted a full spoken response'],
      improvements: ['Mirror the sample structure: outcome → progress → risk/ask'],
      rewritten: scenario.sampleStrongAnswer,
      nextTip: 'Retry coaching in a moment, or rehearse the sample aloud.',
      source: 'fallback',
    };
  }
}
