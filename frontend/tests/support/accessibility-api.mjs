import { createServer } from "node:http";

const origin = "http://127.0.0.1:3211";
const tags = [{ slug: "accessibility", name: "Accessibility", post_count: 1 }];
const post = {
  slug: "accessible-article",
  title: "Accessible article",
  published_at: "2026-10-30T12:00:00Z",
  author: { username: "site-owner", name: "Site Owner" },
  tags: [{ slug: "accessibility", name: "Accessibility" }],
  body: [
    "## Article content",
    "",
    "This article includes a [descriptive link](https://example.test/article).",
    "",
    `![A blue square used to test image alternative text](${origin}/media/blue.svg)`,
    "",
    "```text",
    `${"A long technical line for checking horizontal code scrolling. ".repeat(5)}`,
    "```",
  ].join("\n"),
};
const project = {
  slug: "accessible-project",
  title: "Accessible project",
  problem: "Readers needed a **clear** workflow.",
  contribution: "I built a responsive service.",
  technologies: ["Django", "PostgreSQL"],
  description: "A detail section with useful project information.",
  repository_url: "https://example.test/repository",
  demo_url: "https://example.test/demo",
  images: [{
    position: 0,
    url: `${origin}/media/project.svg`,
    alt_text: "A blue square illustrating the accessible project",
  }],
};
const profile = {
  display_name: "Site Owner",
  biography: "Independent software engineer focused on useful AI systems.",
  email: "owner@example.test",
  cv_url: `${origin}/media/cv.pdf`,
  experience: [{
    position: 0,
    employer: "Example Studio",
    role: "Software Engineer",
    start_date: "2022-01-01",
    end_date: null,
    description: "Built accessible software.",
  }],
  education: [{
    position: 0,
    institution: "Example University",
    qualification: "Computer Science",
    start_date: "2018-09-01",
    end_date: "2021-06-01",
    description: "Studied software engineering.",
  }],
  skills: [{ position: 0, name: "Python", category: "Programming" }],
  links: [{ position: 0, label: "Professional profile", url: "https://example.test/profile" }],
};

const image = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#24553c"/></svg>',
);
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", origin);
  if (url.pathname === "/health") {
    response.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  if (url.pathname.startsWith("/media/")) {
    response.writeHead(200, {
      "content-type": url.pathname.endsWith(".pdf") ? "application/pdf" : "image/svg+xml",
      "cache-control": "no-store",
    }).end(url.pathname.endsWith(".pdf") ? "%PDF-1.4 accessibility fixture" : image);
    return;
  }

  let body;
  if (url.pathname === "/api/v1/profile/") body = profile;
  else if (url.pathname === "/api/v1/blog/tags/") body = { count: tags.length, results: tags };
  else if (url.pathname === "/api/v1/blog/posts/") {
    body = { count: 1, next: null, previous: null, results: [post] };
  } else if (url.pathname === "/api/v1/blog/posts/accessible-article/") body = post;
  else if (url.pathname === "/api/v1/projects/") body = { count: 1, results: [project] };
  else if (url.pathname === "/api/v1/projects/accessible-project/") body = project;
  else {
    response.writeHead(404, { "content-type": "application/json" }).end('{"detail":"Not found."}');
    return;
  }
  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  }).end(JSON.stringify(body));
});

server.listen(3211, "127.0.0.1");
