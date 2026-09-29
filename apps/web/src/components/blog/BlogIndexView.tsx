'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BLOG_FEATURED,
  BLOG_RECENT,
  BLOG_TOPICS,
  type BlogPost,
} from '@/data/blog';
import { api } from '@/lib/api';
import type { BlogHub, BlogLivePost } from '@/types/blog-hub';
import { BlogFeaturedCard } from '@/components/blog/BlogFeaturedCard';
import { BlogPostCompactCard } from '@/components/blog/BlogPostCompactCard';
import { BlogSidebar } from '@/components/blog/BlogSidebar';
import { BlogSectionTitle } from '@/components/blog/BlogSectionTitle';

function normalize(s: string) {
  return s.toLowerCase().trim();
}

function matchesQuery(post: BlogPost, q: string) {
  if (!q) return true;
  const n = normalize(q);
  return (
    normalize(post.title).includes(n) ||
    normalize(post.author).includes(n) ||
    post.tags.some((t) => normalize(t).includes(n)) ||
    (post.category ? normalize(post.category).includes(n) : false)
  );
}

function toBlogPost(p: BlogLivePost): BlogPost {
  return {
    id: p.id,
    title: p.title,
    author: p.author,
    date: p.date,
    excerpt: p.excerpt,
    readMinutes: p.readMinutes,
    tags: p.tags,
    featured: p.featured,
    body: p.body,
    source: 'mistral',
    category: p.category,
  };
}

const CATEGORY_LABEL: Record<string, string> = {
  algorithms: 'Algorithms',
  'system-design': 'System design',
  genai: 'GenAI',
  blockchain: 'Blockchain',
  careers: 'Careers',
  contest: 'Contests',
};

export function BlogIndexView() {
  const [query, setQuery] = useState('');
  const [hub, setHub] = useState<BlogHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string>('all');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = refresh
        ? await api.post<BlogHub>('/blog/refresh', {})
        : await api.get<BlogHub>('/blog');
      setHub(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load live posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const editorialFeatured = useMemo(
    () => BLOG_FEATURED.map((p) => ({ ...p, source: 'editorial' as const })),
    [],
  );
  const editorialRecent = useMemo(
    () => BLOG_RECENT.map((p) => ({ ...p, source: 'editorial' as const })),
    [],
  );

  const livePosts = useMemo(
    () => (hub?.posts ?? []).map(toBlogPost),
    [hub],
  );

  const featuredLead = editorialFeatured[0];
  const featuredRest = editorialFeatured.slice(1);

  const filteredFeaturedRest = useMemo(
    () => featuredRest.filter((p) => matchesQuery(p, query)),
    [featuredRest, query],
  );
  const filteredRecent = useMemo(
    () => editorialRecent.filter((p) => matchesQuery(p, query)),
    [editorialRecent, query],
  );
  const filteredLive = useMemo(() => {
    return livePosts.filter((p) => {
      if (category !== 'all' && p.category !== category) return false;
      return matchesQuery(p, query);
    });
  }, [livePosts, category, query]);

  const liveFeatured = filteredLive.filter((p) => p.featured);
  const liveRest = filteredLive.filter((p) => !p.featured);

  const showFeaturedLead = matchesQuery(featuredLead, query);
  const hasEditorial =
    showFeaturedLead || filteredFeaturedRest.length > 0 || filteredRecent.length > 0;
  const hasLive = filteredLive.length > 0;
  const hasAny = hasEditorial || hasLive || loading;

  const categories = useMemo(() => {
    const set = new Set(livePosts.map((p) => p.category).filter(Boolean) as string[]);
    return ['all', ...Array.from(set)];
  }, [livePosts]);

  return (
    <div className="min-h-full">
      <div className="border-b border-[var(--border-theme)] bg-[var(--surface-panel)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
            Engineering blog · Live via Mistral
          </p>
          <h1 className="mt-3 max-w-3xl font-nav-brand text-3xl font-bold text-[var(--text-theme)] sm:text-4xl lg:text-5xl">
            {hub?.headline || 'Build faster. Think deeper.'}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--text-muted)]">
            {hub?.summary ||
              'Editorial tutorials plus fresh GenAI, blockchain, contest, and career notes — generated in real time.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-theme)] bg-white px-3 py-1 text-xs text-[var(--text-muted)]">
              {hub?.generatedAt
                ? `Live pack · ${new Date(hub.generatedAt).toLocaleString()}`
                : loading
                  ? 'Fetching live pack…'
                  : 'Editorial posts ready'}
            </span>
            <span className="rounded-full border border-[var(--border-theme)] bg-white px-3 py-1 text-xs text-[var(--text-muted)]">
              {editorialFeatured.length + editorialRecent.length} editorial · {livePosts.length || '—'} live
            </span>
            <button
              type="button"
              disabled={loading || refreshing}
              onClick={() => void load(true)}
              className="ml-auto rounded-md bg-green-700 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-green-800 disabled:opacity-60"
            >
              {refreshing ? 'Regenerating…' : 'Regenerate with Mistral'}
            </button>
          </div>
          <div className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor="blog-search" className="sr-only">
              Search articles
            </label>
            <input
              id="blog-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, author, or tag…"
              className="w-full flex-1 rounded-lg border border-[var(--border-theme)] bg-white px-4 py-3 text-sm text-[var(--text-theme)] placeholder:text-[var(--text-muted)] focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/25"
            />
            <Link
              href="/blog/write"
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--border-theme)] bg-white px-4 py-3 text-sm font-medium text-green-700 transition-colors hover:border-green-400 hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
            >
              Write a post
            </Link>
          </div>
          {error ? (
            <p className="mt-4 text-sm text-red-700">
              Live posts unavailable: {error}{' '}
              <button type="button" className="underline" onClick={() => void load(true)}>
                Retry
              </button>
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {!hasAny ? (
          <p className="rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] px-6 py-12 text-center text-[var(--text-muted)]">
            No articles match “{query}”. Try another keyword or{' '}
            <button
              type="button"
              className="text-green-700 underline decoration-green-500/40 hover:text-green-800"
              onClick={() => setQuery('')}
            >
              clear search
            </button>
            .
          </p>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1fr_320px] lg:gap-12">
            <div className="min-w-0 space-y-12">
              {showFeaturedLead ? (
                <section aria-labelledby="featured-heading">
                  <BlogSectionTitle id="featured-heading" className="mb-6">
                    Featured
                  </BlogSectionTitle>
                  <BlogFeaturedCard post={featuredLead} />
                </section>
              ) : null}

              <section aria-labelledby="live-heading">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                  <BlogSectionTitle id="live-heading">Live from Mistral</BlogSectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          category === c
                            ? 'border-green-500 bg-green-50 text-green-800'
                            : 'border-[var(--border-theme)] bg-white text-[var(--text-muted)] hover:border-green-400 hover:bg-green-50'
                        }`}
                      >
                        {c === 'all' ? 'All' : CATEGORY_LABEL[c] || c}
                      </button>
                    ))}
                  </div>
                </div>

                {loading && !hub ? (
                  <div className="rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] px-6 py-10 text-center text-sm text-[var(--text-muted)]">
                    <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-green-200 border-t-green-700" />
                    Generating fresh articles with Mistral…
                  </div>
                ) : null}

                {liveFeatured.length > 0 ? (
                  <div className="mb-5 space-y-5">
                    {liveFeatured.map((post) => (
                      <div key={post.id} className="relative">
                        <span className="absolute right-4 top-4 z-10 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-800">
                          AI · {CATEGORY_LABEL[post.category || ''] || post.category}
                        </span>
                        <BlogFeaturedCard post={post} />
                      </div>
                    ))}
                  </div>
                ) : null}

                {liveRest.length > 0 ? (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {liveRest.map((post) => (
                      <div key={post.id} className="relative h-full">
                        <span className="absolute right-3 top-3 z-10 rounded-full border border-[var(--border-theme)] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          {CATEGORY_LABEL[post.category || ''] || 'Live'}
                        </span>
                        <BlogPostCompactCard post={post} highlight />
                      </div>
                    ))}
                  </div>
                ) : null}

                {!loading && hub && filteredLive.length === 0 ? (
                  <p className="rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    No live posts match this filter.
                  </p>
                ) : null}
              </section>

              {filteredFeaturedRest.length > 0 ? (
                <section aria-labelledby="editorial-heading">
                  <BlogSectionTitle id="editorial-heading" className="mb-6">
                    Editorial picks
                  </BlogSectionTitle>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredFeaturedRest.map((post) => (
                      <div key={post.id} className="h-full">
                        <BlogPostCompactCard post={post} />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {filteredRecent.length > 0 ? (
                <section aria-labelledby="recent-heading">
                  <BlogSectionTitle id="recent-heading" className="mb-6">
                    Recent
                  </BlogSectionTitle>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredRecent.map((post) => (
                      <div key={post.id} className="h-full">
                        <BlogPostCompactCard
                          post={post}
                          highlight={post.featured === true}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <BlogSidebar topics={BLOG_TOPICS} className="lg:sticky lg:top-24 lg:self-start" />
          </div>
        )}

        <footer className="mt-16 border-t border-[var(--border-theme)] pt-10 text-center text-sm text-[var(--text-muted)]">
          <p>
            © {new Date().getFullYear()} Codeforces Platform —{' '}
            <Link href="/learn" className="text-green-700 hover:text-green-800">
              Learn
            </Link>
            {' · '}
            <Link href="/practice" className="text-green-700 hover:text-green-800">
              Practice
            </Link>
            {' · '}
            <Link href="/leaderboard" className="text-green-700 hover:text-green-800">
              Leaderboard
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
