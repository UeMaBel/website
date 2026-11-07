import type { Metadata } from "next";
import { getPublicSiteOrigin } from "./public-origin";

export function getSiteUrl(): URL {
  return getPublicSiteOrigin();
}

export function metadataDescription(markdown: string, fallback: string): string {
  const summary = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!summary) return fallback;
  if (summary.length <= 160) return summary;
  return `${summary.slice(0, 157).trimEnd()}...`;
}

export function publicPageMetadata(
  title: string,
  description: string,
  path: string,
  type: "website" | "article" = "website",
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      title,
      description,
      url: path,
      siteName: "uebel",
    },
    twitter: { card: "summary", title, description },
  };
}
