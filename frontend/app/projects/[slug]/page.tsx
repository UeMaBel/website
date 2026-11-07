import { ContentThumbnail } from "../../../components/content/content-thumbnail";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "../../../components/content/markdown";
import { PageHeading } from "../../../components/content/page-heading";
import { ApiError, getProject } from "../../../lib/api";
import { metadataDescription } from "../../../lib/metadata";
import { OutboundAnchor } from "../../../components/analytics/outbound-anchor";
import { getPublicSiteOrigin } from "../../../lib/public-origin";
import type { Metadata } from "next";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const project = await getProject(slug);
    const canonical = `/projects/${encodeURIComponent(project.slug)}`;
    const description = metadataDescription(
      [project.problem, project.contribution, project.description].filter(Boolean).join(" "),
      project.title,
    );
    return {
      title: project.title,
      description,
      alternates: { canonical },
      openGraph: {
        type: "website",
        title: project.title,
        description,
        url: canonical,
        siteName: "Software, Data, AI, Writing",
      },
      twitter: { card: "summary", title: project.title, description },
    };
  } catch (error) {
    return {
      title: error instanceof ApiError && error.status === 404 ? "Project not found" : "Project unavailable",
      robots: { index: false, follow: false },
    };
  }
}

function mediaUrl(path: string): string | undefined {
  try {
    const publicOrigin = getPublicSiteOrigin();
    const url = new URL(path, publicOrigin);
    if (url.origin !== publicOrigin.origin || !url.pathname.startsWith("/media/")) {
      return undefined;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { slug } = await params;

  try {
    const project = await getProject(slug);

    return (
      <article className="project-detail">
        <PageHeading title={project.title}>
          {project.technologies.length > 0 && (
            <ul className="project-detail-technologies" aria-label="Technologies">
              {project.technologies.map((technology) => <li key={technology}>{technology}</li>)}
            </ul>
          )}
        </PageHeading>

        <ContentThumbnail image={project.thumbnail} className="detail-thumbnail" />

        {project.problem.trim() && (
          <section aria-labelledby="project-problem-heading">
            <h2 id="project-problem-heading">Problem</h2>
            <Markdown source={project.problem} />
          </section>
        )}

        {project.contribution.trim() && (
          <section aria-labelledby="project-contribution-heading">
            <h2 id="project-contribution-heading">My contribution</h2>
            <Markdown source={project.contribution} />
          </section>
        )}

        {project.description.trim() && (
          <section aria-labelledby="project-description-heading">
            <h2 id="project-description-heading">More about this project</h2>
            <Markdown source={project.description} />
          </section>
        )}

        {project.images.length > 0 && (
          <section aria-labelledby="project-images-heading">
            <h2 id="project-images-heading">Project images</h2>
            <div className="project-image-list">
              {project.images.map((image) => {
                const src = mediaUrl(image.url);
                return (
                  <figure key={`${image.position}-${image.url}`}>
                    {src && image.alt_text.trim() ? (
                      // biome-ignore lint/performance/noImgElement: Uploaded media is served by the same-origin proxy.
                      <img src={src} alt={image.alt_text} loading="lazy" decoding="async" />
                    ) : (
                      <p role="status">Image unavailable: {image.alt_text || "No description provided."}</p>
                    )}
                  </figure>
                );
              })}
            </div>
          </section>
        )}

        {(project.repository_url || project.demo_url) && (
          <nav className="project-detail-links" aria-label="Project links">
            {project.repository_url && (
              <OutboundAnchor
                href={project.repository_url}
                target="_blank"
                rel="noreferrer"
                category="repository"
              >
                Source repository
              </OutboundAnchor>
            )}
            {project.demo_url && (
              <OutboundAnchor
                href={project.demo_url}
                target="_blank"
                rel="noreferrer"
                category="demo"
              >
                Live demo
              </OutboundAnchor>
            )}
          </nav>
        )}

        <p className="project-back-link"><Link href="/projects">Back to all projects</Link></p>
      </article>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    return (
      <>
        <PageHeading title="Project unavailable" />
        <p className="project-notice" role="alert">
          Project information is temporarily unavailable. Please try again later.
        </p>
        <p><Link href="/projects">Back to all projects</Link></p>
      </>
    );
  }
}
