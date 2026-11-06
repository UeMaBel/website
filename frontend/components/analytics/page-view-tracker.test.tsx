import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PageViewTracker } from "./page-view-tracker";
const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
let fetchMock: ReturnType<typeof vi.fn>;
function visible(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
}
function tick(ms: number) { act(() => vi.advanceTimersByTime(ms)); }
function contributions() { return fetchMock.mock.calls.map(call => JSON.parse(call[1].body)); }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  vi.spyOn(performance, "now").mockImplementation(() => Date.now());
  navigation.pathname = "/";
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  Object.defineProperty(document, "referrer", { configurable: true, value: "https://github.com/private?token=secret" });
  Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "0" });
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
test("counts once in StrictMode and never loads an external script", () => {
  const view = render(<StrictMode><PageViewTracker enabled /></StrictMode>);
  expect(contributions()).toEqual([{ path: "/", referrer: "github", views: 1, seconds: 0 }]);
  expect(view.container.querySelector("script")).toBeNull();
  expect(JSON.stringify(contributions())).not.toContain("private");
});
test("counts visible time approximately, pauses hidden tabs, and flushes on route change", () => {
  const view = render(<PageViewTracker enabled />);
  tick(12_000); visible("hidden");
  expect(contributions().at(-1)).toEqual({ path: "/", referrer: "github", views: 0, seconds: 10 });
  const count = fetchMock.mock.calls.length;
  tick(60_000); expect(fetchMock).toHaveBeenCalledTimes(count);
  visible("visible"); tick(8_000);
  navigation.pathname = "/blog/public-post";
  view.rerender(<PageViewTracker enabled />);
  expect(contributions().slice(-2)).toEqual([
    { path: "/", referrer: "github", views: 0, seconds: 10 },
    { path: "/blog/public-post", referrer: "direct", views: 1, seconds: 0 },
  ]);
  view.rerender(<PageViewTracker enabled />);
  expect(contributions().filter(c => c.views === 1)).toHaveLength(2);
});
test("flushes pagehide once, resumes bfcache without another pageview, and caps idle time", () => {
  render(<PageViewTracker enabled />);
  tick(11_000);
  act(() => window.dispatchEvent(new Event("pagehide")));
  act(() => window.dispatchEvent(new Event("pagehide")));
  expect(contributions()).toHaveLength(2);
  act(() => window.dispatchEvent(new Event("pageshow")));
  tick(31 * 60_000);
  expect(contributions().filter(c => c.views === 1)).toHaveLength(1);
  expect(contributions().reduce((sum, c) => sum + c.seconds, 0)).toBe(1800);
});
test("does not send when disabled, private, hidden initially, or DNT is enabled", () => {
  let view = render(<PageViewTracker enabled={false} />); view.unmount();
  navigation.pathname = "/blog/secret/preview";
  view = render(<PageViewTracker enabled />); view.unmount();
  navigation.pathname = "/"; visible("hidden");
  view = render(<PageViewTracker enabled />);
  expect(fetchMock).not.toHaveBeenCalled();
  visible("visible"); expect(fetchMock).toHaveBeenCalledOnce(); view.unmount();
  fetchMock.mockClear();
  Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "1" });
  render(<PageViewTracker enabled />); tick(60_000);
  expect(fetchMock).not.toHaveBeenCalled();
});
