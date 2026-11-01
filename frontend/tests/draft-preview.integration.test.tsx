import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BlogPage from "../app/blog/page";
import BlogPostPage, { generateMetadata as generatePublicPostMetadata } from "../app/blog/[slug]/page";
import BlogPreviewPage, {
  dynamic as previewDynamic,
  fetchCache as previewFetchCache,
  metadata as previewMetadata,
} from "../app/blog/[slug]/preview/page";

const mocks = vi.hoisted(() => {
  const cookieValues: Record<string, string> = {};
  return {
    cookieValues,
    cookies: vi.fn(async () => ({
      get(name: string) {
        const value = cookieValues[name];
        return value ? { name, value } : undefined;
      },
    })),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  permanentRedirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

const draft = {
  slug: "draft-secret",
  title: "Confidential draft title",
  published_at: null,
  author: { username: "editor", name: "Editor" },
  tags: [{ slug: "private-tag", name: "Private tag" }],
  body: "Confidential draft body with **draft formatting**.",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function previewProps(slug = draft.slug) {
  return { params: Promise.resolve({ slug }) };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const key of Object.keys(mocks.cookieValues)) delete mocks.cookieValues[key];
  mocks.cookies.mockClear();
  mocks.notFound.mockClear();
  vi.stubEnv("BACKEND_API_URL", "https://trusted-backend.example");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("draft preview and public blog journeys", () => {
  it("renders a staff preview and forwards only the session cookie without caching", async () => {
    Object.assign(mocks.cookieValues, {
      sessionid: "staff-session-value",
      csrftoken: "must-not-forward",
      analytics: "must-not-forward",
    });
    fetchMock.mockResolvedValue(jsonResponse(draft));

    render(await BlogPreviewPage(previewProps()));

    expect(screen.getByRole("heading", { level: 1, name: draft.title })).toBeTruthy();
    expect(screen.getByText("Draft preview")).toBeTruthy();
    expect(document.querySelector(".markdown")?.textContent).toBe("Confidential draft body with draft formatting.");
    expect(screen.getByText("draft formatting")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://trusted-backend.example/api/v1/blog/posts/draft-secret/preview/"),
      expect.objectContaining({
        cache: "no-store",
        redirect: "manual",
        headers: {
          Accept: "application/json",
          Cookie: "sessionid=staff-session-value",
        },
      }),
    );

    expect(previewDynamic).toBe("force-dynamic");
    expect(previewFetchCache).toBe("force-no-store");
    expect(previewMetadata.robots).toEqual({ index: false, follow: false });
    expect(JSON.stringify(previewMetadata)).not.toContain(draft.title);
    expect(JSON.stringify(previewMetadata)).not.toContain(draft.body);
  });

  it("rejects anonymous preview requests without contacting the backend", async () => {
    await expect(BlogPreviewPage(previewProps())).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a session the backend does not authorize", async () => {
    mocks.cookieValues.sessionid = "non-staff-session";
    fetchMock.mockResolvedValue(jsonResponse({ detail: "Permission denied." }, 403));

    await expect(BlogPreviewPage(previewProps())).rejects.toThrow("NEXT_NOT_FOUND");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("shows a safe recovery message when the preview backend is unavailable", async () => {
    mocks.cookieValues.sessionid = "staff-session-value";
    fetchMock.mockResolvedValue(jsonResponse({ detail: "private backend detail" }, 503));

    render(await BlogPreviewPage(previewProps()));

    expect(screen.getByRole("alert").textContent).toContain("temporarily unavailable");
    expect(screen.queryByText("private backend detail")).toBeNull();
  });

  it("keeps draft content out of the public blog listing and detail metadata", async () => {
    const publishedPost = {
      slug: "published-article",
      title: "Published article",
      published_at: "2026-10-30T12:00:00Z",
      author: { username: "editor", name: "Editor" },
      tags: [],
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/blog/tags/") {
        return jsonResponse({ count: 0, results: [] });
      }
      if (url.pathname === "/api/v1/blog/posts/") {
        return jsonResponse({ count: 1, next: null, previous: null, results: [publishedPost] });
      }
      return jsonResponse({ detail: "Not found." }, 404);
    });

    render(await BlogPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("link", { name: "Published article" })).toBeTruthy();
    expect(screen.queryByText(draft.title)).toBeNull();
    expect(screen.queryByText(draft.body)).toBeNull();

    const metadata = await generatePublicPostMetadata({ params: Promise.resolve({ slug: draft.slug }) });
    expect(metadata.title).toBe("Post not found");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(JSON.stringify(metadata)).not.toContain(draft.title);
    expect(JSON.stringify(metadata)).not.toContain(draft.body);
    expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname)).toContain(
      "/api/v1/blog/posts/draft-secret/",
    );

    await expect(BlogPostPage({ params: Promise.resolve({ slug: draft.slug }) }))
      .rejects.toThrow("NEXT_NOT_FOUND");
  });
});
