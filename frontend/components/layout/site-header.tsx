import Link from "next/link";
import { PageContainer } from "./page-container";

const navigation = [
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About / CV" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <PageContainer>
        <Link className="site-mark" href="/" aria-label="[m.] Home">[m<span>.</span>]</Link>
        <div className="header-actions">
        <nav aria-label="Main navigation">
          <ul className="navigation">
            {navigation.map(({ href, label }) => (
              <li key={href}><Link href={href}>{label}</Link></li>
            ))}
          </ul>
        </nav>
        <button className="language-switch" type="button" disabled title="Language switching is not available yet">DE / EN</button>
        </div>
      </PageContainer>
    </header>
  );
}
