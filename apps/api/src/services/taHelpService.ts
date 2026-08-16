import { prisma } from '@codeforces/db';
import type { TaHelpStatus, TaHelpType } from '@codeforces/db';
import { AppError } from '../lib/errors';

export type CreateTaHelpInput = {
  userId: string;
  title: string;
  type: 'text' | 'video';
  problem: string;
  topic: string;
  language: string;
  description: string;
  preferredSlot?: string;
  source?: 'web' | 'companion';
};

function toDbType(type: 'text' | 'video'): TaHelpType {
  return type === 'video' ? 'VIDEO' : 'TEXT';
}

function fromDbType(type: TaHelpType): 'text' | 'video' {
  return type === 'VIDEO' ? 'video' : 'text';
}

/** Map DB status → learner UI tabs */
export function toUiStatus(
  status: TaHelpStatus,
): 'waiting' | 'replied' | 'resolved' | 'open_pool' {
  switch (status) {
    case 'REPLIED':
      return 'replied';
    case 'RESOLVED':
      return 'resolved';
    case 'OPEN_POOL':
      return 'open_pool';
    case 'WAITING':
    case 'CLAIMED':
    default:
      return 'waiting';
  }
}

export function serializeRequest(row: {
  id: string;
  title: string;
  type: TaHelpType;
  status: TaHelpStatus;
  problem: string;
  topic: string;
  language: string;
  description: string;
  preferredSlot: string | null;
  source: string;
  assignedToName: string | null;
  rating: number | null;
  satisfied: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  claimedAt: Date | null;
  resolvedAt: Date | null;
  userId: string;
  assignedToId: string | null;
  replies?: Array<{
    id: string;
    body?: string;
    authorRole?: string;
    createdAt?: Date;
    author?: { username: string };
  }>;
  learner?: { username: string; email: string };
}) {
  const replyRows = row.replies ?? [];
  return {
    id: row.id,
    title: row.title,
    type: fromDbType(row.type),
    status: toUiStatus(row.status),
    dbStatus: row.status,
    problem: row.problem,
    topic: row.topic,
    language: row.language,
    description: row.description,
    preferredSlot: row.preferredSlot,
    source: row.source,
    assignedTo: row.assignedToName,
    assignedToId: row.assignedToId,
    userId: row.userId,
    learnerUsername: row.learner?.username ?? null,
    learnerEmail: row.learner?.email ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    claimedAt: row.claimedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    commentCount: replyRows.length,
    rating: row.rating,
    satisfied: row.satisfied,
    hasRecording: false,
    replies: replyRows
      .filter((r): r is typeof r & { body: string; authorRole: string; createdAt: Date } =>
        Boolean(r.body && r.authorRole && r.createdAt),
      )
      .map((r) => ({
        id: r.id,
        body: r.body,
        authorRole: r.authorRole,
        authorName: r.author?.username ?? (r.authorRole === 'ta' ? 'TA' : 'Learner'),
        createdAt: r.createdAt.toISOString(),
      })),
  };
}

const includeList = {
  replies: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { username: true } } },
  },
  learner: { select: { username: true, email: true } },
} as const;

export async function createTaHelpRequest(input: CreateTaHelpInput) {
  const row = await prisma.taHelpRequest.create({
    data: {
      userId: input.userId,
      title: input.title.trim(),
      type: toDbType(input.type),
      problem: input.problem.trim(),
      topic: input.topic,
      language: input.language,
      description: input.description.trim(),
      preferredSlot: input.preferredSlot?.trim() || null,
      source: input.source || 'web',
      status: 'WAITING',
    },
    include: includeList,
  });
  return serializeRequest(row);
}

export async function listMyTaHelpRequests(userId: string) {
  const rows = await prisma.taHelpRequest.findMany({
    where: { userId },
    include: includeList,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serializeRequest);
}

export async function listTaQueue(opts?: { status?: TaHelpStatus }) {
  const rows = await prisma.taHelpRequest.findMany({
    where: opts?.status
      ? { status: opts.status }
      : {
          status: { in: ['WAITING', 'CLAIMED', 'OPEN_POOL', 'REPLIED'] },
        },
    include: includeList,
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(serializeRequest);
}

export async function getTaHelpRequest(id: string) {
  const row = await prisma.taHelpRequest.findUnique({
    where: { id },
    include: includeList,
  });
  if (!row) return null;
  return serializeRequest(row);
}

export function isStaffRole(role: string | undefined): boolean {
  return role === 'ADMIN' || role === 'TA';
}

export async function claimTaHelpRequest(requestId: string, taUserId: string) {
  const ta = await prisma.user.findUnique({ where: { id: taUserId } });
  if (!ta) throw new AppError('USER_NOT_FOUND', 404, 'User not found');

  const existing = await prisma.taHelpRequest.findUnique({ where: { id: requestId } });
  if (!existing) throw new AppError('REQUEST_NOT_FOUND', 404, 'Help request not found');
  if (existing.status !== 'WAITING' && existing.status !== 'OPEN_POOL') {
    throw new AppError('NOT_CLAIMABLE', 409, 'Request is not available to claim');
  }

  const row = await prisma.taHelpRequest.update({
    where: { id: requestId },
    data: {
      status: 'CLAIMED',
      assignedToId: taUserId,
      assignedToName: ta.username,
      claimedAt: new Date(),
    },
    include: includeList,
  });
  return serializeRequest(row);
}

export async function replyToTaHelpRequest(input: {
  requestId: string;
  authorId: string;
  authorRole: 'learner' | 'ta';
  body: string;
}) {
  const existing = await prisma.taHelpRequest.findUnique({ where: { id: input.requestId } });
  if (!existing) throw new AppError('REQUEST_NOT_FOUND', 404, 'Help request not found');

  if (input.authorRole === 'learner' && existing.userId !== input.authorId) {
    throw new AppError('FORBIDDEN', 403, 'Not allowed');
  }

  const body = input.body.trim();
  if (body.length < 2) throw new AppError('EMPTY_REPLY', 400, 'Reply cannot be empty');

  await prisma.taHelpReply.create({
    data: {
      requestId: input.requestId,
      authorId: input.authorId,
      authorRole: input.authorRole,
      body,
    },
  });

  const nextStatus =
    input.authorRole === 'ta'
      ? ('REPLIED' as const)
      : existing.status === 'RESOLVED'
        ? existing.status
        : existing.status;

  const row = await prisma.taHelpRequest.update({
    where: { id: input.requestId },
    data: {
      status: input.authorRole === 'ta' ? nextStatus : existing.status,
      updatedAt: new Date(),
    },
    include: includeList,
  });

  return serializeRequest(row);
}

export async function updateTaHelpStatus(input: {
  requestId: string;
  status: 'OPEN_POOL' | 'RESOLVED' | 'WAITING';
  actorId: string;
  asStaff: boolean;
}) {
  const existing = await prisma.taHelpRequest.findUnique({ where: { id: input.requestId } });
  if (!existing) throw new AppError('REQUEST_NOT_FOUND', 404, 'Help request not found');
  if (!input.asStaff && existing.userId !== input.actorId) {
    throw new AppError('FORBIDDEN', 403, 'Not allowed');
  }

  const row = await prisma.taHelpRequest.update({
    where: { id: input.requestId },
    data: {
      status: input.status,
      resolvedAt: input.status === 'RESOLVED' ? new Date() : existing.resolvedAt,
      assignedToId: input.status === 'OPEN_POOL' ? null : existing.assignedToId,
      assignedToName: input.status === 'OPEN_POOL' ? null : existing.assignedToName,
    },
    include: includeList,
  });
  return serializeRequest(row);
}

export async function submitTaHelpFeedback(input: {
  requestId: string;
  userId: string;
  satisfied?: boolean;
  rating?: number;
}) {
  const existing = await prisma.taHelpRequest.findUnique({ where: { id: input.requestId } });
  if (!existing) throw new AppError('REQUEST_NOT_FOUND', 404, 'Help request not found');
  if (existing.userId !== input.userId) throw new AppError('FORBIDDEN', 403, 'Not allowed');

  const row = await prisma.taHelpRequest.update({
    where: { id: input.requestId },
    data: {
      satisfied: input.satisfied ?? existing.satisfied,
      rating: input.rating ?? existing.rating,
      status: 'RESOLVED',
      resolvedAt: existing.resolvedAt ?? new Date(),
    },
    include: includeList,
  });
  return serializeRequest(row);
}

export async function countWaitingVideoCalls(userId: string) {
  return prisma.taHelpRequest.count({
    where: {
      userId,
      type: 'VIDEO',
      status: { in: ['WAITING', 'CLAIMED'] },
    },
  });
}
