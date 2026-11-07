import Link from "next/link";
import { BrandIcon } from "./brand-icon";
import { PageContainer } from "./page-container";

const navigation = [
  { href: "/projects", label: "[Projects]" },
  { href: "/blog", label: "[Blog]" },
  { href: "/about", label: "[About / CV]" },
  { href: "/contact", label: "[Contact]" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <PageContainer>
        <Link
          className="site-mark"
          href="/"
          aria-label="Matthias Uebelacker — Home"
        >
          <span className="site-mark-symbol" aria-hidden="true">
            <BrandIcon className="site-mark-icon" size={38} />
            <span className="site-mark-word">ebel</span>
          </span>
          <span className="site-mark-name">
            <span>Matthias</span>
            <span>Uebelacker</span>
          </span>
        </Link>
        <div className="header-actions">
          <nav aria-label="Main navigation">
            <ul className="navigation">
              {navigation.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </PageContainer>
    </header>
  );
}
