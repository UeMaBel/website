# Static page content

`profile.json` contains the public profile fallback: biography, career, education,
skills and a CV URL. The About/CV page reads the latest profile from the backend
API and uses this snapshot if the request fails. The homepage and other pages
continue to use snapshot fields for their bundled content.

`datenschutz.ts` contains the privacy Markdown from
`docs/datenschutzerklaerung-vorlage.md` at the repository root, excluding its opening
editorial note. Update this bundled text when changing the policy source.

Content changes require a frontend rebuild. Blog posts and projects still use
the backend API. The older contact.md and projects.md are retained as copy drafts.
