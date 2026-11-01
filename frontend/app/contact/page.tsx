import { ContentSection } from "../../components/content/content-section";
import { PageHeading } from "../../components/content/page-heading";
import { ProfileContactLinks } from "../../components/content/profile-contact-links";
import { getProfile } from "../../lib/api";
import { publicPageMetadata } from "../../lib/metadata";

export const metadata = publicPageMetadata(
  "Contact",
  "Get in touch about independent software engineering, AI, and collaboration.",
  "/contact",
);

export default async function ContactPage() {
  try {
    const profile = await getProfile();
    return (
      <>
        <PageHeading title="Contact">
          <p>For independent software engineering, AI, and collaboration enquiries, get in touch by email or through a professional profile.</p>
        </PageHeading>
        <ContentSection id="contact-details" title="Contact details">
          <ProfileContactLinks email={profile.email} links={profile.links} />
        </ContentSection>
      </>
    );
  } catch {
    return (
      <>
        <PageHeading title="Contact" />
        <p className="profile-error" role="alert">
          Contact details are temporarily unavailable. Please try again later.
        </p>
      </>
    );
  }
}
