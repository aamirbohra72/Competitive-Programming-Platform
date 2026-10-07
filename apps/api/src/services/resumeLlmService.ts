import { z } from 'zod';
import { groqChatJson } from './groqAiService';

const experienceSchema = z.object({
  id: z.string(),
  company: z.string(),
  title: z.string(),
  location: z.string().optional(),
  start: z.string(),
  end: z.string(),
  bullets: z.array(z.string()).min(1).max(6),
});

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  link: z.string().optional(),
  tech: z.string().optional(),
  bullets: z.array(z.string()).min(1).max(5),
});

const educationSchema = z.object({
  id: z.string(),
  school: z.string(),
  degree: z.string(),
  year: z.string(),
  details: z.string().optional(),
});

const achievementSchema = z.object({
  id: z.string(),
  title: z.string(),
  year: z.string().optional(),
  description: z.string().optional(),
});

const resumeSchema = z.object({
  fullName: z.string(),
  headline: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  leetcode: z.string().optional(),
  portfolio: z.string().optional(),
  summary: z.string(),
  skills: z.array(z.string()).min(3),
  tools: z.array(z.string()).optional(),
  experience: z.array(experienceSchema).min(1).max(5),
  projects: z.array(projectSchema).min(1).max(5),
  achievements: z.array(achievementSchema).max(8).default([]),
  education: z.array(educationSchema).min(1).max(3),
});

export type ResumeData = z.infer<typeof resumeSchema>;

const suggestionsSchema = z.object({
  score: z.number().min(0).max(100),
  criticalIssues: z.array(z.string()).max(6),
  improvements: z.array(z.string()).max(8),
  resume: resumeSchema,
});

export type ResumeSuggestions = z.infer<typeof suggestionsSchema>;

function extractJsonObject(raw: string): string {
  const t = raw.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (m) return m[1].trim();
  return t;
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? '')).filter(Boolean);
}

function normalizeResume(input: unknown): ResumeData {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const experienceIn = Array.isArray(raw.experience) ? raw.experience : [];
  const projectsIn = Array.isArray(raw.projects) ? raw.projects : [];
  const achievementsIn = Array.isArray(raw.achievements) ? raw.achievements : [];
  const educationIn = Array.isArray(raw.education) ? raw.education : [];

  const experience =
    experienceIn.length > 0
      ? experienceIn.slice(0, 5).map((item, i) => {
          const e = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            id: asString(e.id, `exp-${i + 1}`),
            company: asString(e.company, 'Company'),
            title: asString(e.title, 'Software Engineer'),
            location: asString(e.location) || undefined,
            start: asString(e.start, '2022'),
            end: asString(e.end, 'Present'),
            bullets: asStringArray(e.bullets).slice(0, 6).length
              ? asStringArray(e.bullets).slice(0, 6)
              : ['Built and shipped product features.'],
          };
        })
      : [
          {
            id: 'exp-1',
            company: 'Company',
            title: 'Software Engineer',
            location: 'Remote',
            start: '2022',
            end: 'Present',
            bullets: ['Built and shipped product features.'],
          },
        ];

  const projects =
    projectsIn.length > 0
      ? projectsIn.slice(0, 5).map((item, i) => {
          const p = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            id: asString(p.id, `proj-${i + 1}`),
            name: asString(p.name, 'Project'),
            link: asString(p.link) || undefined,
            tech: asString(p.tech) || undefined,
            bullets: asStringArray(p.bullets).slice(0, 5).length
              ? asStringArray(p.bullets).slice(0, 5)
              : ['Built an end-to-end web application.'],
          };
        })
      : [
          {
            id: 'proj-1',
            name: 'Portfolio Project',
            tech: 'React, Node.js',
            bullets: ['Built an end-to-end web application.'],
          },
        ];

  const achievements = achievementsIn.slice(0, 8).map((item, i) => {
    const a = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(a.id, `ach-${i + 1}`),
      title: asString(a.title, 'Achievement'),
      year: asString(a.year) || undefined,
      description: asString(a.description) || undefined,
    };
  });

  const education =
    educationIn.length > 0
      ? educationIn.slice(0, 3).map((item, i) => {
          const e = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            id: asString(e.id, `edu-${i + 1}`),
            school: asString(e.school, 'University'),
            degree: asString(e.degree, 'B.Tech Computer Science'),
            year: asString(e.year, '2021'),
            details: asString(e.details) || undefined,
          };
        })
      : [
          {
            id: 'edu-1',
            school: 'University',
            degree: 'B.Tech Computer Science',
            year: '2021',
          },
        ];

  const skills = asStringArray(raw.skills);
  return {
    fullName: asString(raw.fullName, 'Candidate'),
    headline: asString(raw.headline, 'Software Engineer'),
    email: asString(raw.email, 'candidate@email.com'),
    phone: asString(raw.phone) || undefined,
    location: asString(raw.location) || undefined,
    linkedin: asString(raw.linkedin) || undefined,
    github: asString(raw.github) || undefined,
    leetcode: asString(raw.leetcode) || undefined,
    portfolio: asString(raw.portfolio) || undefined,
    summary: asString(raw.summary),
    skills: skills.length >= 3 ? skills : [...skills, 'JavaScript', 'TypeScript', 'React'].slice(0, Math.max(3, skills.length || 3)),
    tools: asStringArray(raw.tools),
    experience,
    projects,
    achievements,
    education,
  };
}

function heuristicImprove(input: ResumeData): ResumeSuggestions {
  const resume: ResumeData = {
    ...input,
    summary:
      input.summary.trim() ||
      `${input.headline} with hands-on experience building production web apps. Focused on clean architecture, performance, and shipping reliable user experiences.`,
    skills: input.skills.length >= 5 ? input.skills : [...new Set([...input.skills, 'JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL'])],
    tools: input.tools?.length ? input.tools : ['Git', 'VS Code', 'Postman', 'Docker'],
    experience: input.experience.map((exp) => ({
      ...exp,
      bullets:
        exp.bullets.filter(Boolean).length >= 2
          ? exp.bullets
          : [
              `Delivered features for ${exp.company} using modern web technologies.`,
              'Collaborated with design and backend teams to ship on schedule.',
              'Improved reliability through testing, code reviews, and monitoring.',
            ],
    })),
    projects: input.projects.map((p) => ({
      ...p,
      bullets:
        p.bullets.filter(Boolean).length >= 2
          ? p.bullets
          : [
              `Built ${p.name} with a focus on usability and performance.`,
              'Documented setup and deployed a demo for stakeholders.',
            ],
    })),
    achievements: (input.achievements ?? []).map((a) => ({
      ...a,
      title: a.title.trim() || 'Key achievement',
      description:
        a.description?.trim() ||
        'Recognized for strong ownership, delivery quality, and measurable impact.',
    })),
  };

  const criticalIssues: string[] = [];
  if (!input.summary.trim()) criticalIssues.push('Professional summary is empty.');
  if (input.skills.length < 5) criticalIssues.push('Add more relevant skills for ATS keyword coverage.');
  if (input.experience.some((e) => e.bullets.filter(Boolean).length < 2)) {
    criticalIssues.push('Some experience entries need stronger, quantified bullet points.');
  }

  return {
    score: Math.max(45, 100 - criticalIssues.length * 12),
    criticalIssues,
    improvements: [
      'Use action verbs and quantify impact (%, users, latency, revenue).',
      'Keep formatting single-column and ATS-friendly (no tables/icons in PDF).',
      'Mirror keywords from target job descriptions in skills and bullets.',
      'Keep each bullet to one line when possible.',
    ],
    resume,
  };
}

export async function suggestResumeImprovements(input: unknown): Promise<ResumeSuggestions> {
  const normalized = normalizeResume(input);

  if (!process.env.GROQ_API_KEY?.trim()) {
    return heuristicImprove(normalized);
  }

  const system = `You are an expert ATS resume coach for software engineers in India.
Return STRICT JSON only. Improve clarity, impact, and keyword coverage while staying truthful to the provided facts.
Do not invent employers the user did not list. You may rewrite bullets and summary for impact.`;

  const user = `Improve this resume for ATS friendliness and return JSON:
{
  "score": 78,
  "criticalIssues": ["..."],
  "improvements": ["..."],
  "resume": { ...full improved resume matching schema... }
}

Current resume JSON:
${JSON.stringify(normalized)}

Rules:
- Keep ids stable when possible
- 3-5 strong bullets per experience
- Summary 2-4 sentences
- Skills should be concrete technologies
- Keep single-column ATS style content (no tables/columns in text)`;

  try {
    const raw = await groqChatJson(system, user);
    return suggestionsSchema.parse(JSON.parse(extractJsonObject(raw)));
  } catch {
    return heuristicImprove(normalized);
  }
}
