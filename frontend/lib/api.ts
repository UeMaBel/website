import "server-only";

const DEFAULT_BACKEND_API_URL = "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 5_000;

export type ApiErrorCode =
  | "configuration"
  | "http"
  | "invalid_response"
  | "network"
  | "timeout";

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ContentThumbnail {
  url: string;
  alt_text: string;
}

export interface BlogAuthor {
  username: string;
  name: string;
}

export interface BlogTag {
  slug: string;
  name: string;
}

export interface BlogTagWithCount extends BlogTag {
  post_count: number;
}

export interface BlogPostSummary {
  thumbnail?: ContentThumbnail | null;
  slug: string;
  title: string;
  published_at: string;
  author: BlogAuthor;
  tags: BlogTag[];
}

export interface BlogPost extends BlogPostSummary {
  body: string;
}

export interface BlogPostPreview extends Omit<BlogPost, "published_at"> {
  published_at: null;
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Collection<T> {
  count: number;
  results: T[];
}

export interface ProfileExperience {
  position: number;
  employer: string;
  role: string;
  start_date: string | null;
  end_date: string | null;
  description: string;
}

export interface ProfileEducation {
  position: number;
  institution: string;
  qualification: string;
  start_date: string | null;
  end_date: string | null;
  description: string;
}

export interface ProfileSkill {
  position: number;
  name: string;
  category: string;
}

export interface ProfileLink {
  position: number;
  label: string;
  url: string;
}

export interface PublicProfile {
  display_name: string;
  biography: string;
  contact_introduction: string;
  impressum: string;
  dsgvo: string;
  projects_introduction: string;
  email: string;
  cv_url: string | null;
  experience: ProfileExperience[];
  education: ProfileEducation[];
  skills: ProfileSkill[];
  links: ProfileLink[];
}

export interface ProjectImage {
  position: number;
  url: string;
  alt_text: string;
}

export interface Project {
  thumbnail?: ContentThumbnail | null;
  slug: string;
  title: string;
  problem: string;
  contribution: string;
  technologies: string[];
  description: string;
  repository_url: string | null;
  demo_url: string | null;
  images: ProjectImage[];
}

export interface BlogPostListOptions {
  page?: number;
  pageSize?: number;
  tag?: string;
}

function backendUrl(path: string): URL {
  const configuredUrl = process.env.BACKEND_API_URL?.trim() || DEFAULT_BACKEND_API_URL;

  let baseUrl: URL;
  try {
    baseUrl = new URL(configuredUrl);
  } catch {
    throw new ApiError(
      "configuration",
      "BACKEND_API_URL must be an absolute HTTP(S) origin.",
    );
  }

  if (
    (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") ||
    baseUrl.username.length > 0 ||
    baseUrl.password.length > 0 ||
    baseUrl.pathname !== "/" ||
    baseUrl.search.length > 0 ||
    baseUrl.hash.length > 0
  ) {
    throw new ApiError(
      "configuration",
      "BACKEND_API_URL must be an HTTP(S) origin without credentials, path, query, or fragment.",
    );
  }

  return new URL(path, baseUrl);
}

async function requestJson<T>(path: string, sessionId?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(backendUrl(path), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(sessionId ? { Cookie: `sessionid=${sessionId}` } : {}),
      },
      ...(sessionId ? { redirect: "manual" as const } : {}),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiError("http", `Backend API returned HTTP ${response.status}.`, response.status);
    }

    const mediaType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (mediaType !== "application/json") {
      throw new ApiError("invalid_response", "Backend API returned a non-JSON response.");
    }

    try {
      return (await response.json()) as T;
    } catch {
      if (controller.signal.aborted) {
        throw new ApiError("timeout", `Backend API request timed out after ${REQUEST_TIMEOUT_MS} ms.`);
      }
      throw new ApiError("invalid_response", "Backend API returned invalid JSON.");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new ApiError("timeout", `Backend API request timed out after ${REQUEST_TIMEOUT_MS} ms.`);
    }
    throw new ApiError("network", "Backend API request failed.");
  } finally {
    clearTimeout(timeout);
  }
}

export function getBlogPosts(options: BlogPostListOptions = {}): Promise<Page<BlogPostSummary>> {
  const query = new URLSearchParams();
  if (options.page !== undefined) query.set("page", String(options.page));
  if (options.pageSize !== undefined) query.set("page_size", String(options.pageSize));
  if (options.tag !== undefined) query.set("tag", options.tag);

  const search = query.size > 0 ? `?${query.toString()}` : "";
  return requestJson(`/api/v1/blog/posts/${search}`);
}

export function getBlogPost(slug: string): Promise<BlogPost> {
  return requestJson(`/api/v1/blog/posts/${encodeURIComponent(slug)}/`);
}

export async function getBlogPostPreview(slug: string, sessionId: string): Promise<BlogPostPreview> {
  if (!sessionId) {
    throw new ApiError("http", "Authentication required.", 401);
  }
  return requestJson(`/api/v1/blog/posts/${encodeURIComponent(slug)}/preview/`, sessionId);
}

export function getBlogTags(): Promise<Collection<BlogTagWithCount>> {
  return requestJson("/api/v1/blog/tags/");
}

export function getProfile(): Promise<PublicProfile> {
  return requestJson("/api/v1/profile/");
}

export function getProjects(): Promise<Collection<Project>> {
  return requestJson("/api/v1/projects/");
}

export function getProject(slug: string): Promise<Project> {
  return requestJson(`/api/v1/projects/${encodeURIComponent(slug)}/`);
}
