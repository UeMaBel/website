import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SiteHeader } from "./site-header";

test("readers can find each public destination through the main navigation", () => {
  render(<SiteHeader />);
  expect(screen.getByRole("link", { name: "Matthias Uebelacker — Home" }).getAttribute("href")).toBe("/");
  const navigation = screen.getByRole("navigation", { name: "Main navigation" });

  for (const [name, href] of [

    ["Blog", "/blog"],
    ["About / CV", "/about"],
    ["Projects", "/projects"],
    ["Contact", "/contact"],
  ]) {
    expect(within(navigation).getByRole("link", { name: `[${name}]` }).getAttribute("href")).toBe(href);
  }
});
