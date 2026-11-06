import Link from "next/link";
import { ApiError, getBlogPosts, getBlogTags } from "../../lib/api";
import { PageHeading } from "../../components/content/page-heading";
import { BlogTagLinks } from "../../components/content/blog-tag-links";
import { publicPageMetadata } from "../../lib/metadata";

const PAGE_SIZE = 10;

type BlogSearchParams = Promise<{
  page?: string | string[];
  tag?: string | string[];
}>;

export async function generateMetadata({ searchParams }: { searchParams: BlogSearchParams }) {
  const params = await searchParams;
  const requestedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 1 ? requestedPage : undefined;
  const tag = typeof params.tag === "string" ? params.tag.trim() : "";
  const query = new URLSearchParams();
  if (page) query.set("page", String(page));
  if (tag) query.set("tag", tag);

  const path = query.size > 0 ? `/blog?${query.toString()}` : "/blog";
  const title = tag ? `Blog: ${tag}` : "Blog";
  const description = tag
    ? `Technical writing tagged ${tag}, covering software engineering, AI, and independent work.`
    : "Technical writing on software engineering, AI, and independent work.";
  return publicPageMetadata(title, description, path);
}

function pageNumber(value: string | string[] | undefined): number {
  if (typeof value !== "string") {
    return 1;
  }

  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function formatPublishedDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

function unavailableMessage(error: unknown, activeTag?: string, knownTag = false): string {
  if (error instanceof ApiError && error.status === 404) {
    if (activeTag && !knownTag) return "This tag was not found.";
    return activeTag ? "There are no posts with this tag on this page." : "There are no posts on this page.";
  }
  return "Blog posts are temporarily unavailable. Please try again later.";
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: BlogSearchParams;
}) {
  const params = await searchParams;
  const currentPage = pageNumber(params.page);
  const requestedTag = typeof params.tag === "string" ? params.tag.trim() : "";
  const activeTag = requestedTag || undefined;
  const tagsResult = await getBlogTags().then(
    (value) => ({ value, error: undefined }),
    (error: unknown) => ({ value: undefined, error }),
  );
  const tags = tagsResult.value?.results ?? [];
  const selectedTag = tags.find((tag) => tag.slug === activeTag);

  try {
    const posts = await getBlogPosts({ page: currentPage, pageSize: PAGE_SIZE, tag: activeTag });
    const pageCount = Math.ceil(posts.count / PAGE_SIZE);

    return (
      <>
        <PageHeading title={selectedTag ? `Blog: ${selectedTag.name}` : "Blog"}>
          <p>Technical writing on software engineering, AI, and independent work.</p>
        </PageHeading>

        {activeTag && (
          <p className="blog-active-tag" role="status">
            Showing posts tagged <strong>{selectedTag?.name ?? activeTag}</strong>.{" "}
            <Link href="/blog">Clear tag filter</Link>
          </p>
        )}
        {tags.length > 0 && <BlogTagLinks tags={tags} activeTag={activeTag} />}
        {tagsResult.error && (
          <p className="blog-tag-unavailable" role="status">Tag navigation is temporarily unavailable.</p>
        )}

        {posts.results.length === 0 ? (
          <p className="blog-notice" role="status">
            {activeTag ? `No published posts are available for “${selectedTag?.name ?? activeTag}”.` : "No posts have been published yet."}
          </p>
        ) : (
          <>
            <ol className="blog-post-list" aria-label="Published posts">
              {posts.results.map((post) => (
                <li className="blog-post" key={post.slug}>
                  <p className="eyebrow blog-post-kicker">Field notes / {post.tags[0]?.name || "Engineering"}</p>
                  <h2>
                    <Link href={`/blog/${encodeURIComponent(post.slug)}`}>
                      {post.title}
                      <span className="blog-post-arrow" aria-hidden="true">↗</span>
                    </Link>
                  </h2>
                  <p className="blog-post-meta">
                    <span>By {post.author.name}</span>
                    <time dateTime={post.published_at}>
                      {formatPublishedDate(post.published_at)}
                    </time>
                  </p>
                  {post.tags.length > 0 && <BlogTagLinks tags={post.tags} label="Topics" />}
                </li>
              ))}
            </ol>

            {pageCount > 1 && (
              <nav className="blog-pagination" aria-label="Blog pages">
                {posts.previous ? (
                  <Link href={blogUrl(currentPage - 1, activeTag)}>Previous page</Link>
                ) : (
                  <span aria-disabled="true">Previous page</span>
                )}
                <p className="blog-pagination-status">
                  Page {currentPage} of {pageCount}
                </p>
                {posts.next ? (
                  <Link href={blogUrl(currentPage + 1, activeTag)}>Next page</Link>
                ) : (
                  <span aria-disabled="true">Next page</span>
                )}
              </nav>
            )}
          </>
        )}
      </>
    );
  } catch (error) {
    return (
      <>
        <PageHeading title={selectedTag ? `Blog: ${selectedTag.name}` : "Blog"} />
        {activeTag && (
          <p className="blog-active-tag" role="status">
            Showing posts tagged <strong>{selectedTag?.name ?? activeTag}</strong>.{" "}
            <Link href="/blog">Clear tag filter</Link>
          </p>
        )}
        {tags.length > 0 && <BlogTagLinks tags={tags} activeTag={activeTag} />}
        <p className="blog-notice" role="alert">
          {unavailableMessage(error, activeTag, Boolean(selectedTag))}
        </p>
        {error instanceof ApiError && error.status === 404 && (
          <p>
            <Link href={activeTag ? blogUrl(1, activeTag) : "/blog"}>
              {activeTag && !selectedTag ? "Browse all posts" : "Return to the first page"}
            </Link>
          </p>
        )}
      </>
    );
  }
}

function blogUrl(page: number, tag?: string): string {
  const query = new URLSearchParams({ page: String(page) });
  if (tag) query.set("tag", tag);
  return `/blog?${query.toString()}`;
}
