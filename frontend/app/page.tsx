import { PointField } from "../components/layout/point-field";
import Link from "next/link";
import { Markdown } from "../components/content/markdown";
import { ProfileContactLinks } from "../components/content/profile-contact-links";
import { getBlogPosts, getProfile, getProjects } from "../lib/api";
import { publicPageMetadata } from "../lib/metadata";

export const metadata = publicPageMetadata("Personal website", "Blog, projects, and professional profile.", "/");

export default async function HomePage() {
  const [profileResult, projectsResult, postsResult] = await Promise.allSettled([getProfile(), getProjects(), getBlogPosts({ pageSize: 3 })]);
  const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
  const projects = projectsResult.status === "fulfilled" ? projectsResult.value.results.slice(0, 2) : [];
  const posts = postsResult.status === "fulfilled" ? postsResult.value.results : [];
  return <div className="landing">
    <section className="hero grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow"><span className="status-dot" /> {profile?.display_name.trim() || "[Name / professional title]"}</p>
        <h1 id="hero-title">First headline.<br />Supporting line.<br /><span>Highlighted line.</span></h1>
        <p className="hero-description">[Short introduction: your role, focus, and what visitors should know about you.]</p>
        <div className="flex flex-wrap gap-3">
          <Link className="button-primary" href="/projects">Projects <span aria-hidden="true">↗</span></Link>
          <Link className="button-secondary" href="/contact">Contact <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      <PointField />
    </section>
    <div className="discipline-strip flex flex-wrap justify-between gap-4"><span>[Focus area 1]</span><span aria-hidden="true">↗</span><span>[Focus area 2]</span><span aria-hidden="true">↗</span><span>[Focus area 3]</span></div>
    <section className="landing-section grid gap-8 md:grid-cols-[1fr_2fr]" aria-labelledby="intro-title">
      <p className="eyebrow">01 / Introduction</p>
      <div><h2 id="intro-title">[Introduction heading]</h2>
        <p className="intro-copy">[Introduce your background, experience, and current interests.]</p>
        {profile?.biography.trim() && <div className="intro-biography"><Markdown source={profile.biography} /></div>}
        <Link className="text-link" href="/about">About / CV <span aria-hidden="true">↗</span></Link>
      </div>
    </section>
    <section className="landing-section" aria-labelledby="work-title">
      <div className="section-top flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">02 / Projects</p><h2 id="work-title">[Selected projects heading]</h2></div><Link className="text-link" href="/projects">All projects <span aria-hidden="true">↗</span></Link></div>
      {projects.length > 0 ? <div className="grid gap-5 md:grid-cols-2">{projects.map((project, i) => <Link className="work-card" href={`/projects/${encodeURIComponent(project.slug)}`} key={project.slug}>
        <div className={`project-art project-art-${i}`} aria-hidden="true"><span>{i === 0 ? "{ · }" : "↗"}</span><span className="art-caption">ENGINEERING / {String(i + 1).padStart(2, "0")}</span></div>
        <div className="card-copy"><p className="eyebrow">{project.technologies.slice(0, 3).join(" / ") || "Software project"}</p><h3>{project.title} <span aria-hidden="true">↗</span></h3><Markdown source={project.problem} /></div>
      </Link>)}</div> : <div className="content-empty"><p>{projectsResult.status === "rejected" ? "Projects are temporarily unavailable. Please try again later." : "[Selected projects will appear here once added.]"}</p><Link className="text-link" href="/projects">Explore projects ↗</Link></div>}
    </section>
    <section className="landing-section" aria-labelledby="writing-title">
      <div className="section-top flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">03 / Blog</p><h2 id="writing-title">[Latest articles heading]</h2></div><Link className="text-link" href="/blog">Read the blog <span aria-hidden="true">↗</span></Link></div>
      {posts.length > 0 ? <ol className="writing-list">{posts.map((post) => <li key={post.slug}><Link href={`/blog/${encodeURIComponent(post.slug)}`}><span className="eyebrow">{post.tags[0]?.name || "Engineering"}</span><h3>{post.title}</h3><span aria-hidden="true">↗</span></Link></li>)}</ol> : <div className="content-empty"><p>{postsResult.status === "rejected" ? "Writing is temporarily unavailable. Please try again later." : "[Latest articles will appear here once published.]"}</p></div>}
    </section>
    <section className="contact-panel grid gap-8 md:grid-cols-[1.6fr_1fr]" aria-labelledby="contact-title">
      <div><p className="eyebrow">04 / Contact</p><h2 id="contact-title">[Contact heading]</h2><p>[Describe what people can contact you about.]</p><Link className="button-primary" href="/contact">Contact <span aria-hidden="true">↗</span></Link></div>
      <div className="contact-details">{profile ? <ProfileContactLinks email={profile.email} links={profile.links} /> : <p className="profile-error" role="alert">Contact details are temporarily unavailable. Please try again later.</p>}</div>
    </section>
  </div>;
}
