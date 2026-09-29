import Link from 'next/link';
import type { BlogPost } from '@/data/blog';
import { postDisplayDate } from '@/data/blog';
import { BlogTagList } from '@/components/blog/BlogTagList';
import { cn } from '@/lib/cn';

type BlogPostCompactCardProps = {
  post: BlogPost;
  className?: string;
  highlight?: boolean;
};

export function BlogPostCompactCard({ post, className, highlight }: BlogPostCompactCardProps) {
  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-lg border border-[var(--border-theme)] bg-white p-5 transition-colors hover:border-green-400 hover:bg-green-50/30',
        highlight && 'ring-1 ring-green-300',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 pr-16 text-xs text-[var(--text-muted)]">
        <time dateTime={post.date}>{postDisplayDate(post)}</time>
        <span className="text-[var(--text-muted)]">·</span>
        <span>{post.readMinutes} min</span>
      </div>
      <h3 className="mt-2 min-h-[2.75rem] font-nav-brand text-lg font-semibold leading-snug text-[var(--text-theme)]">
        <Link
          href={`/blog/${post.id}`}
          className="line-clamp-2 hover:text-green-700 focus:outline-none focus-visible:text-green-700 focus-visible:underline"
        >
          {post.title}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-[var(--text-muted)]">
        {post.excerpt}
      </p>
      <BlogTagList tags={post.tags.slice(0, 3)} className="mt-3 max-h-7 overflow-hidden" />
      <p className="mt-auto pt-3 text-xs text-[var(--text-muted)]">By {post.author}</p>
    </article>
  );
}
