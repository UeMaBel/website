# About/CV persistence

The `profiles` app stores one owner's About/CV. `Profile` has a fixed key of 1,
enforced by PostgreSQL, and optional display name, Markdown biography, email,
and uploaded CV reference. An empty profile is valid; API ticket 21 defines its
public empty state. Edit the persisted profile instance; a second record fails
validation.

CV selection accepts only uploaded PDFs, validated on profile save. Referenced
uploads are protected from deletion. Clearing the optional link retains the file.

Structured records belong to a profile and sort by nonnegative `position`
ascending, then primary key ascending for deterministic ties:

- `Experience`: employer, role, start/end dates, optional Markdown description.
- `Education`: institution, qualification, start/end dates, optional Markdown description.
- `Skill`: name and optional category.
- `ProfileLink`: label and HTTP/HTTPS URL.

Dates allow an empty end date for ongoing entries. PostgreSQL rejects end dates
before start dates. Profile deletion cascades to its structured records; uploads
remain independent. Admin editing follows in ticket 11.

## Persistence drill

Create an empty disposable local PostgreSQL database, override `POSTGRES_DB` in
the shell, and run the documented `manage.py migrate --noinput` command. Ticket
10 used `website_ticket10` and applied all migrations from scratch.

In `manage.py shell`, create a Profile with Markdown biography and email, then
related experience, education, skills and links. Supply different positions,
reload the profile and assert the related managers return the configured order.
Attach an UploadedMedia PDF to `profile.cv`, save/reload, and verify the relation;
clear the CV and verify it is optional. Wrap the drill in `transaction.atomic()`
and call `transaction.set_rollback(True)` to discard sample rows.

Ticket 10's drill used generated PDF bytes, temporary file storage, and rolled
back every sample row. Dedicated regression coverage follows in ticket 12.
Run backend tests, Ruff, migration drift and migration checks afterwards.
