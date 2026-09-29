'use client';

import type { ReactNode } from 'react';
import type { DsaProblem } from '@/data/dsa-sheet';
import { DsaDifficultyBadge } from '@/components/dsa-sheet/DsaDifficultyBadge';
import { cn } from '@/lib/cn';

type DsaProblemTableProps = {
  problems: DsaProblem[];
  completedIds: Set<string>;
  onToggleComplete: (problemId: string, completed: boolean) => void;
};

function ExternalLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-theme)]',
        'bg-white text-green-700 transition-colors hover:border-green-400 hover:bg-green-50',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
      )}
      aria-label={label}
      title={label}
    >
      {icon}
    </a>
  );
}

export function DsaProblemTable({ problems, completedIds, onToggleComplete }: DsaProblemTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-theme)]">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border-theme)] bg-green-50">
            <th className="px-3 py-3 font-semibold text-[var(--text-muted)] w-14">Done</th>
            <th className="px-3 py-3 font-semibold text-[var(--text-muted)]">Problem</th>
            <th className="px-3 py-3 font-semibold text-[var(--text-muted)] text-center w-16">Practice</th>
            <th className="px-3 py-3 font-semibold text-[var(--text-muted)] text-center w-16">Video</th>
            <th className="px-3 py-3 font-semibold text-[var(--text-muted)] text-center w-16">Notes</th>
            <th className="px-3 py-3 font-semibold text-[var(--text-muted)] w-28">Difficulty</th>
          </tr>
        </thead>
        <tbody>
          {problems.map((prob, rowIdx) => {
            const done = completedIds.has(prob.id);
            return (
              <tr
                key={prob.id}
                className={cn(
                  'border-b border-[var(--border-theme)] transition-colors hover:bg-green-50',
                  rowIdx % 2 === 0 ? 'bg-white' : 'bg-[var(--surface-panel)]',
                )}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={(e) => onToggleComplete(prob.id, e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border-theme)] bg-white text-green-700 focus:ring-green-500 focus:ring-offset-0 focus:ring-offset-white"
                    aria-label={`Mark ${prob.title} as ${done ? 'incomplete' : 'complete'}`}
                  />
                </td>
                <td className="px-3 py-3 font-medium text-[var(--text-theme)]">{prob.title}</td>
                <td className="px-3 py-3 text-center">
                  <ExternalLink
                    href={prob.practiceUrl}
                    label={`Practice: ${prob.title}`}
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M14 3h7v7M10 14L21 3M21 14v7h-7M3 10L14 21"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    }
                  />
                </td>
                <td className="px-3 py-3 text-center">
                  <ExternalLink
                    href={prob.videoUrl}
                    label={`Video for ${prob.title}`}
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    }
                  />
                </td>
                <td className="px-3 py-3 text-center">
                  <ExternalLink
                    href={prob.editorialUrl}
                    label={`Editorial for ${prob.title}`}
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    }
                  />
                </td>
                <td className="px-3 py-3">
                  <DsaDifficultyBadge difficulty={prob.difficulty} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
