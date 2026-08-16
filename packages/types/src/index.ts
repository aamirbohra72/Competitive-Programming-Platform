import type {
  UserRole as DBUserRole,
  ContestStatus as DBContestStatus,
  ContestKind as DBContestKind,
  SubmissionStatus as DBSubmissionStatus,
} from '@codeforces/db';

export type UserRole = DBUserRole;
export type ContestStatus = DBContestStatus;
export type ContestKind = DBContestKind;
export type SubmissionStatus = DBSubmissionStatus;

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contest {
  id: string;
  slug?: string | null;
  name: string;
  description: string | null;
  startTime: Date | string;
  endTime: Date | string;
  status: ContestStatus;
  /** Wall-clock status derived from start/end (preferred over stored status) */
  effectiveStatus?: ContestStatus;
  kind?: ContestKind;
  isPublished?: boolean;
  problemCount?: number;
  participantCount?: number;
  /** Present when the request is authenticated */
  isRegistered?: boolean;
  /** Milliseconds until start (0 if already started) */
  startsInMs?: number;
  /** Milliseconds until end (0 if already ended) */
  endsInMs?: number;
  /** Contest duration in milliseconds */
  durationMs?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ContestRegistration {
  id: string;
  userId: string;
  contestId: string;
  registeredAt: Date | string;
}

export interface ContestMeResponse {
  contestId: string;
  registered: boolean;
  registeredAt: Date | string | null;
  effectiveStatus: ContestStatus;
  kind: ContestKind;
  canRegister: boolean;
  canUnregister: boolean;
  canSubmit: boolean;
  /** Whether a successful AC will update the live contest leaderboard */
  countsForLeaderboard: boolean;
  /** practice | contest | post_contest | blocked */
  submitMode: 'practice' | 'contest' | 'post_contest' | 'blocked';
}

export interface Challenge {
  id: string;
  contestId: string;
  slug?: string | null;
  title: string;
  description: string;
  difficulty: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  /** When set, used for /practice language filter and badges (JavaScript vs React.js) */
  practiceLanguage?: string | null;
  companies?: string[];
  estimatedTime?: string | null;
  judgeMode?: 'STDIN' | 'JS_FUNCTION' | 'REACT_COMPONENT';
  allowedLanguages?: string[];
  starterCode?: string | null;
  judgeReady?: boolean;
  sampleTestCases?: Array<{
    id: string;
    name: string;
    input: string;
    expectedOutput: string;
    isSample: boolean;
    order: number;
  }>;
  testCaseSummary?: {
    sampleCount: number;
    hiddenCount: number;
    totalCount: number;
  };
  contest?: {
    id: string;
    name: string;
    kind?: ContestKind;
    status?: ContestStatus;
    startTime?: Date | string;
    endTime?: Date | string;
    isPublished?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionResultCase {
  name: string;
  order: number;
  isHidden: boolean;
  isSample: boolean;
  passed: boolean;
  status: string;
  expected?: string;
  actual?: string;
  message?: string;
}

export interface Submission {
  id: string;
  userId: string;
  challengeId: string;
  language: string;
  sourceCode: string;
  status: SubmissionStatus;
  score?: number;
  aiResponse?: string | null;
  resultJson?: string | null;
  hintText?: string | null;
  submittedAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  token: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

