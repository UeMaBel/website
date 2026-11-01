# Frontend development

Use Node.js **24.22.2** (LTS), pinned in `.nvmrc` and `package.json`, with
npm **11.6.2**. With nvm installed, run `nvm install` and `nvm use` in this
directory. Dependencies are pinned exactly; commit `package-lock.json` updates
when intentionally upgrading them.

From `frontend/`:

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:3000>. Stop the development server with Ctrl+C.
The minimal home page renders on the server without backend configuration.

## Container image

Build and run the standalone production image from `frontend/`:

```sh
docker build --target production -t personal-website-frontend:local .
docker run --rm --name personal-website-frontend \
  --publish 127.0.0.1:3000:3000 \
  --env BACKEND_API_URL=http://backend:8000 \
  --env PUBLIC_SITE_ORIGIN=https://www.example.test \
  personal-website-frontend:local
```

With the container running, verify server rendering and the 404 response:

```sh
curl -fsS http://127.0.0.1:3000/ | grep -F "Personal website"
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/missing
```

For a known published slug, request `/blog/<slug>` and confirm its canonical
and Open Graph URLs use the configured `PUBLIC_SITE_ORIGIN`.

`BACKEND_API_URL` is the internal Django server origin used for server-side API
requests. `PUBLIC_SITE_ORIGIN` is the public website origin used for runtime
metadata. They are independent runtime settings; neither is baked into the
image, and neither needs credentials. The default public origin is
`http://127.0.0.1:3000`. Set `BACKEND_API_URL` explicitly when running in a
container because `127.0.0.1` inside the frontend container refers to that
container. The image serves SSR on port 3000 as an unprivileged user and has a
backend-independent `robots.txt` health check.

To run the development target with hot reload, build and start it from this
directory:

```sh
docker build --target development -t personal-website-frontend:dev .
docker run --rm --name personal-website-frontend-dev \
  --publish 127.0.0.1:3000:3000 \
  --mount type=bind,source="$(pwd)",target=/app \
  --mount type=volume,target=/app/node_modules \
  --mount type=volume,target=/app/.next \
  --env BACKEND_API_URL=http://host.docker.internal:8000 \
  --env PUBLIC_SITE_ORIGIN=http://127.0.0.1:3000 \
  personal-website-frontend:dev
```

Open <http://127.0.0.1:3000>. On Linux, add
`--add-host=host.docker.internal:host-gateway` if the backend runs on the host.

Verify and run the production build locally:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

The home route should return HTTP 200 with the heading "Personal website".
An unknown route such as `/missing` should return HTTP 404. The page uses a
fluid content width and the framework's viewport metadata. No external fonts,
API credentials, or running Django service are needed by this initial shell.

`npm test` runs once and exits unsuccessfully if tests fail or no tests are found.
`npm run test:watch` is the interactive development mode. Tests are colocated as
`*.test.tsx` beside components; `tests/setup.ts` cleans the DOM after each test.
The navigation smoke test verifies accessible link names and destinations without
mocking the navigation component. Vitest with jsdom covers synchronous components;
async server components and real browser journeys require integration checks.

Lint uses Biome's recommended rules and fails on warnings.
Typecheck generates Next.js route types first, so it also works before a build.
Generated output, dependencies, and coverage are excluded from lint checks.
These commands follow the official [Biome setup](https://biomejs.dev/guides/getting-started/)
and [Vitest setup](https://nextjs.org/docs/app/guides/testing/vitest).
Biome is one of the linters supported by the [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation).
It supports the pinned TypeScript compiler without ESLint parser peer overrides.

## Component boundaries

`app/` owns route composition and metadata. `components/layout/` owns the shared
page container, navigation, and footer. The root layout supplies the single main
landmark and keyboard skip link, including on unknown routes.
`components/content/` owns reusable page headings and labelled content sections.
These are server components; routes can compose them without browser state.

The Blog route reads published posts, authors, and dates from the backend and
uses query-string pagination. It shows separate empty, unavailable, and
out-of-range page states. The About/CV route reads the profile API, renders
ordered biography and career sections, and links an optional CV. Home, Projects,
and Contact still show explicitly temporary placeholders. The blog detail route
is implemented by its own content ticket.

## Layout verification

The shared shell uses system fonts, a restrained light palette, and a 48rem content
container. Navigation wraps into visible rows on mobile with at least 44px touch
targets; it does not require JavaScript to expose links. Headings and spacing scale
with the viewport. Long links wrap; code blocks scroll within the content column.

For a browser smoke check, run the production server and visit the public routes
at 320px, 768px, and 1440px widths, plus `/missing` for the 404 shell. Confirm no
horizontal page overflow. Tab from the top: the visible skip link should be first;
Enter moves focus to main content. Tab through navigation links and confirm a
visible outline. Repeat at a narrow viewport with enlarged text. In browser devtools,
check a long code line scrolls inside its block rather than widening the page.

For a repeatable browser audit, run `npm run build`, then
`npm run test:a11y`. The test starts the built standalone server with controlled
API fixtures and checks public routes with axe, keyboard focus, image text,
code overflow, 320/768/1440px viewports, and 200% text enlargement. Playwright's
bundled Chromium can be installed with `npx playwright install chromium`; set
`CHROME_BIN` to an existing Chromium/Chrome executable to use that browser
instead. See [`../docs/accessibility-responsive-review.md`](../docs/accessibility-responsive-review.md)
for the recorded review and results.

## Markdown content

Compose `<Markdown source={body} />` from `components/content/markdown.tsx` in
server-rendered content routes. It supports CommonMark headings, links, images,
inline code, and fenced code. Code regions are named and keyboard focusable; the
shared stylesheet keeps wide lines inside a horizontally scrollable block.

Raw HTML is skipped. The renderer retains `react-markdown`'s default safe URL
transform and does not load raw-HTML or HTML-generating plugins. Unsafe URL
schemes produce no active link or media. Images must have nonblank descriptive
alt text (`![Description](/media/image.png)`); otherwise a visible authoring notice
replaces the image. Blocked image URLs show their alt text as unavailable content.
Uploaded images use native lazy-loaded images because Markdown has no intrinsic
dimensions; uploaded-media safety is enforced by the backend/proxy tickets.

The focused renderer tests cover supported content, literal fenced code, raw HTML,
executable/obfuscated URL schemes, missing alt text, blocked images, and empty input.
Security defaults follow the [react-markdown security guidance](https://github.com/remarkjs/react-markdown#security).
Do not replace its URL transform with an identity function or enable raw HTML.

## Server-side API client

`lib/api.ts` is server-only and provides typed requests for blog posts, tags,
the public profile, and projects. Set `BACKEND_API_URL` to the Django server
origin; it defaults to `http://127.0.0.1:8000` for local development. In a
container stack, configure the internal Django service URL. Do not prefix this
variable with `NEXT_PUBLIC_`.

All requests use the versioned `/api/v1/` routes and `cache: "no-store"` so
content edits appear without a frontend rebuild or application cache. Requests
time out after five seconds. Failures reject with `ApiError`, whose `code` is
one of `configuration`, `http`, `invalid_response`, `network`, or `timeout`;
HTTP errors also include the response `status` when available. Backend response
details and network exception messages are not exposed to callers.

The TypeScript response types follow [the backend API contract](../backend/docs/api.md):
blog listings return `Page<BlogPostSummary>`, blog detail adds Markdown `body`,
tags return a counted collection, profile returns the fixed About/CV fields,
and projects return a collection or one project. Markdown fields remain source
text for the safe renderer. A 404 remains an `ApiError` with `code === "http"`
and `status === 404`, allowing a server page to map missing content to a 404.

## Search and sharing metadata

Public routes provide canonical URLs, descriptions, and Open Graph/Twitter
metadata. Set `PUBLIC_SITE_ORIGIN` to the deployed website's absolute HTTP(S) origin so
canonical links and `sitemap.xml` use the public host. It defaults to
`http://127.0.0.1:3000` for local development. The sitemap reads only published
blog listings and public projects; draft preview URLs are excluded and
`robots.txt` disallows crawling them.

Version sources: [Node.js release support](https://nodejs.org/en/about/previous-releases),
[Next.js support policy](https://nextjs.org/support-policy), and the npm registry.
Next.js 16.4.3 includes the fixes described in the
[October security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026).
