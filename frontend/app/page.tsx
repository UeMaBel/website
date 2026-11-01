import Link from "next/link";
import { ContentSection } from "../components/content/content-section";
import { Markdown } from "../components/content/markdown";
import { PageHeading } from "../components/content/page-heading";
import { ProfileContactLinks } from "../components/content/profile-contact-links";
import { getProfile } from "../lib/api";

const featuredLinks = [
  { href: "/blog", label: "Read the blog" },
  { href: "/projects", label: "Explore projects" },
  { href: "/about", label: "About / CV" },
];

function WebsiteLinks() {
  return (
    <nav className="home-links" aria-label="Explore the website">
      {featuredLinks.map(({ href, label }) => <Link key={href} href={href}>{label}</Link>)}
    </nav>
  );
}

export default async function HomePage() {
  try {
    const profile = await getProfile();

    return (
      <>
        <PageHeading title={profile.display_name.trim() || "Software engineering and AI"}>
          <p className="home-focus">
            Independent software engineering and AI expertise for teams building useful, reliable products.
          </p>
        </PageHeading>

        <WebsiteLinks />

        {profile.biography.trim() && (
          <ContentSection id="home-biography" title="A little about my work">
            <Markdown source={profile.biography} />
          </ContentSection>
        )}

        <ContentSection id="home-contact" title="Get in touch">
          <ProfileContactLinks email={profile.email} links={profile.links} />
        </ContentSection>
      </>
    );
  } catch {
    return (
      <>
        <PageHeading title="Software engineering and AI">
          <p className="home-focus">
            Independent software engineering and AI expertise for teams building useful, reliable products.
          </p>
        </PageHeading>
        <WebsiteLinks />
        <p className="profile-error" role="alert">
          Contact details are temporarily unavailable. Please try again later.
        </p>
      </>
    );
  }
}
