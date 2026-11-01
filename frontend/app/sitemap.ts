import type { MetadataRoute } from "next";
import { getBlogPosts, getProjects } from "../lib/api";
import { getSiteUrl } from "../lib/metadata";

const PAGE_SIZE = 100;
const PUBLIC_PAGES = ["/", "/blog", "/about", "/projects", "/contact"];

async function getPublishedPosts() {
  const firstPage = await getBlogPosts({ page: 1, pageSize: PAGE_SIZE });
  const pageCount = Math.ceil(firstPage.count / PAGE_SIZE);
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
      getBlogPosts({ page: index + 2, pageSize: PAGE_SIZE }),
    ),
  );
  return [
    ...firstPage.results,
    ...remainingPages.flatMap((page) => page.results),
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [postsResult, projectsResult] = await Promise.allSettled([
    getPublishedPosts(),
    getProjects(),
  ]);
  const posts = postsResult.status === "fulfilled" ? postsResult.value : [];
  const projects = projectsResult.status === "fulfilled" ? projectsResult.value.results : [];
  const siteUrl = getSiteUrl();

  return [
    ...PUBLIC_PAGES.map((path) => ({
      url: new URL(path, siteUrl).toString(),
      changeFrequency: path === "/" ? "weekly" as const : "monthly" as const,
    })),
    ...posts.map((post) => ({
      url: new URL(`/blog/${encodeURIComponent(post.slug)}`, siteUrl).toString(),
      changeFrequency: "monthly" as const,
    })),
    ...projects.map((project) => ({
      url: new URL(`/projects/${encodeURIComponent(project.slug)}`, siteUrl).toString(),
      changeFrequency: "monthly" as const,
    })),
  ];
}
