import type { Metadata } from "next";

export function getSiteUrl(): URL {
  const configuredUrl = process.env.SITE_URL?.trim() || "http://localhost:3000";
  let siteUrl: URL;
  try {
    siteUrl = new URL(configuredUrl);
  } catch {
    throw new Error("SITE_URL must be an absolute HTTP(S) origin.");
  }

  if (
    (siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") ||
    siteUrl.username ||
    siteUrl.password ||
    siteUrl.pathname !== "/" ||
    siteUrl.search ||
    siteUrl.hash
  ) {
    throw new Error("SITE_URL must be an HTTP(S) origin without credentials, path, query, or fragment.");
  }

  return siteUrl;
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
      siteName: "Personal website",
    },
    twitter: { card: "summary", title, description },
  };
}
