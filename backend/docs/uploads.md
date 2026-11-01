# Uploaded media

Active staff with uploaded-media add/change/view permissions manage files at
`/admin/uploads/uploadedmedia/`. Add a title, file, and descriptive alternative
text for images. PDFs may omit alt text. The derived kind is read-only.
Copy the stored file URL from its admin edit page into Markdown image syntax
with the same descriptive alt text. Rendering and safe public serving are later
tickets; this ticket configures storage and does not expose a media route.

Accepted formats are JPEG (`.jpg`/`.jpeg`), PNG, WebP, and unencrypted PDFs with
at least one page. Pillow verifies/decodes image bytes and requires the detected
format to match the extension. Excessive image pixel counts are rejected.
pypdf parses PDFs in strict mode; file extensions and browser MIME declarations
alone are insufficient. SVG, HTML, corrupt files, and unsupported extensions are
rejected. Validation occurs in admin forms and model saves. This validation is
not a PDF sanitizer; safe PDF serving headers are infrastructure ticket 51.

`DJANGO_UPLOAD_MAX_BYTES` is a positive byte limit, default 10 MiB (10485760).
Empty and oversized files fail with field errors. Images require non-whitespace
alt text; editors must supply a meaningful description. Validation preserves
file position so saved bytes match the upload. Files use UUID names under
`uploads/`, retaining only the supported extension.

`DJANGO_MEDIA_ROOT` selects filesystem storage, default `backend/media/`
(ignored by Git); `DJANGO_MEDIA_URL` defaults to `/media/`. Point the root at a
persistent volume in infrastructure configuration. Existing files are retained
when records are deleted or replaced, preventing accidental deletion of files
still referenced in Markdown; orphan cleanup is an operator task.

Repeatable local staff drill:

1. Apply migrations, create a local active staff account and grant uploaded-media
   view/add/change permissions (or use a local superuser).
2. Upload a small PNG with descriptive alt text and a valid CV PDF without alt.
   Reopen both records and verify the stored files match their original bytes.
3. Repeat the image without alt text, an SVG, a text file renamed `.png`, and a
   file exceeding the configured byte limit. Each must show a form field error
   and create no media record.
4. Set `DJANGO_MEDIA_ROOT` to another local directory and verify uploads land
   there. Restore configuration after the drill.

Ticket 08's HTTP admin drill used a non-superuser staff account, generated PNG
and PDF bytes, temporary storage and rolled-back database rows. Focused regression coverage runs with:

```sh
uv run --frozen --env-file .env manage.py test tests.test_uploads
```

It uses isolated PostgreSQL rows, non-superuser staff permissions, generated
image/PDF fixtures, and per-test temporary storage. Checks cover all supported
image formats, exact stored bytes, PDF uploads without alt text, missing/blank
image alt, malformed/mismatched/unsupported files, empty/encrypted PDFs, exact
size boundaries, invalid replacements, and unauthorized staff uploads.
