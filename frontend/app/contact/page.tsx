import { PageHeading } from "../../components/content/page-heading";
import { ProfileContactDetails } from "../../components/content/profile-contact-details";
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
        <PageHeading title="Contact" />
        <section className="business-card content-section section-divider" aria-labelledby="business-card-title">
          <h2 id="business-card-title">Get in touch</h2>
          <div className="content-section-body">
            <ProfileContactDetails introduction={profile.contact_introduction || ""} />
          </div>
        </section>
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
