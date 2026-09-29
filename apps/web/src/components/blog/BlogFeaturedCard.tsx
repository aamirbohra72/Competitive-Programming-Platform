import Link from 'next/link';
import type { BlogPost } from '@/data/blog';
import { postDisplayDate } from '@/data/blog';
import { BlogTagList } from '@/components/blog/BlogTagList';
import { cn } from '@/lib/cn';

type BlogFeaturedCardProps = {
  post: BlogPost;
  className?: string;
};

export function BlogFeaturedCard({ post, className }: BlogFeaturedCardProps) {
  return (
    <article
      className={cn(
        'group overflow-hidden rounded-lg border border-[var(--border-theme)] bg-white shadow-sm transition-colors hover:border-green-400 hover:shadow-md hover:shadow-green-900/10',
        className,
      )}
    >
      <div className="h-2 bg-green-700" />
      <div className="p-6 sm:p-8">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-muted)]">
          <time dateTime={post.date}>{postDisplayDate(post)}</time>
          <span aria-hidden className="text-[var(--text-muted)]">
            ·
          </span>
          <span>{post.readMinutes} min read</span>
          <span aria-hidden className="text-[var(--text-muted)]">
            ·
          </span>
          <span className="text-green-700">By {post.author}</span>
        </div>
        <h3 className="font-nav-brand text-2xl font-bold leading-snug text-[var(--text-theme)] transition-colors group-hover:text-green-700 sm:text-3xl">
          <Link href={`/blog/${post.id}`} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white">
            {post.title}
          </Link>
        </h3>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--text-muted)]">{post.excerpt}</p>
        <BlogTagList tags={post.tags} className="mt-4" />
        <div className="mt-6">
          <Link
            href={`/blog/${post.id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-green-700 transition-colors hover:text-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Read article
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}
