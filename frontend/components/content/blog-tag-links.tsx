import Link from "next/link";
import type { BlogTag } from "../../lib/api";

type BlogTagLinksProps = {
  tags: BlogTag[];
  activeTag?: string;
  label?: string;
};

export function BlogTagLinks({ tags, activeTag, label = "Browse by tag" }: BlogTagLinksProps) {
  if (tags.length === 0) return null;

  return (
    <nav className="blog-tags" aria-label={label}>
      <p>{label}</p>
      <ul>
        {tags.map((tag) => (
          <li key={tag.slug}>
            <Link
              href={`/blog?tag=${encodeURIComponent(tag.slug)}`}
              aria-current={tag.slug === activeTag ? "page" : undefined}
            >
              {tag.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
