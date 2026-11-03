# Page introductions

In Django admin, open the existing About/CV profile and paste `contact.md` into **Contact introduction**, and `projects.md` into **Projects introduction**. Both accept Markdown, using the same renderer as biography and project descriptions. Empty fields omit the introduction. Saving updates the pages without rebuilding the frontend.

Deploy the backend migration `profiles/0002_page_introductions.py` before deploying the updated frontend. Run the normal backend `manage.py migrate` command against the intended database. Existing profile content is preserved; the new fields start empty. The profile API returns both fields, including empty strings for a missing profile.
