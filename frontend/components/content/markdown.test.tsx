import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "./markdown";

test("readers can follow links and navigate Markdown headings", () => {
  render(<Markdown source={'## A technical article\n\nRead [the project](/projects/example) or [email](mailto:owner@example.com).'} />);
  expect(screen.getByRole("heading", { level: 2, name: "A technical article" })).toBeDefined();
  expect(screen.getByRole("link", { name: "the project" }).getAttribute("href")).toBe("/projects/example");
  expect(screen.getByRole("link", { name: "email" }).getAttribute("href")).toBe("mailto:owner@example.com");
});

test.each([
  "javascript:alert%281%29",
  "JaVaScRiPt:alert%281%29",
  "java&#x73;cript:alert%281%29",
  "java&#x0A;script:alert%281%29",
  "vbscript:msgbox%281%29",
  "data:text/html;base64,PHNjcmlwdD4=",
  "file:///etc/passwd",
])("unsafe URL %s is not an interactive link", (url) => {
  render(<Markdown source={`[Unsafe destination](${url})`} />);
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByText("Unsafe destination")).toBeDefined();
});

test("raw HTML cannot insert executable elements or event handlers", () => {
  const { container } = render(<Markdown source={'<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n<iframe src="https://example.com"></iframe>'} />);
  expect(container.querySelector("script, img, iframe, [onerror]")).toBeNull();
});

test("unsafe image URLs cannot become active media", () => {
  render(<Markdown source="![A diagram](data:image/svg+xml;base64,PHN2Zz4=)" />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("Image unavailable: A diagram")).toBeDefined();
});

test("empty Markdown renders without fabricated content", () => {
  const { container } = render(<Markdown source="" />);
  expect(container.textContent).toBe("");
});

test("fenced code stays literal in a keyboard accessible scroll region", () => {
  render(<Markdown source={'```html\n<script>alert("example")</script>\n```'} />);
  const code = screen.getByRole("region", { name: "Code example" });
  expect(code.getAttribute("tabindex")).toBe("0");
  expect(code.textContent).toBe('<script>alert("example")</script>\n');
});

test("content images retain descriptive alternative text", () => {
  render(<Markdown source="![Diagram showing a browser calling Django](/media/architecture.png)" />);
  expect(screen.getByRole("img", { name: "Diagram showing a browser calling Django" }).getAttribute("src")).toBe("/media/architecture.png");
});

test("images without descriptive alternative text are omitted with an authoring notice", () => {
  render(<Markdown source="![](/media/architecture.png)" />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.queryByRole("presentation")).toBeNull();
  expect(screen.getByText("Image omitted: descriptive alternative text is required.")).toBeDefined();
});
