import type { MetadataRoute } from "next";
import { getSiteUrl } from "../lib/metadata";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/blog/*/preview",
    },
    sitemap: new URL("/sitemap.xml", getSiteUrl()).toString(),
  };
}
