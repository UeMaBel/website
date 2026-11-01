import Link from "next/link";
import { PageContainer } from "./page-container";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About / CV" },
  { href: "/projects", label: "Projects" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <PageContainer>
        <nav aria-label="Main navigation">
          <ul className="navigation">
            {navigation.map(({ href, label }) => (
              <li key={href}><Link href={href}>{label}</Link></li>
            ))}
          </ul>
        </nav>
      </PageContainer>
    </header>
  );
}
