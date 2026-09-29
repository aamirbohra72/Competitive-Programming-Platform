'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import {
  type TaHelpRequest,
  formatRelativeTime,
} from '@/data/ta-help';

type TaHelpRequestCardProps = {
  request: TaHelpRequest;
  onSatisfied: (id: string, satisfied: boolean) => void;
  onRate: (id: string, rating: number) => void;
};

export function TaHelpRequestCard({ request, onSatisfied, onRate }: TaHelpRequestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const typeLabel = request.type === 'video' ? 'VIDEO CALL HR' : 'TEXT HR';
  const typeClass =
    request.type === 'video'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-sky-200 bg-sky-50 text-sky-800';

  return (
    <article className="rounded-lg border border-[var(--border-theme)] bg-white p-5 transition hover:border-green-400 hover:shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold uppercase tracking-wide text-[var(--text-theme)] md:text-lg">
              {request.title}
            </h3>
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                typeClass,
              )}
            >
              {typeLabel}
            </span>
            <button
              type="button"
              onClick={() => setShowDetail((v) => !v)}
              className="text-xs font-semibold text-green-700 hover:text-green-800"
            >
              {showDetail ? 'Hide details' : 'Quick view'}
            </button>
          </div>

          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--text-muted)]">Assigned to</dt>
              <dd className="font-medium text-[var(--text-theme)]">
                {request.assignedTo ?? 'Unassigned'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Created</dt>
              <dd className="font-medium text-[var(--text-theme)]">
                {formatRelativeTime(request.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Problem</dt>
              <dd className="font-medium text-[var(--text-theme)]">{request.problem}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Topic</dt>
              <dd className="font-medium text-[var(--text-theme)]">{request.topic}</dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--border-theme)] bg-[var(--surface-panel)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
              {request.language}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              Raised {formatRelativeTime(request.createdAt).toLowerCase()}
            </span>
          </div>

          {(showDetail || expanded) && (
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
              {request.description}
            </p>
          )}
          {!showDetail && !expanded && request.description.length > 120 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-2 text-xs font-semibold text-green-700 hover:text-green-800"
            >
              View more
            </button>
          )}

          {(showDetail || expanded) && (request.replies?.length ?? 0) > 0 && (
            <div className="mt-4 space-y-2 border-t border-[var(--border-theme)] pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Replies</p>
              {request.replies!.map((reply) => (
                <div
                  key={reply.id}
                  className="rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] px-3 py-2"
                >
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {reply.authorName} · {reply.authorRole} ·{' '}
                    {formatRelativeTime(reply.createdAt)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-theme)]">{reply.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-56">
          <div className="flex items-center justify-between gap-2 text-sm text-[var(--text-muted)] lg:justify-end">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden>💬</span>
              View comments
              {request.commentCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">
                  {request.commentCount}
                </span>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowDetail(true)}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800"
          >
            {request.type === 'video' && request.hasRecording ? 'View recording' : 'View request'}
          </button>

          {(request.status === 'replied' || request.status === 'resolved') && (
            <div className="rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] p-3">
              {request.satisfied == null ? (
                <>
                  <p className="text-xs font-medium text-[var(--text-theme)]">Satisfied with the solution?</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSatisfied(request.id, true)}
                      className="flex-1 rounded-full border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => onSatisfied(request.id, false)}
                      className="flex-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                    >
                      No
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--text-muted)]">Your rating helps your TA improve.</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-[var(--text-theme)]">Your rating to the TA</p>
                  <div className="mt-2 flex gap-1" role="group" aria-label="Rate TA">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => onRate(request.id, star)}
                        className={cn(
                          'text-lg leading-none transition',
                          (request.rating ?? 0) >= star ? 'text-green-700' : 'text-[var(--text-muted)] hover:text-green-700',
                        )}
                        aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  {request.satisfied && (
                    <p className="mt-1 text-[10px] text-green-700">Marked satisfied</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
