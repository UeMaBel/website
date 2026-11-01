import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ProfileContactLinks } from "./profile-contact-links";

afterEach(() => {
  delete window.umami;
});

test("tracks contact and professional profile categories without forwarding link details", () => {
  const track = vi.fn().mockResolvedValue(undefined);
  window.umami = { getSession: () => ({ website: "synthetic-website" }), track };

  render(<ProfileContactLinks
    email="owner@example.test"
    links={[{
      position: 0,
      label: "Professional profile",
      url: "https://social.example.test/person/owner",
    }]}
  />);

  const emailLink = screen.getByRole("link", { name: "owner@example.test" });
  const profileLink = screen.getByRole("link", { name: "Professional profile" });
  expect(emailLink.getAttribute("href")).toBe("mailto:owner@example.test");
  expect(profileLink.getAttribute("href")).toBe("https://social.example.test/person/owner");
  expect(profileLink.getAttribute("target")).toBe("_blank");

  expect(fireEvent.click(emailLink)).toBe(true);
  expect(fireEvent.click(profileLink)).toBe(true);
  expect(track).toHaveBeenNthCalledWith(1, expect.objectContaining({
    name: "outbound_interest",
    data: { category: "contact_email" },
  }));
  expect(track).toHaveBeenNthCalledWith(2, expect.objectContaining({
    name: "outbound_interest",
    data: { category: "contact_profile" },
  }));
  expect(JSON.stringify(track.mock.calls)).not.toContain("owner@example.test");
  expect(JSON.stringify(track.mock.calls)).not.toContain("social.example.test");
  expect(JSON.stringify(track.mock.calls)).not.toContain("Professional profile");
});

test("keeps the email link usable when analytics rejects", async () => {
  const track = vi.fn().mockRejectedValue(new Error("analytics offline"));
  window.umami = { getSession: () => ({ website: "synthetic-website" }), track };
  render(<ProfileContactLinks email="owner@example.test" links={[]} />);

  const emailLink = screen.getByRole("link", { name: "owner@example.test" });
  expect(fireEvent.click(emailLink)).toBe(true);
  expect(emailLink.getAttribute("href")).toBe("mailto:owner@example.test");
  await Promise.resolve();
  expect(track).toHaveBeenCalledWith(expect.objectContaining({
    name: "outbound_interest",
    data: { category: "contact_email" },
  }));
});
