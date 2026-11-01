# Accessibility and responsive review

The repeatable browser checks live in `frontend/a11y/accessibility.pw.ts`.
They run against the production standalone build and a controlled API fixture
from `frontend/tests/support/accessibility-api.mjs`; no public backend or real
content is needed. The test setup copies `.next/static` into the standalone
output, matching the production image's static-asset layout.

## Run the review

From `frontend/`, install the lockfile dependencies, build, and run the browser
suite. Use Playwright's Chromium or provide an installed Chrome/Chromium binary:

```sh
npm ci
npm run build
npx playwright install chromium
npm run test:a11y
```

For an existing browser, set `CHROME_BIN` to its executable path before the
last command. The suite starts and stops the fixture API and production server
itself. Failure traces are saved under `frontend/test-results/` and are
gitignored.

## What it checks

- All nine public routes: home, About/CV, blog, tag-filtered blog, article,
  projects, project detail, contact, and the not-found page.
- Axe WCAG 2.0/2.1/2.2 A and AA rules, including text contrast, accessible names,
  landmarks, and target size; each route also checks one `main`, one `h1`, no
  skipped heading levels, named controls, and non-empty image alt text.
- Keyboard operation from the document start: the skip link receives the first
  Tab, Enter moves focus to the main landmark, and the next navigation link has
  a visible three-pixel outline.
- No horizontal document/body overflow at 320, 768, or 1440 CSS pixels on each
  route, plus no overflow with root text enlarged to 200% at the 320-pixel
  viewport.
- Article code remains inside a keyboard-focusable, named region that scrolls
  horizontally at the narrow viewport.

## Review result

On 2026-11-01, the Chrome browser suite passed all three tests: zero axe
violations across the nine routes, no horizontal overflow in the 27 route and
viewport combinations, and passing keyboard, 200% text, and long-code checks.
Images on the article and project pages had descriptive alternative text.

The audit found that the CV link's `aria-label` excluded the visible
“Download CV (PDF)” text. The explicit label was removed so the visible text is
the accessible name; the component assertion now checks that same name. After
the fix, the full axe audit passed on every public route. No other page changes
were needed.

The check ran with Node 24.12.0 and Chrome installed on the Windows host. The
package declares Node 24.22.2, so npm printed an engine warning; the production
build, lint, typecheck, component suite, and browser suite all completed
successfully with this environment.
