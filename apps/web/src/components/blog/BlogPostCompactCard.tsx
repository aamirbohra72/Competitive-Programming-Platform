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
        'flex h-full flex-col rounded-lg border border-white/[0.08] bg-[#242424] p-5 transition-colors hover:border-green-500/20',
        highlight && 'ring-1 ring-green-500/30',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 pr-16 text-xs text-white/45">
        <time dateTime={post.date}>{postDisplayDate(post)}</time>
        <span className="text-white/20">·</span>
        <span>{post.readMinutes} min</span>
      </div>
      <h3 className="mt-2 min-h-[2.75rem] font-nav-brand text-lg font-semibold leading-snug text-white">
        <Link
          href={`/blog/${post.id}`}
          className="line-clamp-2 hover:text-green-400 focus:outline-none focus-visible:text-green-400 focus-visible:underline"
        >
          {post.title}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-white/55">
        {post.excerpt}
      </p>
      <BlogTagList tags={post.tags.slice(0, 3)} className="mt-3 max-h-7 overflow-hidden" />
      <p className="mt-auto pt-3 text-xs text-white/40">By {post.author}</p>
    </article>
  );
}
