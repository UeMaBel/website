import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ProfileContactLinks } from "./profile-contact-links";
afterEach(() => vi.unstubAllGlobals());
test("contact links navigate normally without analytics events", () => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  render(<ProfileContactLinks email="owner@example.test" links={[{ position: 0, label: "GitHub", url: "https://github.com/example" }]} />);
  const email = screen.getByRole("link", { name: "owner@example.test" });
  const github = screen.getByRole("link", { name: "GitHub" });
  expect(email.getAttribute("href")).toBe("mailto:owner@example.test");
  expect(github.getAttribute("target")).toBe("_blank");
  expect(fireEvent.click(email)).toBe(true);
  expect(fireEvent.click(github)).toBe(true);
  expect(fetchMock).not.toHaveBeenCalled();
});
test("empty contact details still provide useful feedback", () => {
  render(<ProfileContactLinks email="" links={[]} />);
  expect(screen.getAllByRole("status")).toHaveLength(2);
});
