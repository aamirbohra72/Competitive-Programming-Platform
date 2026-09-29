import { cn } from '@/lib/cn';

type BlogTagListProps = {
  tags: string[];
  className?: string;
};

export function BlogTagList({ tags, className }: BlogTagListProps) {
  if (tags.length === 0) return null;
  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {tags.map((tag) => (
        <li key={tag}>
          <span className="rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-800">
            {tag}
          </span>
        </li>
      ))}
    </ul>
  );
}
