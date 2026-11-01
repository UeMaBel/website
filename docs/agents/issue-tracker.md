# Issue tracker: Local Markdown

Specs and issues live in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- Spec: `.scratch/<feature-slug>/spec.md`.
- One file per implementation ticket:
  `.scratch/<feature-slug>/issues/<NN>-<slug>.md`.
- Number tickets from 01 in dependency order.
- Record dependencies in a `Blocked by:` field near the top.
- Record triage state in a `Status:` field near the top.
  Use the roles in `triage-labels.md`.
- Append comments and conversation history under `## Comments`.

## Tracker operations

- Publish: create the corresponding spec or ticket file.
- Fetch: read the referenced file.
- Update: edit that file, preserving its history and unrelated content.

## Wayfinding operations

- Map: `.scratch/<effort>/map.md`.
- Decision tickets: `.scratch/<effort>/issues/<NN>-<slug>.md`.
- Record ticket type in `Type:`:
  research, prototype, grilling, or task.
- Record dependencies in `Blocked by:`.
- Work on open, unblocked, unclaimed tickets in numerical order.
- Claim a ticket by saving `Status: claimed` before starting.
- Resolve it by appending `## Answer` and saving `Status: resolved`.
- Add a summary and link to the map's Decisions-so-far section.
