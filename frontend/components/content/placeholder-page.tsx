import { ContentSection } from "./content-section";
import { PageHeading } from "./page-heading";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeading title={title} />
      <ContentSection id="temporary-content" title="Content coming soon">
        <p>Temporary placeholder: this page is awaiting its content implementation.</p>
      </ContentSection>
    </>
  );
}
