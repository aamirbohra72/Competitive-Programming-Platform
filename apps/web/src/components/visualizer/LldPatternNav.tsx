'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  categoriesWithLldPatterns,
  getDefaultLldPatternId,
  getLldPatternStats,
  LLD_PATTERN_CATEGORIES,
  searchLldPatterns,
  type LldPattern,
} from '@/data/lld-pattern-catalog';
import { getTrack } from '@/data/visualizer-tracks';
import { cn } from '@/lib/cn';

type LldPatternNavProps = {
  activePatternId: string;
  onSelect: (pattern: LldPattern) => void;
  className?: string;
};

export function LldPatternNav({ activePatternId, onSelect, className }: LldPatternNavProps) {
  const trackMeta = getTrack('lld');
  const stats = getLldPatternStats();
  const [query, setQuery] = useState('');
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => {
    const active = LLD_PATTERN_CATEGORIES.find((c) =>
      c.patterns.some((p) => p.id === activePatternId),
    );
    return new Set(active ? [active.id] : [LLD_PATTERN_CATEGORIES[0]?.id].filter(Boolean));
  });

  const filteredIds = useMemo(() => {
    if (!query.trim()) return null;
    return new Set(searchLldPatterns(query).map((p) => p.id));
  }, [query]);

  const visibleCategories = useMemo(
    () => categoriesWithLldPatterns(filteredIds),
    [filteredIds],
  );

  const toggleCategory = (id: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside
      className={cn(
        'flex w-[140px] shrink-0 flex-col border-r border-[var(--border-theme)] bg-[var(--surface-panel)] sm:w-[220px] lg:w-[260px]',
        className,
      )}
    >
      <div className="shrink-0 border-b border-[var(--border-theme)] px-3 py-3">
        <Link
          href="/visualizer"
          className="mb-2 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] transition hover:text-green-700"
        >
          ← All tracks
        </Link>
        <div className="text-sm font-semibold text-[var(--text-theme)]">
          <span className="text-green-700">LLD</span> Visual
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
          {stats.animated} animated · {stats.total} topics
        </p>
        <div className="relative mt-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics…"
            className="w-full rounded-lg border border-[var(--border-theme)] bg-white py-2 pl-3 pr-8 text-xs text-[var(--text-theme)] placeholder:text-[var(--text-muted)] outline-none focus:border-green-500"
          />
        </div>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
        aria-label={trackMeta?.subtitle ?? 'LLD topics'}
      >
        {visibleCategories.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-[var(--text-muted)]">No topics match</p>
        ) : (
          visibleCategories.map((category) => {
            const isOpen = openCategories.has(category.id) || Boolean(query.trim());
            return (
              <div key={category.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] transition hover:bg-green-50 hover:text-green-700"
                >
                  <span
                    className={cn(
                      'text-[10px] transition-transform',
                      isOpen && 'rotate-90 text-emerald-400',
                    )}
                  >
                    ▸
                  </span>
                  <span className="min-w-0 flex-1 truncate">{category.title}</span>
                  <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                    {category.patterns.length}
                  </span>
                </button>
                {isOpen ? (
                  <ul className="mb-2 space-y-0.5 pl-1">
                    {category.patterns.map((pattern) => {
                      const active = pattern.id === activePatternId;
                      return (
                        <li key={pattern.id}>
                          <button
                            type="button"
                            onClick={() => onSelect(pattern)}
                            className={cn(
                              'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition',
                              active
                                ? 'bg-green-100 font-medium text-green-800'
                                : 'text-[var(--text-muted)] hover:bg-green-50 hover:text-[var(--text-theme)]',
                            )}
                          >
                            <span className="min-w-0 flex-1 leading-snug">{pattern.title}</span>
                            {pattern.visualScriptId ? (
                              <span
                                className="mt-0.5 shrink-0 text-[9px] font-bold uppercase text-emerald-400"
                                title="Animated"
                              >
                                ▶
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
      </nav>
    </aside>
  );
}

export { getDefaultLldPatternId };
