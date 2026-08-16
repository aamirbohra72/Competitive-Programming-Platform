export type ResumeTemplateId = 'classic' | 'compact' | 'modern';

export interface ResumeExperience {
  id: string;
  company: string;
  title: string;
  location?: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface ResumeProject {
  id: string;
  name: string;
  link?: string;
  tech?: string;
  bullets: string[];
}

export interface ResumeEducation {
  id: string;
  school: string;
  degree: string;
  year: string;
  details?: string;
}

export interface ResumeAchievement {
  id: string;
  title: string;
  year?: string;
  description?: string;
}

export interface ResumeData {
  fullName: string;
  headline: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  leetcode?: string;
  portfolio?: string;
  summary: string;
  skills: string[];
  tools: string[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
  achievements: ResumeAchievement[];
  education: ResumeEducation[];
}

export interface ResumeSuggestions {
  score: number;
  criticalIssues: string[];
  improvements: string[];
  resume: ResumeData;
}

export interface ResumeBuilderState {
  templateId: ResumeTemplateId | null;
  data: ResumeData;
}

export const RESUME_TEMPLATES: {
  id: ResumeTemplateId;
  name: string;
  blurb: string;
}[] = [
  { id: 'classic', name: 'Classic ATS', blurb: 'Single-column, clear headings, recruiter favorite.' },
  { id: 'compact', name: 'Compact ATS', blurb: 'Tighter spacing for more content on one page.' },
  { id: 'modern', name: 'Modern ATS', blurb: 'Teal accent, skill chips, polished social icons.' },
];

export function createEmptyResume(seed?: { name?: string; role?: string }): ResumeData {
  const fullName = seed?.name?.trim() || 'Your Name';
  const headline = seed?.role?.trim() || 'Software Engineer';
  return {
    fullName,
    headline,
    email: 'you@email.com',
    phone: '',
    location: 'Bangalore, India',
    linkedin: '',
    github: '',
    leetcode: '',
    portfolio: '',
    summary: '',
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
    tools: ['Git', 'VS Code'],
    experience: [
      {
        id: 'exp-1',
        company: 'Company Name',
        title: headline,
        location: 'Remote',
        start: 'Jan 2023',
        end: 'Present',
        bullets: ['Describe a measurable achievement.', 'Add another impact-focused bullet.'],
      },
    ],
    projects: [
      {
        id: 'proj-1',
        name: 'Project Name',
        tech: 'React, Node.js',
        link: '',
        bullets: ['What you built and the outcome.'],
      },
    ],
    achievements: [
      {
        id: 'ach-1',
        title: 'Employee of the Month',
        year: '2024',
        description: 'Recognized for delivering a high-impact feature ahead of schedule.',
      },
    ],
    education: [
      {
        id: 'edu-1',
        school: 'University Name',
        degree: 'B.Tech Computer Science',
        year: '2022',
        details: '',
      },
    ],
  };
}

export function resumeCompleteness(data: ResumeData): {
  personal: boolean;
  skills: boolean;
  experience: boolean;
  projects: boolean;
  achievements: boolean;
  needsWork: string[];
} {
  const needsWork: string[] = [];
  const personal = Boolean(data.fullName.trim() && data.email.trim() && data.headline.trim());
  const skills = data.skills.filter(Boolean).length >= 4;
  const experience = data.experience.some((e) => e.company && e.bullets.some((b) => b.trim().length > 20));
  const projects = data.projects.some((p) => p.name && p.bullets.some((b) => b.trim()));
  const achievements = (data.achievements ?? []).some((a) => a.title.trim());
  if (!data.summary.trim()) needsWork.push('summary');
  if (!skills) needsWork.push('skills');
  if (!experience) needsWork.push('experience');
  if (!projects) needsWork.push('projects');
  return { personal, skills, experience, projects, achievements, needsWork };
}
