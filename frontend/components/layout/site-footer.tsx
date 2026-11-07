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
          <span>Software, Data, AI, Writing</span>
        </p>
        <nav className="footer-legal" aria-label="Legal information">
          <Link href="/contact#impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
        </nav>
      </PageContainer>
    </footer>
  );
}
