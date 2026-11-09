import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import HomePage from "../app/page";
import AboutPage from "../app/about/page";
import ContactPage from "../app/contact/page";
import DatenschutzPage from "../app/datenschutz/page";
import ProjectsPage from "../app/projects/page";
import BlogPage from "../app/blog/page";
import BlogPostPage from "../app/blog/[slug]/page";
import ProjectDetailPage from "../app/projects/[slug]/page";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
  permanentRedirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  permanentRedirect: mocks.permanentRedirect,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function profile(cvUrl: string | null) {
  return {
    display_name: "Site Owner",
    biography: "Independent software engineer focused on AI.",
    email: "owner@example.test",
    cv_url: cvUrl,
    experience: [],
    education: [],
    skills: [],
    links: [{ position: 0, label: "Professional profile", url: "https://example.test/owner" }],
  };
}

function post(overrides: Record<string, unknown> = {}) {
  return {
    slug: "published-article",
    title: "Published article",
    published_at: "2026-10-30T12:00:00Z",
    author: { username: "owner", name: "Site Owner" },
    tags: [],
    body: "Article body.",
    ...overrides,
  };
}

function project(overrides: Record<string, unknown> = {}) {
  return {
    slug: "sample-project",
    title: "Sample project",
    problem: "Teams needed a **reliable** workflow.",
    contribution: "I built the system.",
    technologies: ["Django", "PostgreSQL"],
    description: "Additional project details.",
    repository_url: null,
    demo_url: null,
    images: [],
    ...overrides,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mocks.notFound.mockClear();
  mocks.permanentRedirect.mockClear();
  vi.stubEnv("BACKEND_API_URL", "https://content.example.test");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("public content journeys", () => {

  it("renders current database education dates and refreshes after an API outage", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      fetchMock.mockRejectedValueOnce(new Error("offline"));
      const unavailable = render(await AboutPage());
      expect(document.querySelector("time")).toBeNull();
      unavailable.unmount();
      fetchMock.mockResolvedValue(jsonResponse({
        ...profile(null),
        education: [
          { position: 2, institution: "Deutsche Telekom AG", qualification: "Fachinformatiker Systemintegration", start_date: "2009-09-01", end_date: "2012-06-01", description: "" },
          { position: 0, institution: "University of applied Science Rosenheim", qualification: "B. Sc. Business Mathematics and Actuarial Science", start_date: "2013-09-01", end_date: "2017-08-31", description: "" },
        ],
        experience: [
          { position: 0, employer: "Current project", role: "Lead", start_date: "2020-04-01", end_date: null, description: "" },
        ],
      }));
      render(await AboutPage());
      expect(screen.getByText("September 2013")).toBeTruthy();
      expect(screen.getByText("August 2017")).toBeTruthy();
      expect(screen.getByText("September 2009")).toBeTruthy();
      expect(screen.getByText("June 2012")).toBeTruthy();
      expect(screen.getByText("April 2020")).toBeTruthy();
      expect(Array.from(document.querySelectorAll("time"), (element) => element.dateTime)).toEqual([
        "2020-04-01", "2013-09-01", "2017-08-31", "2009-09-01", "2012-06-01",
      ]);
    } finally {
      errorLog.mockRestore();
    }
  });

  it.each([false, true])("honors detail thumbnail hiding (%s) while retaining project listing images", async (hidden) => {
    const item = project({
      thumbnail: { url: "/media/uploads/cover.png", alt_text: "Project cover" },
      hide_thumbnail_on_detail: hidden,
    });
    fetchMock.mockResolvedValue(jsonResponse(item));
    const detail = render(await ProjectDetailPage({ params: Promise.resolve({ slug: "sample-project" }) }));
    expect(Boolean(screen.queryByRole("img", { name: "Project cover" }))).toBe(!hidden);
    detail.unmount();
    fetchMock.mockResolvedValue(jsonResponse({ count: 1, results: [item] }));
    render(await ProjectsPage());
    expect(screen.getByRole("img", { name: "Project cover" })).toBeTruthy();
  });

  it.each([false, true])("honors detail thumbnail hiding (%s) while retaining blog listing images", async (hidden) => {
    const item = post({
      thumbnail: { url: "/media/uploads/cover.png", alt_text: "Article cover" },
      hide_thumbnail_on_detail: hidden,
    });
    fetchMock.mockResolvedValue(jsonResponse(item));
    const detail = render(await BlogPostPage({ params: Promise.resolve({ slug: "published-article" }) }));
    expect(Boolean(screen.queryByRole("img", { name: "Article cover" }))).toBe(!hidden);
    detail.unmount();
    fetchMock.mockImplementation((url: URL) => Promise.resolve(jsonResponse(
      url.pathname === "/api/v1/blog/tags/" ? { count: 0, results: [] }
        : { count: 1, results: [item], next: null, previous: null },
    )));
    render(await BlogPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("img", { name: "Article cover" })).toBeTruthy();
  });

  it("shows an unavailable state instead of stale profile dates when the API fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const privacy = render(DatenschutzPage());
    expect(screen.getByRole("heading", { name: "Datenschutz", level: 1 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Datenschutzhinweise von Hetzner" })).toBeTruthy();
    expect(screen.queryByText(/Arbeitsfassung/)).toBeNull();
    privacy.unmount();
    const about = render(await AboutPage());
    expect(screen.getByRole("status").textContent).toContain("Profile information is temporarily unavailable");
    expect(screen.queryByText("BDE Datahub")).toBeNull();
    expect(document.querySelector("time")).toBeNull();
    about.unmount();
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://content.example.test/api/v1/profile/"),
      expect.objectContaining({ cache: "no-store" }),
    );
    fetchMock.mockClear();
    render(ContactPage());
    expect(screen.getByRole("link", { name: "Email" }).getAttribute("href")).toBe("mailto:matthias@uebel.dev");
    expect(screen.getByRole("region", { name: "Impressum" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps projects available when the optional profile request fails", async () => {
    fetchMock.mockImplementation((url: URL) => Promise.resolve(
      url.pathname === "/api/v1/projects/"
        ? jsonResponse({ count: 1, results: [project()] })
        : jsonResponse({}, 503),
    ));
    render(await ProjectsPage());
    expect(screen.getByRole("link", { name: "Sample project" })).toBeTruthy();
  });

  it.each([false, true])("shows homepage writing only when published posts exist (%s)", async (hasPosts) => {
    fetchMock.mockImplementation((url: URL) => Promise.resolve(jsonResponse({
      count: hasPosts && url.pathname === "/api/v1/blog/posts/" ? 1 : 0,
      results: hasPosts && url.pathname === "/api/v1/blog/posts/" ? [post()] : [],
    })));

    render(await HomePage());

    if (hasPosts) {
      expect(screen.getByRole("link", { name: "Read the blog" }).getAttribute("href")).toBe("/blog");
      expect(screen.getByRole("heading", { name: "Notes from the work" })).toBeTruthy();
      expect(screen.getByRole("link", { name: /Published article/ }).getAttribute("href")).toBe("/blog/published-article");
    } else {
      expect(screen.queryByRole("link", { name: "Read the blog" })).toBeNull();
      expect(screen.queryByRole("heading", { name: "Notes from the work" })).toBeNull();
    }
    expect(screen.getByRole("link", { name: "Projects" }).getAttribute("href")).toBe("/projects");
    expect(screen.getByRole("link", { name: "About / CV" }).getAttribute("href")).toBe("/about");
    expect(screen.getByRole("link", { name: "Email" }).getAttribute("href")).toBe("mailto:matthias@uebel.dev");
    expect(screen.queryByRole("link", { name: "owner@example.test" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Professional profile" })).toBeNull();
  });

  it("keeps the selected tag in blog pagination links", async () => {
    const selectedPost = post({ slug: "ai-article", title: "AI article" });
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/blog/tags/") {
        return jsonResponse({ count: 1, results: [{ slug: "ai", name: "AI", post_count: 21 }] });
      }
      return jsonResponse({
        count: 21,
        next: "/api/v1/blog/posts/?page=3&page_size=10&tag=ai",
        previous: "/api/v1/blog/posts/?page=1&page_size=10&tag=ai",
        results: [selectedPost],
      });
    });

    render(await BlogPage({ searchParams: Promise.resolve({ page: "2", tag: "ai" }) }));

    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
    expect(screen.getByRole("link", { name: "AI" }).getAttribute("href")).toBe("/blog?tag=ai");
    expect(screen.getByRole("link", { name: "AI" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Previous page" }).getAttribute("href")).toBe("/blog?page=1&tag=ai");
    expect(screen.getByRole("link", { name: "Next page" }).getAttribute("href")).toBe("/blog?page=3&tag=ai");
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain(
      "https://content.example.test/api/v1/blog/posts/?page=2&page_size=10&tag=ai",
    );
  });

  it("permanently redirects an old blog URL to the current slug", async () => {
    fetchMock.mockResolvedValue(jsonResponse(post({ slug: "current-slug" })));

    await expect(BlogPostPage({ params: Promise.resolve({ slug: "historical-slug" }) }))
      .rejects.toThrow("NEXT_REDIRECT:/blog/current-slug");

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://content.example.test/api/v1/blog/posts/historical-slug/"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("renders published Markdown while keeping unsafe markup and URLs inert", async () => {
    fetchMock.mockResolvedValue(jsonResponse(post({
      body: '## Safe article\n\n**Bold text** is supported.\n\n[Unsafe link](javascript:alert%281%29)\n\n<script>attack()</script>',
    })));

    render(await BlogPostPage({ params: Promise.resolve({ slug: "published-article" }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Published article" })).toBeTruthy();
    expect(screen.getByText("Bold text").tagName).toBe("STRONG");
    expect(screen.queryByRole("link", { name: "Unsafe link" })).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(document.body.textContent).not.toContain("attack()");
  });

  it.each([null, "/media/cv.pdf"])("shows the CV section only when a download is configured (%s)", async (cvUrl) => {
    fetchMock.mockResolvedValue(jsonResponse({ ...profile(cvUrl), contact_introduction: "", impressum: "", projects_introduction: "" }));

    render(await AboutPage());

    if (cvUrl) {
      expect(screen.getByRole("heading", { name: "Curriculum vitae" })).toBeTruthy();
      const download = screen.getByRole("link", { name: "Download CV (PDF)" });
      expect(download.getAttribute("href")).toBe(cvUrl);
      expect(download.hasAttribute("download")).toBe(true);
    } else {
      expect(screen.queryByRole("heading", { name: "Curriculum vitae" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Download CV (PDF)" })).toBeNull();
    }
  });

  it("shows project content when repository and demo links are absent", async () => {
    fetchMock.mockResolvedValue(jsonResponse(project()));

    render(await ProjectDetailPage({ params: Promise.resolve({ slug: "sample-project" }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Sample project" })).toBeTruthy();
    expect(screen.getByText("reliable").tagName).toBe("STRONG");
    expect(screen.getByText("I built the system.")).toBeTruthy();
    expect(screen.getByText("Django")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Project links" })).toBeNull();
  });

  it("serves project images through the public same-origin media route", async () => {
    vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://www.example.test");
    fetchMock.mockResolvedValue(jsonResponse(project({
      images: [{
        position: 0,
        url: "/media/uploads/project-image.png",
        alt_text: "Project diagram",
      }],
    })));

    render(await ProjectDetailPage({ params: Promise.resolve({ slug: "sample-project" }) }));

    const image = screen.getByRole("img", { name: "Project diagram" });
    expect(image.getAttribute("src")).toBe("/media/uploads/project-image.png");
    expect(image.getAttribute("src")).not.toContain("backend:8000");
  });

  it("exposes configured repository and demo links", async () => {
    fetchMock.mockResolvedValue(jsonResponse(project({
      repository_url: "https://example.test/source",
      demo_url: "https://example.test/demo",
    })));

    render(await ProjectDetailPage({ params: Promise.resolve({ slug: "sample-project" }) }));

    const repositoryLink = screen.getByRole("link", { name: "Source repository" });
    const demoLink = screen.getByRole("link", { name: "Live demo" });
    expect(repositoryLink.getAttribute("href")).toBe("https://example.test/source");
    expect(demoLink.getAttribute("href")).toBe("https://example.test/demo");
    expect(repositoryLink.getAttribute("target")).toBe("_blank");
    expect(fireEvent.click(repositoryLink)).toBe(true);
    expect(fireEvent.click(demoLink)).toBe(true);

  });
});
