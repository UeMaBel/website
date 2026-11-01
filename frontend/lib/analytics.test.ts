import { expect, test, vi } from "vitest";
import {
  createPageViewPayload,
  getUmamiScriptUrl,
  isPublicAnalyticsPath,
  sanitizeExternalReferrer,
  sendPageView,
} from "./analytics";

test.each([
  "/",
  "/about",
  "/contact",
  "/blog",
  "/blog/a-public-post",
  "/projects",
  "/projects/a-public-project",
])("allows public analytics path %s", (pathname) => {
  expect(isPublicAnalyticsPath(pathname)).toBe(true);
});

test.each([
  "/admin/",
  "/api/v1/profile/",
  "/blog/a-draft/preview",
  "/blog/a-post/preview/",
  "/projects/a/nested-path",
  "/unknown",
  "/blog/private%2Fvalue",
  "/blog?tag=private",
])("rejects non-public analytics path %s", (pathname) => {
  expect(isPublicAnalyticsPath(pathname)).toBe(false);
});

test("accepts only an absolute script.js URL without credentials or query data", () => {
  expect(getUmamiScriptUrl(" http://analytics.localhost:3000/script.js ", "http://localhost:3000")).toBe(
    "http://analytics.localhost:3000/script.js",
  );
  expect(getUmamiScriptUrl("javascript:alert(1)", "https://site.example")).toBeNull();
  expect(getUmamiScriptUrl("http://analytics.example/script.js", "https://site.example")).toBeNull();
  expect(getUmamiScriptUrl("https://user:password@analytics.example/script.js", "https://site.example")).toBeNull();
  expect(getUmamiScriptUrl("https://analytics.example/script.js?website=secret", "https://site.example")).toBeNull();
  expect(getUmamiScriptUrl("https://analytics.example/other.js", "https://site.example")).toBeNull();
  expect(getUmamiScriptUrl("https://site.example/script.js", "https://site.example")).toBeNull();
});

test("reduces external referrers to their origin and drops same-site or unsafe values", () => {
  expect(
    sanitizeExternalReferrer(
      "https://news.example/article?email=reader@example.test#comments",
      "https://site.example",
    ),
  ).toBe("https://news.example");
  expect(sanitizeExternalReferrer("https://site.example/private?token=x", "https://site.example")).toBeUndefined();
  expect(sanitizeExternalReferrer("mailto:reader@example.test", "https://site.example")).toBeUndefined();
  expect(sanitizeExternalReferrer("https://user:password@news.example/", "https://site.example")).toBeUndefined();
});

test("creates path-only pageviews with generic titles and an allowlisted payload", () => {
  expect(
    createPageViewPayload(
      "/blog/a-public-post/",
      "synthetic-website",
      "site.example",
      "https://site.example",
      "https://news.example/story?private=x",
    ),
  ).toEqual({
    website: "synthetic-website",
    hostname: "site.example",
    url: "/blog/a-public-post",
    title: "Blog article",
    referrer: "https://news.example",
  });
  expect(createPageViewPayload("/blog/draft/preview", "id", "site.example", "https://site.example")).toBeNull();
});

test("sends tracking without propagating synchronous or asynchronous failures", async () => {
  const rejectedTracker = { track: vi.fn().mockRejectedValue(new Error("offline")) };
  expect(() => sendPageView(rejectedTracker, {
    website: "synthetic-website",
    hostname: "site.example",
    url: "/",
    title: "Home",
  })).not.toThrow();
  await Promise.resolve();
  expect(rejectedTracker.track).toHaveBeenCalledOnce();

  const throwingTracker = { track: vi.fn(() => { throw new Error("blocked"); }) };
  expect(() => sendPageView(throwingTracker, {
    website: "synthetic-website",
    hostname: "site.example",
    url: "/",
    title: "Home",
  })).not.toThrow();
});
