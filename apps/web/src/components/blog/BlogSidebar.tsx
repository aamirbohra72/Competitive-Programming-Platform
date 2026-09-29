import Link from 'next/link';
import type { BlogTopic } from '@/data/blog';
import { BlogSectionTitle } from '@/components/blog/BlogSectionTitle';
import { cn } from '@/lib/cn';

type BlogSidebarProps = {
  topics: BlogTopic[];
  className?: string;
};

export function BlogSidebar({ topics, className }: BlogSidebarProps) {
  return (
    <aside className={cn('flex flex-col gap-10', className)}>
      {topics.map((topic) => (
        <div key={topic.id}>
          <BlogSectionTitle className="mb-4">{topic.label}</BlogSectionTitle>
          <ul className="space-y-0 divide-y divide-[var(--border-theme)] rounded-lg border border-[var(--border-theme)] bg-white">
            {topic.items.map((item) => (
              <li key={item.id}>
                <span className="block px-4 py-3 text-sm leading-snug text-[var(--text-theme)]">{item.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] p-6">
        <BlogSectionTitle className="mb-3">Newsletter</BlogSectionTitle>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          Weekly notes on algorithms, system design, and contest patterns. No spam.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <label htmlFor="blog-newsletter-email" className="sr-only">
            Email
          </label>
          <input
            id="blog-newsletter-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-md border border-[var(--border-theme)] bg-white px-3 py-2.5 text-sm text-[var(--text-theme)] placeholder:text-[var(--text-muted)] focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Subscribe
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          Prefer to code?{' '}
          <Link href="/practice" className="text-green-700 hover:text-green-800">
            Practice
          </Link>{' '}
          or{' '}
          <Link href="/learn" className="text-green-700 hover:text-green-800">
            Courses
          </Link>
          .
        </p>
      </div>
    </aside>
  );
}
