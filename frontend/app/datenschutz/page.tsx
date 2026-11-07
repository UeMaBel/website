import { ContentSection } from "../../components/content/content-section";
import { Markdown } from "../../components/content/markdown";
import { PageHeading } from "../../components/content/page-heading";
import { privacyMarkdown } from "../../page-content/datenschutz";
import { publicPageMetadata } from "../../lib/metadata";

export const metadata = publicPageMetadata(
  "Datenschutz",
  "Datenschutzerklärung und Informationen zur Verarbeitung personenbezogener Daten.",
  "/datenschutz",
);

export default function DatenschutzPage() {
  return (
    <div lang="de">
      <PageHeading title="Datenschutz" />
      <ContentSection id="datenschutzerklaerung" title="Datenschutzerklärung">
        <Markdown source={privacyMarkdown} />
      </ContentSection>
    </div>
  );
}
