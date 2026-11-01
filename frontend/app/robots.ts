import type { MetadataRoute } from "next";
import { getSiteUrl } from "../lib/metadata";

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
