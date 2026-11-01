import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SiteHeader } from "./site-header";

test("readers can find each public destination through the main navigation", () => {
  render(<SiteHeader />);
  const navigation = screen.getByRole("navigation", { name: "Main navigation" });

  for (const [name, href] of [
    ["Home", "/"],
    ["Blog", "/blog"],
    ["About / CV", "/about"],
    ["Projects", "/projects"],
    ["Contact", "/contact"],
  ]) {
    expect(within(navigation).getByRole("link", { name }).getAttribute("href")).toBe(href);
  }
});
