# Local live-content drill

This drill verifies that Django admin content changes reach the local Next.js
site through the shared Caddy proxy without rebuilding the frontend. It uses a
fresh Compose project, loopback-only HTTP port, throwaway environment values,
and isolated named volumes. Never substitute a production environment file or
production data.

## Run the isolated stack

Create a temporary environment file outside the repository with a newly
generated `DJANGO_SECRET_KEY` and `POSTGRES_PASSWORD`, plus:

```dotenv
POSTGRES_DB=website
POSTGRES_USER=website
PROXY_PORT=3166
PUBLIC_SITE_ORIGIN=http://localhost:3166
```

Use a unique Compose project name. These are the commands used for the
`website-ticket66-drill` run:

```powershell
docker compose --project-name website-ticket66-drill --env-file $env:TEMP\website-ticket66.env --file compose.yaml config --quiet
docker compose --project-name website-ticket66-drill --env-file $env:TEMP\website-ticket66.env --file compose.yaml up --build --detach --wait --wait-timeout 300
docker compose --project-name website-ticket66-drill --env-file $env:TEMP\website-ticket66.env --file compose.yaml ps
docker compose --project-name website-ticket66-drill --env-file $env:TEMP\website-ticket66.env --file compose.yaml exec backend python manage.py migrate --check
docker compose --project-name website-ticket66-drill --env-file $env:TEMP\website-ticket66.env --file compose.yaml exec backend python manage.py createsuperuser
```

Open `http://localhost:3166/admin/` and create content using the admin:

1. Add a Blog post as a draft. Open **Preview draft** from its change form.
   Confirm an authenticated staff session can preview it and an anonymous
   session cannot. The public API detail must return 404 and the post must not
   appear in the public listing.
2. Publish the post from the Blog posts list action. Confirm its public detail
   appears. Edit its body and title, change its slug, and save. The new slug
   should appear immediately; the old API URL should return 301 to the latest
   slug, and the old website URL should finish at the latest page.
3. Add an image in **Uploaded media** with descriptive alt text and a PDF CV
   without alt text. Attach the CV in **About/CV** and verify the public profile
   returns its `/media/...pdf` URL. Confirm the media endpoints work through
   `http://localhost:3166/media/`.
4. Add a project with the uploaded image using the project image inline. Edit
   its title or description. Confirm the public project API and rendered page
   update while the frontend container stays running and is not rebuilt.
5. Restart only backend and proxy. Confirm the profile, project, image, CV,
   published article, and health endpoint still respond.

Useful direct checks (replace slugs and media paths with values shown by the
admin and API):

```sh
curl -i http://localhost:3166/api/v1/blog/posts/ticket66-private-draft/
curl -i http://localhost:3166/api/v1/blog/posts/ticket66-private-draft/preview/
curl -i http://localhost:3166/api/v1/blog/posts/ticket66-content-drill/
curl -fsS http://localhost:3166/api/v1/blog/posts/ticket66-content-drill-updated/
curl -fsS http://localhost:3166/api/v1/profile/
curl -fsS http://localhost:3166/api/v1/projects/ticket66-local-project/
curl -fsSI http://localhost:3166/media/uploads/<uploaded-image>.png
curl -fsSI http://localhost:3166/media/uploads/<uploaded-cv>.pdf
```

The PDF response should include `Content-Disposition: attachment` and media
responses should include `X-Content-Type-Options: nosniff`. A non-image file
named with a `.png` suffix should be rejected by Django's upload validation.

## Results from the ticket66 run

The isolated stack built and became healthy. Admin login, draft creation,
publication, edits, and uploads were performed through Caddy on loopback port
3166. A local superuser was created only in the disposable database.

- Draft public detail returned 404; anonymous draft-preview API returned 401
  and the frontend preview page returned 404. The authenticated staff preview
  API and page returned 200. The public listing contained only the published
  post.
- Publishing made the post available through the public API and page. Admin
  edits to title/body were visible without rebuilding or restarting the
  frontend. Changing the slug made the old detail API return 301 to the new
  slug; following the old page URL reached the updated page.
- A malformed PNG was rejected. A valid PNG and one-page PDF were accepted
  through Uploaded media. The PNG and PDF returned 200 through Caddy with
  `nosniff`; the PDF was served as an attachment. The profile API/page exposed
  the CV at a browser-visible `/media/...pdf` path.
- Project create/edit and public API/page updates succeeded without a frontend
  rebuild. The first run exposed a frontend bug: project HTML resolved a
  relative API media URL against private `BACKEND_API_URL`, producing an
  `http://backend:8000/media/...` image URL that did not resolve from the
  browser host. Ticket66 now resolves validated `/media/...` URLs against
  `PUBLIC_SITE_ORIGIN` and renders the same-origin relative path. The project
  API, rendered image URL, and file served by Caddy then returned the expected
  values; the HTML no longer contains `backend:8000/media`.
- Restarting only backend and proxy left the stack healthy; the profile,
  project, image, CV, and health endpoint all returned 200. Migrations were
  applied (`migrate --check` exited successfully). The frontend was not rebuilt
  during any content operation.

The frontend regression test verifies project images use the same-origin
media path. Checks passed with Node 24.22.2 in the cached frontend development
image:

```sh
docker build --target development --tag website-ticket66-frontend-check frontend
docker run --rm website-ticket66-frontend-check npm test
docker run --rm website-ticket66-frontend-check npm run lint
docker run --rm website-ticket66-frontend-check npm run typecheck
```

The test run passed 8 files and 71 tests. The local Compose production image
build also passed. Host `npm` checks passed too, though host Node 24.12.0
emitted the expected engine-version warning; the project-pinned Node 24.22.2
checks above are the authoritative frontend results.

## Recovery and cleanup

This project name is isolated from other Compose projects. Verify that the
listed containers use the exact `website-ticket66-drill` prefix before cleanup:

```powershell
docker compose --project-name website-ticket66-drill --env-file $env:TEMP\website-ticket66.env --file compose.yaml ps -a
```

After confirming the project name, remove only its containers and disposable
database/media/static volumes:

```powershell
docker compose --project-name website-ticket66-drill --env-file $env:TEMP\website-ticket66.env --file compose.yaml down --volumes --remove-orphans
```

Then delete the temporary environment file and local response/upload fixture
files prefixed `ticket66-` from `%TEMP%`. Do not remove shared images or any
other Compose project's containers or volumes. If a drill fails before
cleanup, inspect only this project's services with the same `--project-name`,
then run the same `down --volumes --remove-orphans` command after confirming
the project identifier.
