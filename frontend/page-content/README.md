# Static page content

`profile.json` contains the current public profile snapshot: biography, career,
education, skills, contact card, Impressum and project introduction. Pages import
it directly; editing the database no longer changes this content. The existing
profile fields and records remain in the database for now.

`datenschutz.ts` contains the privacy Markdown from
`docs/datenschutzerklaerung-vorlage.md` at the repository root, excluding its opening
editorial note. Update this bundled text when changing the policy source.

Content changes require a frontend rebuild. Blog posts and projects still use
the backend API. The older contact.md and projects.md are retained as copy drafts.
