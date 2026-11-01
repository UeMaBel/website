import { PageHeading } from "../components/content/page-heading";
import { ContentSection } from "../components/content/content-section";

export default function HomePage() {
  return (
    <>
      <PageHeading title="Personal website">
        <p>Software engineering, technical writing, and independent projects.</p>
      </PageHeading>
      <ContentSection id="temporary-content" title="Content coming soon">
        <p>Temporary placeholder: writing, projects, and profile content will appear here.</p>
      </ContentSection>
    </>
  );
}
