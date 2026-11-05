import { PageContainer } from "./page-container";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <PageContainer>
        <p>
          <span className="chrome-bracket" aria-hidden="true">[</span>
          <span>Personal website · Software engineering and technical writing</span>
          <span className="chrome-bracket" aria-hidden="true">]</span>
        </p>
      </PageContainer>
    </footer>
  );
}
