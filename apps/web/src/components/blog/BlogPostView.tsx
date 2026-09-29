'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BlogTagList } from '@/components/blog/BlogTagList';
import { api } from '@/lib/api';
import type { BlogPost } from '@/data/blog';
import { postDisplayDate } from '@/data/blog';
import type { BlogLivePost } from '@/types/blog-hub';

type Props = {
  postId: string;
  initialPost: BlogPost | null;
};

export function BlogPostView({ postId, initialPost }: Props) {
  const [post, setPost] = useState<BlogPost | null>(initialPost);
  const [loading, setLoading] = useState(!initialPost);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialPost) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const live = await api.get<BlogLivePost>(`/blog/${encodeURIComponent(postId)}`);
        if (cancelled) return;
        setPost({
          id: live.id,
          title: live.title,
          author: live.author,
          date: live.date,
          excerpt: live.excerpt,
          readMinutes: live.readMinutes,
          tags: live.tags,
          featured: live.featured,
          body: live.body,
          source: 'mistral',
          category: live.category,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Post not found');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialPost, postId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-[var(--text-muted)]">
        <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-green-200 border-t-green-700" />
        Loading article…
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-red-700">{error || 'Post not found'}</p>
        <Link href="/blog" className="mt-4 inline-block text-sm text-green-700 hover:text-green-800">
          ← Back to blog
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <Link
        href="/blog"
        className="text-sm font-medium text-green-700 hover:text-green-800 focus:outline-none focus-visible:underline"
      >
        ← All posts
      </Link>
      <header className="mt-6 border-b border-[var(--border-theme)] pb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-muted)]">
          <time dateTime={post.date}>{postDisplayDate(post)}</time>
          <span className="text-[var(--text-muted)]">·</span>
          <span>{post.readMinutes} min read</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="text-green-700">By {post.author}</span>
          {post.source === 'mistral' ? (
            <>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-800">
                Live · Mistral
              </span>
            </>
          ) : null}
        </div>
        <h1 className="mt-4 font-nav-brand text-3xl font-bold leading-tight text-[var(--text-theme)] sm:text-4xl">
          {post.title}
        </h1>
        <BlogTagList tags={post.tags} className="mt-4" />
      </header>
      <div className="mt-10 space-y-6">
        <p className="text-lg leading-relaxed text-[var(--text-theme)]">{post.excerpt}</p>
        {post.body && post.body.length > 0 ? (
          post.body.map((para, i) => (
            <p key={i} className="leading-relaxed text-[var(--text-muted)]">
              {para}
            </p>
          ))
        ) : (
          <p className="leading-relaxed text-[var(--text-muted)]">
            Full article content can be loaded from your CMS or MDX. This route is wired for static
            generation from the shared{' '}
            <code className="rounded bg-green-50 px-1.5 py-0.5 text-sm text-green-800">blog</code>{' '}
            data module so links from the index never 404.
          </p>
        )}
      </div>
    </article>
  );
}
