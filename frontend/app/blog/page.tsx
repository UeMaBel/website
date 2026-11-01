import Link from "next/link";
import { ApiError, getBlogPosts } from "../../lib/api";
import { PageHeading } from "../../components/content/page-heading";

const PAGE_SIZE = 10;

type BlogSearchParams = Promise<{
  page?: string | string[];
}>;

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

function unavailableMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "There are no posts on this page.";
  }
  return "Blog posts are temporarily unavailable. Please try again later.";
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: BlogSearchParams;
}) {
  const currentPage = pageNumber((await searchParams).page);

  try {
    const posts = await getBlogPosts({ page: currentPage, pageSize: PAGE_SIZE });
    const pageCount = Math.ceil(posts.count / PAGE_SIZE);

    return (
      <>
        <PageHeading title="Blog">
          <p>Technical writing on software engineering, AI, and independent work.</p>
        </PageHeading>

        {posts.results.length === 0 ? (
          <p className="blog-notice" role="status">
            No posts have been published yet.
          </p>
        ) : (
          <>
            <ol className="blog-post-list" aria-label="Published posts">
              {posts.results.map((post) => (
                <li className="blog-post" key={post.slug}>
                  <h2>
                    <Link href={`/blog/${encodeURIComponent(post.slug)}`}>
                      {post.title}
                    </Link>
                  </h2>
                  <p className="blog-post-meta">
                    <span>By {post.author.name}</span>
                    <time dateTime={post.published_at}>
                      {formatPublishedDate(post.published_at)}
                    </time>
                  </p>
                </li>
              ))}
            </ol>

            {pageCount > 1 && (
              <nav className="blog-pagination" aria-label="Blog pages">
                {posts.previous ? (
                  <Link href={`/blog?page=${currentPage - 1}`}>Previous page</Link>
                ) : (
                  <span aria-disabled="true">Previous page</span>
                )}
                <p className="blog-pagination-status">
                  Page {currentPage} of {pageCount}
                </p>
                {posts.next ? (
                  <Link href={`/blog?page=${currentPage + 1}`}>Next page</Link>
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
        <PageHeading title="Blog" />
        <p className="blog-notice" role="alert">
          {unavailableMessage(error)}
        </p>
        {error instanceof ApiError && error.status === 404 && (
          <p>
            <Link href="/blog">Return to the first page</Link>
          </p>
        )}
      </>
    );
  }
}
