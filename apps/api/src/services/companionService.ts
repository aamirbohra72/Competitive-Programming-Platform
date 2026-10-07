import { z } from 'zod';
import { groqChatMessages } from './groqAiService';

const historyItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const requestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(historyItemSchema).max(20).optional().default([]),
});

const actionSchema = z.object({
  type: z.enum(['link', 'ta_help', 'ta_call']),
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(200),
});

const replySchema = z.object({
  reply: z.string().min(1),
  intent: z
    .enum([
      'jobs',
      'courses',
      'course_manager',
      'course_pause',
      'course_restart',
      'billing',
      'ta_help',
      'general',
    ])
    .catch('general'),
  actions: z.array(actionSchema).max(4).optional().default([]),
  escalateToTa: z.boolean().optional().default(false),
});

export type CompanionChatInput = z.infer<typeof requestSchema>;
export type CompanionChatResult = z.infer<typeof replySchema>;

function extractJsonObject(raw: string): string {
  const t = raw.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (m) return m[1].trim();
  return t;
}

const SYSTEM = `You are Support Companion for the Codeforces Platform (learning + competitive programming).
Answer briefly and helpfully about THIS platform only.

You can help with:
- Jobs / careers / interview prep (/careers, /interview)
- Courses catalog & enrollment (/learn, /billing)
- Course manager: pause a course, restart a course, resume learning
- Billing / Razorpay purchases (/billing)
- Projects, blog, practice, contests, TA help (/ta-help)

Course pause / restart guidance (product truth):
- Pausing: tell the learner they can pause progress anytime; advise opening the course from Courses (/learn), then contact TA Support if they need an official pause on enrollment/billing.
- Restarting: they can reopen the course from /learn; if access is locked, send them to /billing or escalate to a TA.
- Never invent refund policies; escalate refunds to TA/human.

When the user needs a human (complex account change, refund, video doubt, stuck after 2 replies), set escalateToTa=true and include a ta_call action with label "Request a Call" and href "/ta-help".
Also include ta_help for text-only help when appropriate.

Important: "Request a Call" is a working in-app action (opens the TA video-call form). Always prefer type "ta_call" over a plain link when offering human handoff.

Output ONLY valid JSON:
{
  "reply": string,
  "intent": "jobs"|"courses"|"course_manager"|"course_pause"|"course_restart"|"billing"|"ta_help"|"general",
  "escalateToTa": boolean,
  "actions": [{ "type": "link"|"ta_help"|"ta_call", "label": string, "href": string }]
}

Prefer real in-app paths:
- /learn, /learn/create, /billing, /careers, /interview, /ta-help, /projects, /blog, /practice, /contests
Keep reply under 120 words. Be warm and concrete.`;

export function parseCompanionRequest(body: unknown): CompanionChatInput {
  return requestSchema.parse(body);
}

export async function chatWithCompanion(input: CompanionChatInput): Promise<CompanionChatResult> {
  if (!process.env.GROQ_API_KEY?.trim()) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const history = input.history.slice(-12);
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: SYSTEM },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: input.message },
  ];

  const raw = await groqChatMessages(messages, {
    model: process.env.GROQ_CHAT_MODEL?.trim() || 'llama-3.3-70b-versatile',
    jsonMode: true,
    temperature: 0.4,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch {
    return {
      reply: raw.trim() || 'I can help with courses, jobs, pause/restart, and connecting you to a TA.',
      intent: 'general',
      escalateToTa: false,
      actions: [
        { type: 'ta_help', label: 'Ask a Teaching Assistant', href: '/ta-help' },
        { type: 'link', label: 'Browse Courses', href: '/learn' },
      ],
    };
  }

  const result = replySchema.safeParse(parsed);
  if (!result.success) {
    const reply =
      typeof (parsed as { reply?: unknown })?.reply === 'string'
        ? String((parsed as { reply: string }).reply)
        : 'Happy to help — ask about jobs, courses, pause/restart, or connect with a TA.';
    return {
      reply,
      intent: 'general',
      escalateToTa: /ta|human|agent|call/i.test(reply),
      actions: [
        { type: 'ta_call', label: 'Request a Call', href: '/ta-help' },
        { type: 'link', label: 'Courses', href: '/learn' },
      ],
    };
  }

  const data = result.data;
  const actions = [...data.actions];

  if (data.escalateToTa && !actions.some((a) => a.type === 'ta_call' || a.type === 'ta_help')) {
    actions.unshift({ type: 'ta_call', label: 'Request a Call', href: '/ta-help' });
  }

  // Normalize hrefs to in-app paths when model invents absolute URLs to our routes
  const normalized = actions
    .map((a) => {
      let href = a.href;
      try {
        if (href.startsWith('http')) {
          const u = new URL(href);
          href = u.pathname || '/ta-help';
        }
      } catch {
        href = '/ta-help';
      }
      if (!href.startsWith('/')) href = `/${href}`;
      return { ...a, href };
    })
    .slice(0, 4);

  return { ...data, actions: normalized };
}
