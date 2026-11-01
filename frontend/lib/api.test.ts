import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  getBlogPost,
  getBlogPostPreview,
  getBlogPosts,
  getBlogTags,
  getProfile,
  getProject,
  getProjects,
} from "./api";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

describe("server-side API client", () => {
  it("uses the configured backend origin, response contract, and uncached request options", async () => {
    vi.stubEnv("BACKEND_API_URL", "http://backend.internal:8000");
    const page = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          slug: "hello",
          title: "Hello",
          published_at: "2026-10-30T12:00:00Z",
          author: { username: "owner", name: "Site Owner" },
          tags: [{ name: "AI", slug: "ai" }],
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(page));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getBlogPosts({ page: 2, pageSize: 5, tag: "ai systems" });

    expect(result).toEqual(page);
    expect(result.results[0].author.name).toBe("Site Owner");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://backend.internal:8000/api/v1/blog/posts/?page=2&page_size=5&tag=ai+systems"),
      expect.objectContaining({
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("requests blog, profile, and project contract routes with typed successful responses", async () => {
    vi.stubEnv("BACKEND_API_URL", "https://content.example.test");
    const responses: unknown[] = [
      {
        slug: "first-post",
        title: "First post",
        published_at: "2026-10-30T12:00:00Z",
        author: { username: "owner", name: "Site Owner" },
        tags: [],
        body: "Markdown source",
      },
      { count: 1, results: [{ slug: "ai", name: "AI", post_count: 2 }] },
      {
        display_name: "Site Owner",
        biography: "Biography source",
        email: "hello@example.test",
        cv_url: null,
        experience: [],
        education: [],
        skills: [],
        links: [],
      },
      { count: 0, results: [] },
      {
        slug: "sample",
        title: "Sample project",
        problem: "Problem source",
        contribution: "Contribution source",
        technologies: ["Django"],
        description: "Description source",
        repository_url: null,
        demo_url: null,
        images: [],
      },
    ];
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(responses.shift() ?? {}));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getBlogPost("first-post")).resolves.toMatchObject({ body: "Markdown source" });
    await expect(getBlogTags()).resolves.toMatchObject({ results: [{ post_count: 2 }] });
    await expect(getProfile()).resolves.toMatchObject({ display_name: "Site Owner", cv_url: null });
    await expect(getProjects()).resolves.toEqual({ count: 0, results: [] });
    await expect(getProject("sample")).resolves.toMatchObject({
      technologies: ["Django"],
      images: [],
    });

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://content.example.test/api/v1/blog/posts/first-post/",
      "https://content.example.test/api/v1/blog/tags/",
      "https://content.example.test/api/v1/profile/",
      "https://content.example.test/api/v1/projects/",
      "https://content.example.test/api/v1/projects/sample/",
    ]);
  });

  it("forwards only the Django session cookie to the authenticated preview route", async () => {
    vi.stubEnv("BACKEND_API_URL", "https://content.example.test");
    const preview = {
      slug: "draft-post",
      title: "Draft post",
      published_at: null,
      author: { username: "owner", name: "Site Owner" },
      tags: [],
      body: "Draft Markdown",
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(preview));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getBlogPostPreview("draft-post", "trusted-session-value")).resolves.toEqual(preview);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://content.example.test/api/v1/blog/posts/draft-post/preview/"),
      expect.objectContaining({
        cache: "no-store",
        redirect: "manual",
        headers: {
          Accept: "application/json",
          Cookie: "sessionid=trusted-session-value",
        },
      }),
    );
  });

  it("rejects an empty preview session without making a backend request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getBlogPostPreview("draft-post", "")).rejects.toMatchObject({
      code: "http",
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the documented local origin when the backend URL is unset", async () => {
    vi.stubEnv("BACKEND_API_URL", "");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ count: 0, results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await getProjects();

    expect(fetchMock.mock.calls[0][0]).toEqual(new URL("http://127.0.0.1:8000/api/v1/projects/"));
  });

  it("rejects invalid backend URL configuration without making a request", async () => {
    vi.stubEnv("BACKEND_API_URL", "ftp://backend.internal:8000");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getProfile()).rejects.toMatchObject({ code: "configuration" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves HTTP status for missing resources and backend failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "Not found." }, 404)));
    await expect(getProject("missing")).rejects.toMatchObject({
      code: "http",
      status: 404,
      message: "Backend API returned HTTP 404.",
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "private detail" }, 503)));
    await expect(getBlogPosts()).rejects.toMatchObject({
      code: "http",
      status: 503,
      message: "Backend API returned HTTP 503.",
    });
  });

  it("normalizes malformed JSON and non-JSON backend responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{invalid", { headers: { "content-type": "application/json" } }),
      ),
    );
    const invalidJson = getProfile();
    await expect(invalidJson).rejects.toBeInstanceOf(ApiError);
    await expect(invalidJson).rejects.toMatchObject({ code: "invalid_response" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>error</html>")));
    await expect(getProjects()).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("normalizes network errors without exposing the fetch exception", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private network detail")));

    await expect(getProjects()).rejects.toMatchObject({
      code: "network",
      message: "Backend API request failed.",
    });
  });

  it("aborts requests after the timeout and reports a stable timeout error", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = expect(getProject("slow")).rejects.toMatchObject({
      code: "timeout",
      message: "Backend API request timed out after 5000 ms.",
    });
    await vi.advanceTimersByTimeAsync(5_000);
    await result;

    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});
