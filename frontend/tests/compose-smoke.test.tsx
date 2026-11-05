import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import HomePage from "../app/page";
vi.mock("server-only", () => ({}));
vi.mock("../lib/api", () => ({
  getProfile: async () => ({ display_name: "", biography: "", email: "", links: [] }),
  getProjects: async () => ({ results: [] }),
  getBlogPosts: async () => ({ results: [] }),
}));
it("current SSR homepage satisfies the Compose smoke assertion", async () => {
  const script = readFileSync("../.github/scripts/compose-smoke.sh", "utf8");
  const marker = script.match(/grep -[qF]+ '([^']+)' "\$home_html"/)?.[1];
  expect(marker).toBeTruthy();
  expect(renderToStaticMarkup(await HomePage())).toContain(marker);
});
