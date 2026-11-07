import { ContentThumbnail } from "../../../../components/content/content-thumbnail";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ApiError, getBlogPostPreview } from "../../../../lib/api";
import { Markdown } from "../../../../components/content/markdown";
import { PageHeading } from "../../../../components/content/page-heading";
import { BlogTagLinks } from "../../../../components/content/blog-tag-links";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Draft preview",
  description: null,
  alternates: null,
  openGraph: null,
  twitter: null,
  robots: { index: false, follow: false },
};

type BlogPreviewPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BlogPreviewPage({ params }: BlogPreviewPageProps) {
  const { slug } = await params;
  const sessionId = (await cookies()).get("sessionid")?.value;

  if (!sessionId) {
    notFound();
  }

  try {
    const post = await getBlogPostPreview(slug, sessionId);
    return (
      <article className="blog-article">
        <PageHeading title={post.title}>
          <p className="blog-notice" role="status">Draft preview</p>
          <p className="blog-detail-meta">By {post.author.name}</p>
        </PageHeading>

        {!post.hide_thumbnail_on_detail && <ContentThumbnail image={post.thumbnail} className="blog-detail-thumbnail" />}

        {post.tags.length > 0 && <BlogTagLinks tags={post.tags} label="Post tags" />}

        <Markdown source={post.body} />
        <p className="blog-back-link"><Link href="/blog">Back to all posts</Link></p>
      </article>
    );
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403 || error.status === 404)
    ) {
      notFound();
    }

    return (
      <>
        <PageHeading title="Draft preview unavailable" />
        <p className="blog-notice" role="alert">
          This draft preview is temporarily unavailable. Please try again later.
        </p>
        <p><Link href="/blog">Back to all posts</Link></p>
      </>
    );
  }
}
