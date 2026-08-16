/**
 * Learning roadmaps — curated paths that deep-link into real app surfaces.
 * Progress is computed from /progress/me (courses) + DSA sheet localStorage.
 */

export type RoadmapStepKind =
  | 'course'
  | 'dsa'
  | 'practice'
  | 'interview'
  | 'visualizer'
  | 'projects'
  | 'communication'
  | 'href';

export type RoadmapStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  kind: RoadmapStepKind;
  /** Catalog course id — progress from GET /progress/me */
  courseId?: string;
  /** When true, progress uses DSA sheet completion */
  dsaSheet?: boolean;
  /** Optional enrollment / bundle product gate label */
  productId?: string;
};

export type Roadmap = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  /** Tailwind-friendly accent token */
  accent: 'teal' | 'amber' | 'violet' | 'sky' | 'rose';
  estimatedWeeks: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  bundleProductId?: string;
  steps: RoadmapStep[];
};

export const ROADMAPS: Roadmap[] = [
  {
    id: 'fullstack',
    title: 'Full-Stack Web Engineer',
    description:
      'JS fundamentals → React → Node → practice problems → ship a project. Ideal if you want to build and deploy end-to-end apps.',
    tags: ['Frontend', 'Backend', 'Projects'],
    accent: 'teal',
    estimatedWeeks: 10,
    level: 'Intermediate',
    bundleProductId: 'bundle-fullstack',
    steps: [
      {
        id: 'fs-js',
        title: 'JavaScript Fundamentals',
        description: 'Core language, async, and browser basics.',
        href: '/learn/4',
        kind: 'course',
        courseId: '4',
      },
      {
        id: 'fs-react',
        title: 'Salaam React',
        description: 'Components, hooks, and production UI patterns.',
        href: '/learn/3',
        kind: 'course',
        courseId: '3',
        productId: '3',
      },
      {
        id: 'fs-node',
        title: 'Salaam Node.js',
        description: 'APIs, auth, and server-side JavaScript.',
        href: '/learn/2',
        kind: 'course',
        courseId: '2',
        productId: '2',
      },
      {
        id: 'fs-practice',
        title: 'JavaScript practice',
        description: 'Solve catalog problems tagged for JS interviews.',
        href: '/practice?language=JavaScript',
        kind: 'practice',
      },
      {
        id: 'fs-projects',
        title: 'Build a project',
        description: 'Pick an idea from the projects hub and ship it.',
        href: '/projects',
        kind: 'projects',
      },
    ],
  },
  {
    id: 'interview-dsa',
    title: 'Interview & DSA Track',
    description:
      'Structured DSA course, curated sheet, visual patterns, system design, then a timed interview sim.',
    tags: ['DSA', 'Interview', 'System Design'],
    accent: 'amber',
    estimatedWeeks: 12,
    level: 'Advanced',
    bundleProductId: 'bundle-interview',
    steps: [
      {
        id: 'id-dsa-course',
        title: 'Salaam DSA',
        description: 'Guided DSA tutorials on the platform.',
        href: '/learn/1',
        kind: 'course',
        courseId: '1',
        productId: '1',
      },
      {
        id: 'id-sheet',
        title: 'DSA Sheet',
        description: 'Topic-wise problem set with local progress tracking.',
        href: '/dsa-sheet',
        kind: 'dsa',
        dsaSheet: true,
      },
      {
        id: 'id-viz',
        title: 'DSA Visualizer',
        description: 'See algorithms step-by-step before you code them.',
        href: '/visualizer/dsa',
        kind: 'visualizer',
      },
      {
        id: 'id-sd',
        title: 'System Design',
        description: 'Scalability patterns interviewers expect.',
        href: '/learn/5',
        kind: 'course',
        courseId: '5',
        productId: '5',
      },
      {
        id: 'id-interview',
        title: 'Mock interview',
        description: 'Timed JS engineer interview with AI feedback.',
        href: '/interview',
        kind: 'interview',
      },
    ],
  },
  {
    id: 'frontend',
    title: 'Frontend Specialist',
    description:
      'Modern React depth, React.js practice problems, and LLD visual patterns for UI architecture interviews.',
    tags: ['React', 'UI', 'LLD'],
    accent: 'violet',
    estimatedWeeks: 8,
    level: 'Intermediate',
    bundleProductId: 'bundle-frontend',
    steps: [
      {
        id: 'fe-js',
        title: 'JavaScript Fundamentals',
        description: 'Solid JS before heavy React.',
        href: '/learn/4',
        kind: 'course',
        courseId: '4',
      },
      {
        id: 'fe-react',
        title: 'Salaam React',
        description: 'Hooks, composition, and app structure.',
        href: '/learn/3',
        kind: 'course',
        courseId: '3',
        productId: '3',
      },
      {
        id: 'fe-practice',
        title: 'React.js practice',
        description: 'Component challenges from the practice catalog.',
        href: '/practice?language=React.js',
        kind: 'practice',
      },
      {
        id: 'fe-lld',
        title: 'LLD visualizer',
        description: 'Design patterns for frontend-heavy interviews.',
        href: '/visualizer/lld',
        kind: 'visualizer',
      },
      {
        id: 'fe-sd',
        title: 'System Design',
        description: 'Front-of-stack tradeoffs and API design.',
        href: '/learn/5',
        kind: 'course',
        courseId: '5',
        productId: '5',
      },
    ],
  },
  {
    id: 'python-starter',
    title: 'Python Starter',
    description: 'Beginner-friendly Python course, then jump into general practice problems.',
    tags: ['Python', 'Beginner'],
    accent: 'sky',
    estimatedWeeks: 4,
    level: 'Beginner',
    steps: [
      {
        id: 'py-course',
        title: 'Python for Beginners',
        description: 'Syntax, data structures, and small programs.',
        href: '/learn/6',
        kind: 'course',
        courseId: '6',
      },
      {
        id: 'py-practice',
        title: 'Open practice',
        description: 'Warm up on easy algorithm problems.',
        href: '/practice',
        kind: 'practice',
      },
      {
        id: 'py-dsa',
        title: 'DSA Sheet (foundation)',
        description: 'Start the curated sheet when you are ready.',
        href: '/dsa-sheet',
        kind: 'dsa',
        dsaSheet: true,
      },
    ],
  },
  {
    id: 'eng-communication',
    title: 'Engineer Communication',
    description:
      'Day-to-day meeting skills for software developers — standups, planning, 1:1s, design reviews, retros, and stakeholder updates with Mistral coaching.',
    tags: ['Soft skills', 'Meetings', 'Career'],
    accent: 'rose',
    estimatedWeeks: 3,
    level: 'Intermediate',
    steps: [
      {
        id: 'comm-standup',
        title: 'Practice meeting scenarios',
        description: 'Generate live scenarios and rehearse what you would say.',
        href: '/communication',
        kind: 'communication',
      },
      {
        id: 'comm-interview',
        title: 'Interview speaking practice',
        description: 'Transfer clear spoken structure into mock interviews.',
        href: '/interview',
        kind: 'interview',
      },
      {
        id: 'comm-placement',
        title: 'Placement storytelling',
        description: 'Turn meeting clarity into resume bullets and career narrative.',
        href: '/placement',
        kind: 'href',
      },
    ],
  },
];

export function getRoadmapById(id: string): Roadmap | undefined {
  return ROADMAPS.find((r) => r.id === id);
}
