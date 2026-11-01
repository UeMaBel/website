import Link from "next/link";
import { Markdown } from "../../components/content/markdown";
import { PageHeading } from "../../components/content/page-heading";
import { getProjects } from "../../lib/api";
import { publicPageMetadata } from "../../lib/metadata";

export const metadata = publicPageMetadata(
  "Projects",
  "Explore software projects, the problems they address, and my contributions.",
  "/projects",
);

export default async function ProjectsPage() {
  try {
    const projects = await getProjects();

    return (
      <>
        <PageHeading title="Projects">
          <p>A selection of projects, the problems they address, and my contributions.</p>
        </PageHeading>

        {projects.results.length === 0 ? (
          <p className="project-notice" role="status">No projects are available yet.</p>
        ) : (
          <ol className="project-list" aria-label="Projects">
            {projects.results.map((project) => (
              <li className="project-entry" key={project.slug}>
                <article>
                  <h2>
                    <Link href={`/projects/${encodeURIComponent(project.slug)}`}>
                      {project.title}
                    </Link>
                  </h2>

                  {project.problem.trim() && (
                    <section>
                      <h3>Problem</h3>
                      <Markdown source={project.problem} />
                    </section>
                  )}

                  {project.contribution.trim() && (
                    <section>
                      <h3>My contribution</h3>
                      <Markdown source={project.contribution} />
                    </section>
                  )}

                  {project.technologies.length > 0 && (
                    <ul className="project-technologies" aria-label={`${project.title} technologies`}>
                      {project.technologies.map((technology) => (
                        <li key={technology}>{technology}</li>
                      ))}
                    </ul>
                  )}
                </article>
              </li>
            ))}
          </ol>
        )}
      </>
    );
  } catch {
    return (
      <>
        <PageHeading title="Projects" />
        <p className="project-notice" role="alert">
          Project information is temporarily unavailable. Please try again later.
        </p>
      </>
    );
  }
}
