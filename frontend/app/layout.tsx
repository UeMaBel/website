import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { PageContainer } from "../components/layout/page-container";
import { SiteHeader } from "../components/layout/site-header";
import { SiteFooter } from "../components/layout/site-footer";
import { headers } from "next/headers";
import { getPublicSiteOrigin } from "../lib/public-origin";
import { PageViewTracker } from "../components/analytics/page-view-tracker";
import "./globals.css";

const headlineFont = localFont({ src: "./fonts/headline.ttf", variable: "--font-headline", display: "swap", weight: "100 900" });
const readingFont = localFont({ src: "./fonts/reading.ttf", variable: "--font-reading", display: "swap", weight: "200 900" });
const monoFont = localFont({ src: "./fonts/mono.ttf", variable: "--font-mono", display: "swap", weight: "400" });

export async function generateMetadata(): Promise<Metadata> {
  // Dynamic metadata ensures runtime container configuration is used after image build.
  await headers();

  const publicOrigin = getPublicSiteOrigin();
  return {
    metadataBase: publicOrigin,
    title: { default: "uebel | Matthias Uebelacker — Software & Data Engineering", template: "uebel | %s — Matthias Uebelacker" },
    description: "Independent software engineering and AI expertise, technical writing, and projects.",
    openGraph: {
      type: "website",
      siteName: "uebel",
      title: "uebel",
      description: "Independent software engineering and AI expertise, technical writing, and projects.",
    },
    twitter: { card: "summary" },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Read analytics configuration per request so standalone images can receive
  // runtime values without baking public analytics settings into the build.
  await headers();
  const analyticsEnabled = process.env.STATISTICS_ENABLED?.trim().toLowerCase() !== "false";

  return (
    <html lang="en" className={`${headlineFont.variable} ${readingFont.variable} ${monoFont.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <SiteHeader />
        <PageViewTracker
          enabled={analyticsEnabled}
        />
        <main id="main-content" tabIndex={-1}>
          <PageContainer>{children}</PageContainer>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
