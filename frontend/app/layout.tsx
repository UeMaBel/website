import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageContainer } from "../components/layout/page-container";
import { SiteHeader } from "../components/layout/site-header";
import { SiteFooter } from "../components/layout/site-footer";
import { getSiteUrl } from "../lib/metadata";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: { default: "Personal website", template: "%s | Personal website" },
  description: "Independent software engineering and AI expertise, technical writing, and projects.",
  openGraph: {
    type: "website",
    siteName: "Personal website",
    title: "Personal website",
    description: "Independent software engineering and AI expertise, technical writing, and projects.",
  },
  twitter: { card: "summary" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1}>
          <PageContainer>{children}</PageContainer>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
