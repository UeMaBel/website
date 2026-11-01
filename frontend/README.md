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

Home, Blog, About/CV, Projects, and Contact currently show explicitly temporary
placeholders. Their content tickets replace these placeholders; no API contract
or fixture content is assumed. Future blog/project details use the same root shell.

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

Version sources: [Node.js release support](https://nodejs.org/en/about/previous-releases),
[Next.js support policy](https://nextjs.org/support-policy), and the npm registry.
Next.js 16.4.3 includes the fixes described in the
[October security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026).
