"""Seed or verify disposable records for the documented backup restore drill.

Run through Django's shell inside the Compose backend after setting
RESTORE_DRILL_ACTION to ``seed`` or ``verify``. This helper only creates test
records; use a fresh disposable database and remove its Compose volumes when
the drill is complete.
"""

from __future__ import annotations

import io
import json
import os
import secrets

from blog.models import BlogPost, Tag
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.utils import timezone
from PIL import Image
from pypdf import PdfReader, PdfWriter
from uploads.models import UploadedMedia

ADMIN_USERNAME = "restore-drill-admin"
AUTHOR_USERNAME = "restore-drill-author"
POST_SLUG = "restore-drill-post"
IMAGE_TITLE = "Restore drill image"
PDF_TITLE = "Restore drill PDF"


def seed() -> None:
    User = get_user_model()
    if (
        User.objects.filter(username__in=(ADMIN_USERNAME, AUTHOR_USERNAME)).exists()
        or BlogPost.objects.filter(slug=POST_SLUG).exists()
        or UploadedMedia.objects.filter(title__in=(IMAGE_TITLE, PDF_TITLE)).exists()
        or Tag.objects.filter(slug="restore-drill").exists()
    ):
        raise RuntimeError("Restore drill records already exist; use a fresh disposable source project")

    admin = User.objects.create_superuser(
        username=ADMIN_USERNAME,
        email="restore-drill-admin@example.invalid",
        password=secrets.token_urlsafe(32),
    )
    author = User.objects.create_user(
        username=AUTHOR_USERNAME,
        email="restore-drill-author@example.invalid",
        password=secrets.token_urlsafe(32),
    )
    tag = Tag.objects.create(name="Restore drill", slug="restore-drill")
    post = BlogPost(
        title="Backup recovery drill post",
        slug=POST_SLUG,
        author=author,
        body="Representative published content created only for a disposable restore drill.",
        status=BlogPost.Status.PUBLISHED,
        published_at=timezone.now(),
    )
    post.save()
    post.tags.add(tag)

    image_buffer = io.BytesIO()
    Image.new("RGB", (8, 6), color=(22, 91, 164)).save(image_buffer, format="PNG")
    image = UploadedMedia(title=IMAGE_TITLE, alt_text="Blue image used by the restore drill.")
    image.file.save("restore-drill-image.png", ContentFile(image_buffer.getvalue()), save=True)

    pdf_buffer = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    writer.write(pdf_buffer)
    pdf = UploadedMedia(title=PDF_TITLE)
    pdf.file.save("restore-drill-cv.pdf", ContentFile(pdf_buffer.getvalue()), save=True)

    print(json.dumps({"created": True, "users": [admin.username, author.username], "post": post.slug}))


def verify() -> None:
    User = get_user_model()
    admin = User.objects.get(username=ADMIN_USERNAME)
    author = User.objects.get(username=AUTHOR_USERNAME)
    if not admin.is_superuser or author.is_superuser:
        raise AssertionError("Restore drill users did not retain their expected roles")

    post = BlogPost.objects.get(slug=POST_SLUG)
    if post.author_id != author.pk or post.status != BlogPost.Status.PUBLISHED:
        raise AssertionError("Restore drill post or author is missing")
    if list(post.tags.values_list("slug", flat=True)) != ["restore-drill"]:
        raise AssertionError("Restore drill post tag did not persist")

    image = UploadedMedia.objects.get(title=IMAGE_TITLE)
    pdf = UploadedMedia.objects.get(title=PDF_TITLE)
    image_bytes = image.file.read()
    pdf_bytes = pdf.file.read()
    if not image.file.storage.exists(image.file.name) or not image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        raise AssertionError("Restore drill PNG is missing or invalid")
    Image.open(io.BytesIO(image_bytes)).verify()
    if not pdf.file.storage.exists(pdf.file.name) or not pdf_bytes.startswith(b"%PDF-"):
        raise AssertionError("Restore drill PDF is missing or invalid")
    if len(PdfReader(io.BytesIO(pdf_bytes), strict=True).pages) < 1:
        raise AssertionError("Restore drill PDF has no pages")

    print(
        json.dumps(
            {
                "verified": True,
                "users": [admin.username, author.username],
                "post": post.slug,
                "image_url": image.file.url,
                "image_bytes": len(image_bytes),
                "pdf_url": pdf.file.url,
                "pdf_bytes": len(pdf_bytes),
            }
        )
    )


action = os.environ.get("RESTORE_DRILL_ACTION", "").strip().lower()
if action == "seed":
    seed()
elif action == "verify":
    verify()
else:
    raise RuntimeError("Set RESTORE_DRILL_ACTION to 'seed' or 'verify'")
