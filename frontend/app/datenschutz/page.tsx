import { ContentSection } from "../../components/content/content-section";
import { Markdown } from "../../components/content/markdown";
import { PageHeading } from "../../components/content/page-heading";
import { getProfile } from "../../lib/api";
import { publicPageMetadata } from "../../lib/metadata";

export const metadata = publicPageMetadata(
  "Datenschutz",
  "Datenschutzerklärung und Informationen zur Verarbeitung personenbezogener Daten.",
  "/datenschutz",
);

export default async function DatenschutzPage() {
  try {
    const profile = await getProfile();
    return (
      <>
        <PageHeading title="Datenschutz" />
        <ContentSection id="datenschutzerklaerung" title="Datenschutzerklärung">
          {profile.dsgvo?.trim() ? (
            <Markdown source={profile.dsgvo} />
          ) : (
            <p role="status">Noch keine Datenschutzhinweise hinterlegt.</p>
          )}
        </ContentSection>
      </>
    );
  } catch {
    return (
      <>
        <PageHeading title="Datenschutz" />
        <p className="profile-error" role="alert">
          Die Datenschutzhinweise sind vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.
        </p>
      </>
    );
  }
}
