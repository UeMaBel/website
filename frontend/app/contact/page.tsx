import { PageHeading } from "../../components/content/page-heading";
import { ContentSection } from "../../components/content/content-section";
import { Markdown } from "../../components/content/markdown";
import { ProfileContactDetails } from "../../components/content/profile-contact-details";
import profile from "../../page-content/profile.json";
import { publicPageMetadata } from "../../lib/metadata";

export const metadata = publicPageMetadata(
  "Contact",
  "Get in touch about independent software engineering, AI, and collaboration.",
  "/contact",
);

export default function ContactPage() {
  return (
    <>
      <PageHeading title="Contact" />
      <section className="business-card content-section section-divider" aria-labelledby="business-card-title">
        <h2 id="business-card-title">Get in touch</h2>
        <div className="content-section-body">
          <ProfileContactDetails introduction={profile.contact_introduction || ""} />
        </div>
      </section>
      {profile.impressum?.trim() && (
        <ContentSection id="impressum" title="Impressum">
          <Markdown source={profile.impressum} />
        </ContentSection>
      )}
    </>
  );
}
