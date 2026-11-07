import { ContentThumbnail } from "../../../components/content/content-thumbnail";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { ApiError, getBlogPost, type BlogPost } from "../../../lib/api";
import { getPublicSiteOrigin } from "../../../lib/public-origin";
import { Markdown } from "../../../components/content/markdown";
import { PageHeading } from "../../../components/content/page-heading";
import { BlogTagLinks } from "../../../components/content/blog-tag-links";
import { metadataDescription } from "../../../lib/metadata";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

const getPostForRender = cache((slug: string) => getBlogPost(slug));

function formatPublishedDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const post = await getPostForRender(slug);
    const description = metadataDescription(post.body, post.title);
    const canonicalPath = `/blog/${encodeURIComponent(post.slug)}`;

    return {
      title: post.title,
      description,
      alternates: { canonical: canonicalPath },
      openGraph: {
        type: "article",
        title: post.title,
        description,
        url: new URL(canonicalPath, getPublicSiteOrigin()).toString(),
        siteName: "Software, Data, AI, Writing",
        publishedTime: post.published_at,
        authors: [post.author.name],
        tags: post.tags.map((tag) => tag.name),
      },
      twitter: { card: "summary", title: post.title, description },
    };
  } catch (error) {
    const title = error instanceof ApiError && error.status === 404
      ? "Post not found"
      : "Blog post unavailable";

    return {
      title,
      robots: { index: false, follow: false },
    };
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;

  let post: BlogPost;
  try {
    post = await getPostForRender(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    return (
      <>
        <PageHeading title="Blog post unavailable">
          <p role="alert">This post is temporarily unavailable. Please try again later.</p>
        </PageHeading>
        <p><Link href="/blog">Back to all posts</Link></p>
      </>
    );
  }

  if (post.slug !== slug) {
    permanentRedirect(`/blog/${encodeURIComponent(post.slug)}`);
  }

  return (
    <article className="blog-article">
      <Link className="text-link blog-breadcrumb" href="/blog">← All writing</Link>
      <p className="eyebrow">Field notes / Blog</p>
      <PageHeading title={post.title}>
        <p className="blog-detail-meta">
          <span>By {post.author.name}</span>
          <time dateTime={post.published_at}>{formatPublishedDate(post.published_at)}</time>
        </p>
      </PageHeading>

        <ContentThumbnail image={post.thumbnail} className="detail-thumbnail" />

      {post.tags.length > 0 && <BlogTagLinks tags={post.tags} label="Post tags" />}

      <Markdown source={post.body} />
      <p className="blog-back-link"><Link href="/blog">Back to all posts</Link></p>
    </article>
  );
}
