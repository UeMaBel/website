import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "../../../components/content/markdown";
import { PageHeading } from "../../../components/content/page-heading";
import { ApiError, getProject } from "../../../lib/api";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

function mediaUrl(path: string): string | undefined {
  const backendOrigin = process.env.BACKEND_API_URL?.trim() || "http://127.0.0.1:8000";
  try {
    const url = new URL(path, backendOrigin);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      return undefined;
    }
    return url.toString();
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
        <PageHeading title={project.title} />

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

        {project.technologies.length > 0 && (
          <section aria-labelledby="project-technologies-heading">
            <h2 id="project-technologies-heading">Technologies</h2>
            <ul className="project-detail-technologies">
              {project.technologies.map((technology) => <li key={technology}>{technology}</li>)}
            </ul>
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
                      // biome-ignore lint/performance/noImgElement: Project uploads use backend media URLs and need no image proxy.
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
              <a href={project.repository_url} target="_blank" rel="noreferrer">Source repository</a>
            )}
            {project.demo_url && (
              <a href={project.demo_url} target="_blank" rel="noreferrer">Live demo</a>
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
