import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "../app/stats/collect/route";
vi.mock("server-only", () => ({}));
const payload = { path: "/", referrer: "direct", views: 1, seconds: 0 };
let forward: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("STATISTICS_ENABLED", "true");
  vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://site.test");
  vi.stubEnv("BACKEND_API_URL", "http://backend:8000");
  forward = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", forward);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function request(body: unknown = payload, origin = "https://site.test") {
  return new Request("https://site.test/stats/collect", { method: "POST", body: JSON.stringify(body), headers: {
    "Content-Type": "application/json", Origin: origin, Cookie: "private=value", "User-Agent": "Private browser",
    "X-Forwarded-For": "192.0.2.123", Referer: "https://site.test/?private=secret",
  } });
}
test("forwards only aggregate contributions, never visitor metadata or cookies", async () => {
  const response = await POST(request());
  expect(response.status).toBe(204);
  expect(response.headers.has("Set-Cookie")).toBe(false);
  const [url, options] = forward.mock.calls[0];
  expect(String(url)).toBe("http://backend:8000/api/v1/statistics/");
  expect(options.headers).toEqual({ "Content-Type": "application/json", "User-Agent": "aggregate-statistics" });
  expect(options.credentials).toBe("omit");
  expect(JSON.parse(options.body)).toEqual(payload);
});
test("rejects cross-origin, arbitrary identifiers, and oversized bodies before forwarding", async () => {
  expect((await POST(request(payload, "https://evil.test"))).status).toBe(403);
  expect((await POST(request({ ...payload, visitor: "id" }))).status).toBe(400);
  expect((await POST(request({ value: "x".repeat(1025) }))).status).toBe(413);
  expect(forward).not.toHaveBeenCalled();
});
test("accepts the original same-origin Host when standalone uses an internal localhost URL", async () => {
  const req = new Request("http://localhost:3310/stats/collect", { method: "POST", body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3310", Host: "127.0.0.1:3310" },
  });
  expect((await POST(req)).status).toBe(204);
});
test("disabling collection and backend failures do not affect site navigation", async () => {
  vi.stubEnv("STATISTICS_ENABLED", "false");
  expect((await POST(request())).status).toBe(204);
  expect(forward).not.toHaveBeenCalled();
  vi.stubEnv("STATISTICS_ENABLED", "true");
  forward.mockRejectedValueOnce(new Error("offline"));
  expect((await POST(request())).status).toBe(503);
});
