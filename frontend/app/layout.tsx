import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageContainer } from "../components/layout/page-container";
import { SiteHeader } from "../components/layout/site-header";
import { SiteFooter } from "../components/layout/site-footer";
import { headers } from "next/headers";
import { getPublicSiteOrigin } from "../lib/public-origin";
import { PageViewTracker } from "../components/analytics/page-view-tracker";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  // Dynamic metadata ensures runtime container configuration is used after image build.
  await headers();

  const publicOrigin = getPublicSiteOrigin();
  return {
    metadataBase: publicOrigin,
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
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Read analytics configuration per request so standalone images can receive
  // runtime values without baking public analytics settings into the build.
  await headers();
  const analyticsEnabled = process.env.UMAMI_ENABLED?.trim().toLowerCase() === "true";
  const analyticsScriptUrl = process.env.UMAMI_SCRIPT_URL?.trim() ?? "";
  const analyticsWebsiteId = process.env.UMAMI_WEBSITE_ID?.trim() ?? "";
  const publicSiteOrigin = getPublicSiteOrigin().origin;

  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <SiteHeader />
        <PageViewTracker
          enabled={analyticsEnabled}
          scriptUrl={analyticsScriptUrl}
          siteOrigin={publicSiteOrigin}
          websiteId={analyticsWebsiteId}
        />
        <main id="main-content" tabIndex={-1}>
          <PageContainer>{children}</PageContainer>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
