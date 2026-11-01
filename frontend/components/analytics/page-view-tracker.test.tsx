import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("next/script", async () => {
  const React = await import("react");
  return {
    default: (props: Record<string, unknown>) => React.createElement("button", {
      type: "button",
      id: props.id as string,
      src: props.src as string,
      "data-testid": "umami-script",
      "data-website-id": props["data-website-id"] as string,
      "data-auto-track": props["data-auto-track"] as string,
      "data-do-not-track": props["data-do-not-track"] as string,
      onClick: props.onReady as (() => void) | undefined,
      onDoubleClick: props.onError as (() => void) | undefined,
    }),
  };
});

import { PageViewTracker } from "./page-view-tracker";

const config = {
  enabled: true,
  scriptUrl: "https://analytics.example.test/script.js",
  siteOrigin: "https://site.example.test",
  websiteId: "synthetic-website",
};

function loadScript(): void {
  fireEvent.click(screen.getByTestId("umami-script"));
}

beforeEach(() => {
  navigation.pathname = "/";
  delete window.umami;
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value: "https://news.example/story?email=reader@example.test",
  });
});

test("tracks the initial public route and one view per pathname transition", () => {
  const track = vi.fn().mockResolvedValue(undefined);
  window.umami = { track };
  const view = render(<PageViewTracker {...config} />);
  const script = screen.getByTestId("umami-script");
  expect(script.getAttribute("src")).toBe(config.scriptUrl);
  expect(script.getAttribute("data-auto-track")).toBe("false");
  expect(script.getAttribute("data-do-not-track")).toBe("true");
  expect(track).not.toHaveBeenCalled();

  navigation.pathname = "/blog/a-public-post";
  view.rerender(<PageViewTracker {...config} />);
  expect(track).not.toHaveBeenCalled();

  act(loadScript);
  expect(track).toHaveBeenCalledTimes(2);
  expect(track).toHaveBeenNthCalledWith(1, {
    website: "synthetic-website",
    hostname: window.location.hostname,
    url: "/",
    title: "Home",
    referrer: "https://news.example",
  });
  expect(track).toHaveBeenLastCalledWith({
    website: "synthetic-website",
    hostname: window.location.hostname,
    url: "/blog/a-public-post",
    title: "Blog article",
  });

  // Query/hash changes and rerenders do not change usePathname or add views.
  view.rerender(<PageViewTracker {...config} />);
  expect(track).toHaveBeenCalledTimes(2);

  navigation.pathname = "/";
  view.rerender(<PageViewTracker {...config} />);
  expect(track).toHaveBeenCalledTimes(3);
  expect(track).toHaveBeenNthCalledWith(3, {
    website: "synthetic-website",
    hostname: window.location.hostname,
    url: "/",
    title: "Home",
  });

  navigation.pathname = "/blog/draft-secret/preview";
  view.rerender(<PageViewTracker {...config} />);
  expect(screen.queryByTestId("umami-script")).toBeNull();
  expect(track).toHaveBeenCalledTimes(3);

  navigation.pathname = "/";
  view.rerender(<PageViewTracker {...config} />);
  expect(track).toHaveBeenCalledTimes(4);
});

test("does not load or track preview, admin, API, or nested routes", () => {
  navigation.pathname = "/blog/draft-secret/preview";
  const track = vi.fn().mockResolvedValue(undefined);
  window.umami = { track };
  const view = render(<PageViewTracker {...config} />);
  expect(screen.queryByTestId("umami-script")).toBeNull();

  navigation.pathname = "/admin/";
  view.rerender(<PageViewTracker {...config} />);
  navigation.pathname = "/api/v1/profile/";
  view.rerender(<PageViewTracker {...config} />);
  expect(screen.queryByTestId("umami-script")).toBeNull();
  expect(track).not.toHaveBeenCalled();

  navigation.pathname = "/about";
  view.rerender(<PageViewTracker {...config} />);
  act(loadScript);
  expect(track).toHaveBeenCalledOnce();
  expect(track).toHaveBeenCalledWith(expect.objectContaining({ url: "/about", title: "About" }));
});

test("stays disabled without explicit configuration and survives script failure", () => {
  const track = vi.fn().mockResolvedValue(undefined);
  window.umami = { track };
  const disabled = render(<PageViewTracker {...config} enabled={false} />);
  expect(screen.queryByTestId("umami-script")).toBeNull();
  disabled.unmount();

  const missingId = render(<PageViewTracker {...config} websiteId="" />);
  expect(screen.queryByTestId("umami-script")).toBeNull();
  missingId.unmount();

  const view = render(<PageViewTracker {...config} />);
  fireEvent.doubleClick(screen.getByTestId("umami-script"));
  navigation.pathname = "/blog";
  expect(() => view.rerender(<PageViewTracker {...config} />)).not.toThrow();
  expect(track).not.toHaveBeenCalled();
});
