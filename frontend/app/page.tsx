import profile from "../page-content/profile.json";
import { ProjectThumbnail } from "../components/content/project-thumbnail";
import { PointField } from "../components/layout/point-field";
import { BrandIcon } from "../components/layout/brand-icon";
import Link from "next/link";
import Image from "next/image";
import { Markdown } from "../components/content/markdown";
import { ProfileContactDetails } from "../components/content/profile-contact-details";
import { getBlogPosts, getProjects } from "../lib/api";
import { publicPageMetadata } from "../lib/metadata";
import type { Metadata } from "next";

export function generateMetadata(): Metadata {
  return publicPageMetadata(
    "uebel | Home - Matthias Uebelacker",
    "Freelance software development, data platforms and AI experiments. Projects and writing by Matthias Uebelacker.",
    "/",
  );
}

export default async function HomePage() {
  const [projectsResult, postsResult] = await Promise.allSettled([
    getProjects(),
    getBlogPosts({ pageSize: 3 }),
  ]);
  const projects =
    projectsResult.status === "fulfilled"
      ? projectsResult.value.results.slice(0, 2)
      : [];
  const posts =
    postsResult.status === "fulfilled" ? postsResult.value.results : [];
  return (
    <div className="landing">
      <section
        className="hero grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]"
        aria-labelledby="hero-title"
      >
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" />{" "}
            {profile?.display_name.trim() ||
              "Freelance software developer and data engineer"}
          </p>
          <h1 id="hero-title">
            Grounded in fundamentals, <span>accelerated by AI.</span>
          </h1>
          <p className="hero-description">
            I help companies connect industrial systems, build data platforms,
            and improve the applications their teams rely on.
          </p>
          <p className="hero-description">
            From the first idea to keeping things running. I also spend a lot of
            time exploring AI and coding agents, often following a rabbit hole
            further than I planned.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link className="button-primary" href="/projects">
              Projects <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button-secondary" href="/contact">
              Contact <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <div className="hero-portrait">
          <Image
            className="portrait portrait-round"
            src="/images/portrait.jpg"
            alt="Portrait of Matthias Uebelacker"
            width={576}
            height={576}
            sizes="(min-width: 1024px) 352px, (min-width: 360px) 288px, 80vw"
            preload
          />
        </div>
      </section>
      <div className="discipline-strip flex flex-wrap justify-between gap-4">
        <span>
          <span className="chrome-bracket" aria-hidden="true">
            [
          </span>{" "}
          Software development{" "}
          <span className="chrome-bracket" aria-hidden="true">
            ]
          </span>
        </span>
        <span aria-hidden="true">↗</span>
        <span>
          <span className="chrome-bracket" aria-hidden="true">
            [
          </span>{" "}
          Data platforms{" "}
          <span className="chrome-bracket" aria-hidden="true">
            ]
          </span>
        </span>
        <span aria-hidden="true">↗</span>
        <span>
          <span className="chrome-bracket" aria-hidden="true">
            [
          </span>{" "}
          AI experiments{" "}
          <span className="chrome-bracket" aria-hidden="true">
            ]
          </span>
        </span>
      </div>
      <section
        className="landing-section section-divider introduction grid items-center gap-8 md:grid-cols-[1fr_2fr]"
        aria-labelledby="intro-title"
      >
        <p className="eyebrow introduction-label">01 / Introduction</p>
        <PointField />
        <div>
          <h2 id="intro-title">From the first conversation to production</h2>
          <p className="intro-copy">
            I’ve been self-employed since 2020, building software for both tech
            and non-tech companies. I start by understanding how people work,
            what they need and what gets in the way. Clear communication and a
            solid architecture are key for me, from the first conversation
            through development and into daily use.
          </p>
          <Link className="text-link" href="/about">
            About / CV <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
      <section className="landing-section" aria-labelledby="work-title">
        <div className="section-top flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">02 / Projects</p>
            <h2 id="work-title">Things I've built</h2>
          </div>
          <Link className="text-link" href="/projects">
            All projects <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {projects.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {projects.map((project, i) => (
              <Link
                className="work-card"
                href={`/projects/${encodeURIComponent(project.slug)}`}
                key={project.slug}
              >
                <ProjectThumbnail image={project.thumbnail} index={i} />
                <div className="card-copy">
                  <p className="eyebrow">
                    {project.technologies.slice(0, 3).join(" / ") ||
                      "Software project"}
                  </p>
                  <h3>
                    {project.title} <span aria-hidden="true">↗</span>
                  </h3>
                  <Markdown source={project.problem} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="content-empty">
            <p>
              {projectsResult.status === "rejected"
                ? "Projects are temporarily unavailable. Please try again later."
                : "Project write-ups are on their way."}
            </p>
            <Link className="text-link" href="/projects">
              Explore projects ↗
            </Link>
          </div>
        )}
      </section>
      <section className="landing-section" aria-labelledby="writing-title">
        <div className="section-top flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">03 / Blog</p>
            <h2 id="writing-title">Notes from the work</h2>
          </div>
          <Link className="text-link" href="/blog">
            Read the blog <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {posts.length > 0 ? (
          <ol className="writing-list">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link href={`/blog/${encodeURIComponent(post.slug)}`}>
                  <span className="eyebrow">
                    {post.tags[0]?.name || "Engineering"}
                  </span>
                  <h3>{post.title}</h3>
                  <span aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="content-empty">
            <p>
              {postsResult.status === "rejected"
                ? "Writing is temporarily unavailable. Please try again later."
                : "I'm working on my first posts. They'll appear here once they're ready."}
            </p>
          </div>
        )}
      </section>
      <section
        className="contact-panel grid gap-8 md:grid-cols-[1.6fr_1fr]"
        aria-labelledby="contact-title"
      >
        <div>
          <p className="eyebrow contact-brand">
            <BrandIcon size={28} /> 04 / Contact
          </p>
          <h2 id="contact-title">What are you working on?</h2>
          <p>
            Have a project in mind or an existing application that needs work?
            Tell me what you're building and where you could use a hand.
          </p>
          <Link className="button-primary" href="/contact">
            Get in touch <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="contact-details">
          {profile ? (
            <ProfileContactDetails
              introduction={profile.contact_introduction || ""}
            />
          ) : (
            <p className="profile-error" role="alert">
              Contact details are temporarily unavailable. Please try again
              later.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
