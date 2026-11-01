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
npm run build
npm start
```

The home route should return HTTP 200 with the heading "Personal website".
An unknown route such as `/missing` should return HTTP 404. The page uses a
fluid content width and the framework's viewport metadata. No external fonts,
API credentials, or running Django service are needed by this initial shell.
Lint and automated test commands will be added in ticket 28.

## Component boundaries

`app/` owns route composition and metadata. `components/layout/` owns the shared
page container, navigation, and footer. The root layout supplies the single main
landmark and keyboard skip link, including on unknown routes.
`components/content/` owns reusable page headings and labelled content sections.
These are server components; routes can compose them without browser state.

Home, Blog, About/CV, Projects, and Contact currently show explicitly temporary
placeholders. Their content tickets replace these placeholders; no API contract
or fixture content is assumed. Future blog/project details use the same root shell.

Version sources: [Node.js release support](https://nodejs.org/en/about/previous-releases),
[Next.js support policy](https://nextjs.org/support-policy), and the npm registry.
Next.js 16.4.3 includes the fixes described in the
[October security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026).
