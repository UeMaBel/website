import { expect, test, vi, afterEach } from "vitest";
import { isPublicAnalyticsPath, referrerSource, validContribution, sendContribution } from "./analytics";
afterEach(() => vi.unstubAllGlobals());
test("allows only public page paths without queries, fragments or preview routes", () => {
  for (const path of ["/", "/about", "/datenschutz", "/blog/post", "/projects/project"]) expect(isPublicAnalyticsPath(path)).toBe(true);
  for (const path of ["/admin", "/api/v1/profile/", "/blog/post/preview", "/blog?email=a@b.de", "/blog/post#secret", "/unknown"]) expect(isPublicAnalyticsPath(path)).toBe(false);
});
test("reduces referrers to a fixed source vocabulary, including unknown private hostnames", () => {
  expect(referrerSource("https://www.google.de/search?q=private", "https://site.test")).toBe("google");
  expect(referrerSource("https://github.com/user/private?token=x", "https://site.test")).toBe("github");
  expect(referrerSource("https://person-123.private.example/path", "https://site.test")).toBe("other");
  expect(referrerSource("https://google.com.evil.test", "https://site.test")).toBe("other");
  expect(referrerSource("https://person:password@github.com", "https://site.test")).toBe("other");
  expect(referrerSource("https://site.test/blog", "https://site.test")).toBe("direct");
  expect(referrerSource("", "https://site.test")).toBe("direct");
});
test("rejects arbitrary identity fields and invalid time increments", () => {
  const view = { path: "/", referrer: "direct", views: 1, seconds: 0 };
  expect(validContribution(view)).toBe(true);
  expect(validContribution({ ...view, views: 0, seconds: 15 })).toBe(true);
  for (const extra of [{ ip: "127.0.0.1" }, { visitor: "abc" }, { session: "xyz" }, { title: "private" }]) expect(validContribution({ ...view, ...extra })).toBe(false);
  for (const seconds of [-5, 1, 35, 4.5]) expect(validContribution({ ...view, views: 0, seconds })).toBe(false);
  expect(validContribution({ ...view, referrer: "https://private.example" })).toBe(false);
});
test("sends without credentials, referrer headers, retries, storage, or beacon", async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", fetchMock);
  const data = { path: "/", referrer: "direct" as const, views: 1, seconds: 0 };
  sendContribution(data);
  await Promise.resolve();
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/stats/collect", expect.objectContaining({
    body: JSON.stringify(data), credentials: "omit", referrerPolicy: "no-referrer", keepalive: true,
  }));
});
