import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const publicPages = [
  { path: "/", name: "home" },
  { path: "/about", name: "About and CV" },
  { path: "/blog", name: "blog listing" },
  { path: "/blog?tag=accessibility", name: "tag-filtered blog listing" },
  { path: "/blog/accessible-article", name: "blog article" },
  { path: "/projects", name: "project listing" },
  { path: "/projects/accessible-project", name: "project detail" },
  { path: "/contact", name: "contact" },
  { path: "/missing-public-page", name: "not found" },
];

async function loadPage(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "networkidle" });
  expect(response, `navigation to ${path}`).not.toBeNull();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.locator("main h1")).toHaveCount(1);
}

test("public pages have no axe WCAG 2.2 AA violations or unnamed controls", async ({ page }) => {
  for (const route of publicPages) {
    await loadPage(page, route.path);
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);

    const unnamedControls = await page.locator("a, button, input, select, textarea, [role='button']")
      .evaluateAll((controls) => controls.flatMap((element) => {
        const control = element as HTMLElement;
        const name = control.getAttribute("aria-label")
          ?? control.getAttribute("aria-labelledby")
          ?? control.textContent
          ?? (control as HTMLInputElement).labels?.[0]?.textContent
          ?? "";
        return name.trim() ? [] : [control.outerHTML];
      }));
    expect(unnamedControls, `${route.name} has unnamed interactive controls`).toEqual([]);

    const imageAlt = await page.locator("main img").evaluateAll((images) =>
      images.map((image) => (image as HTMLImageElement).alt.trim()),
    );
    expect(imageAlt, `${route.name} image alt text`).not.toContain("");

    const headings = await page.locator("main h1, main h2, main h3, main h4, main h5, main h6")
      .evaluateAll((elements) => elements.map((element) => Number(element.tagName.slice(1))));
    expect(headings.filter((level, index) => index > 0 && level > headings[index - 1] + 1),
      `${route.name} heading levels do not skip`).toEqual([]);

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations, `${route.name} axe violations`).toEqual([]);
  }
});

test("public pages reflow without horizontal overflow at mobile, tablet, and desktop widths", async ({ page }) => {
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of publicPages) {
      await loadPage(page, route.path);
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      expect(dimensions.document, `${route.name} document width at ${width}px`).toBeLessThanOrEqual(width);
      expect(dimensions.body, `${route.name} body width at ${width}px`).toBeLessThanOrEqual(width);
      expect(dimensions.viewport).toBe(width);
    }
  }
});

test("skip link, keyboard focus, code scrolling, and enlarged text work at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await loadPage(page, "/");
  await page.keyboard.press("Tab");
  const skipFocus = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement;
    const style = getComputedStyle(active);
    return {
      href: active.getAttribute("href"),
      visible: active.getBoundingClientRect().top >= 0,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineStyle: style.outlineStyle,
    };
  });
  expect(skipFocus.href).toBe("#main-content");
  expect(skipFocus.visible).toBe(true);
  expect(skipFocus.outlineStyle).toBe("solid");
  expect(skipFocus.outlineWidth).toBeGreaterThanOrEqual(3);

  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("main-content");
  await page.keyboard.press("Tab");
  const navigationFocus = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement;
    const style = getComputedStyle(active);
    return {
      isLink: active.tagName === "A",
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineStyle: style.outlineStyle,
    };
  });
  expect(navigationFocus.isLink).toBe(true);
  expect(navigationFocus.outlineStyle).toBe("solid");
  expect(navigationFocus.outlineWidth).toBeGreaterThanOrEqual(3);

  await loadPage(page, "/blog/accessible-article");
  const code = page.locator("pre").first();
  await expect(code).toHaveAttribute("role", "region");
  await expect(code).toHaveAttribute("aria-label", "Code example");
  const codeLayout = await code.evaluate((element) => ({
    overflowX: getComputedStyle(element).overflowX,
    contentWidth: element.scrollWidth,
    visibleWidth: element.clientWidth,
  }));
  expect(codeLayout.overflowX).toBe("auto");
  expect(codeLayout.contentWidth).toBeGreaterThan(codeLayout.visibleWidth);

  for (const route of publicPages) {
    await loadPage(page, route.path);
    await page.addStyleTag({ content: ":root { font-size: 200% !important; }" });
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, `${route.name} reflow at 200% text`).toBeLessThanOrEqual(320);
  }
});
