import { PageContainer } from "./page-container";
import Link from "next/link";
import { BrandIcon } from "./brand-icon";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <PageContainer>
        <Link className="footer-brand" href="/" aria-label="Matthias Uebelacker — Home">
          <BrandIcon size={28} />
        </Link>
        <p>
          <span>Personal website · Software engineering and technical writing</span>
        </p>
      </PageContainer>
    </footer>
  );
}
