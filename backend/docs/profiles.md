# About/CV persistence

The `profiles` app stores one owner's About/CV. `Profile` has a fixed key of 1,
enforced by PostgreSQL, and optional display name, Markdown biography, email,
and uploaded CV reference. An empty profile is valid; the public representation
for both missing and empty profiles is documented in the API contract. Edit the
persisted profile instance; a second record fails validation.

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

## Administration

Open About/CV under `/admin/` as active staff with Profile view/add/change
permissions and the corresponding experience/education/skill/link permissions.
Create the one owner profile, then edit it. The add action disappears after the
profile exists. Biography and entry descriptions are plain Markdown fields.

Edit structured entries inline; lower position numbers appear first and ties
retain primary-key order. Use the inline delete checkbox to remove an entry.
Manage professional contact labels/URLs in the links inline and email on the
profile. Select a PDF previously uploaded through the uploaded-media admin;
images are excluded from CV choices. Clear the CV dropdown to remove the link
while keeping the upload. Changing a PDF upload to an image is rejected by the
media replacement policy.

Repeatable staff drill: create the profile with biography, email, at least one
experience and education entry, two skills and one contact link. Attach a PDF
and save. Reopen, reverse skill position values, edit biography/link label,
clear the CV and save. Reopen to verify every persisted change and the new skill
order. A second profile cannot be added. Ticket 11's HTTP drill performed these
POSTs as a non-superuser staff account, refreshed persisted data after each
save, and rolled back its temporary rows/files.

## Focused regression checks

```sh
uv run --frozen --env-file .env manage.py test tests.test_profiles
```

These tests use isolated PostgreSQL rows and temporary file storage. They verify
persisted biography/contact edits, empty content, ordered experience/education/
skills/links including deterministic ties and reordering, structured dates and
Markdown, optional PDF attachment/removal, protected uploads, rejection of image
or missing CV references, singleton ownership, and invalid contact values.
