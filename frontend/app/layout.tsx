import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { PageContainer } from "../components/layout/page-container";
import { SiteHeader } from "../components/layout/site-header";
import { SiteFooter } from "../components/layout/site-footer";
import { getPublicSiteOrigin } from "../lib/public-origin";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  // Dynamic metadata ensures runtime container configuration is used after image build.
  await headers();

  return {
    metadataBase: getPublicSiteOrigin(),
    title: "Personal website",
    description: "Software engineering, technical writing, and independent projects.",
  };
}

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
