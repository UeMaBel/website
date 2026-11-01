import io
import tempfile

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from pypdf import PdfWriter

from uploads.models import UploadedMedia


class MediaUploadTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.staff = get_user_model().objects.create_user(username='media-editor', is_staff=True)
        cls.staff.user_permissions.set(Permission.objects.filter(content_type__app_label='uploads'))

    def setUp(self):
        storage = tempfile.TemporaryDirectory()
        self.addCleanup(storage.cleanup)
        settings = override_settings(MEDIA_ROOT=storage.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.client.force_login(self.staff)

    def image_bytes(self, format='PNG'):
        stream = io.BytesIO()
        Image.new('RGB', (3, 2), 'red').save(stream, format=format)
        return stream.getvalue()

    def pdf_bytes(self, pages=1, encrypted=False):
        writer = PdfWriter()
        for _ in range(pages):
            writer.add_blank_page(width=100, height=100)
        if encrypted:
            writer.encrypt('test-only-password')
        stream = io.BytesIO()
        writer.write(stream)
        return stream.getvalue()

    def upload(self, filename, content, alt='Red rectangle'):
        return self.client.post('/admin/uploads/uploadedmedia/add/', {
            'title': filename, 'file': SimpleUploadedFile(filename, content),
            'alt_text': alt, '_save': 'Save',
        })

    def assert_rejected(self, filename, content, field='file', alt='Red rectangle'):
        count = UploadedMedia.objects.count()
        response = self.upload(filename, content, alt)
        self.assertEqual(response.status_code, 200)
        self.assertIn(field, response.context['adminform'].form.errors)
        self.assertEqual(UploadedMedia.objects.count(), count)

    def test_supported_image_formats_persist_original_bytes_and_alt(self):
        for suffix, format in (('jpg', 'JPEG'), ('jpeg', 'JPEG'), ('png', 'PNG'), ('webp', 'WEBP')):
            with self.subTest(format=format, suffix=suffix):
                name = f'rectangle.{suffix}'
                content = self.image_bytes(format)
                response = self.upload(name, content)
                self.assertEqual(response.status_code, 302)
                saved = UploadedMedia.objects.get(title=name)
                self.assertEqual(saved.kind, 'image')
                self.assertEqual(saved.alt_text, 'Red rectangle')
                self.assertNotIn('rectangle', saved.file.name)
                with saved.file.open('rb') as stored:
                    self.assertEqual(stored.read(), content)

    def test_valid_cv_pdf_needs_no_image_alt_text(self):
        content = self.pdf_bytes()
        response = self.upload('cv.pdf', content, alt='')
        self.assertEqual(response.status_code, 302)
        saved = UploadedMedia.objects.get(title='cv.pdf')
        self.assertEqual(saved.kind, 'pdf')
        with saved.file.open('rb') as stored:
            self.assertEqual(stored.read(), content)

    def test_images_require_non_whitespace_alt_text(self):
        for alt in ('', '   ', '\t\n'):
            with self.subTest(alt=alt):
                self.assert_rejected('missing-alt.png', self.image_bytes(), field='alt_text', alt=alt)

    def test_unsupported_corrupt_and_mislabeled_files_fail_with_field_errors(self):
        for filename, content in (
            ('script.svg', b'<svg onload="alert(1)"/>'),
            ('text.txt', b'not supported'),
            ('fake.png', b'<html>not an image</html>'),
            ('mismatch.jpg', self.image_bytes('PNG')),
            ('truncated.png', self.image_bytes()[:30]),
            ('fake.pdf', b'%PDF-1.7\nnot a valid PDF\n%%EOF'),
            ('empty.pdf', self.pdf_bytes(pages=0)),
            ('encrypted.pdf', self.pdf_bytes(encrypted=True)),
        ):
            with self.subTest(filename=filename):
                self.assert_rejected(filename, content)

    def test_size_limit_includes_boundary_but_rejects_larger_or_empty_files(self):
        content = self.image_bytes()
        with override_settings(UPLOAD_MAX_BYTES=len(content)):
            self.assertEqual(self.upload('boundary.png', content).status_code, 302)
        with override_settings(UPLOAD_MAX_BYTES=len(content) - 1):
            self.assert_rejected('oversized.png', content)
        self.assert_rejected('empty.png', b'')

    def test_invalid_replacement_retains_original_file(self):
        original = self.image_bytes()
        self.upload('original.png', original)
        saved = UploadedMedia.objects.get(title='original.png')
        response = self.client.post(f'/admin/uploads/uploadedmedia/{saved.pk}/change/', {
            'title': saved.title, 'file': SimpleUploadedFile('fake.png', b'invalid'),
            'alt_text': saved.alt_text, '_save': 'Save',
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn('file', response.context['adminform'].form.errors)
        saved.refresh_from_db()
        with saved.file.open('rb') as stored:
            self.assertEqual(stored.read(), original)

    def test_staff_without_model_permissions_cannot_upload(self):
        staff = get_user_model().objects.create_user(username='no-permissions', is_staff=True)
        self.client.force_login(staff)
        self.assertEqual(self.upload('forbidden.png', self.image_bytes()).status_code, 403)
        self.assertFalse(UploadedMedia.objects.exists())

    def test_kind_changing_replacement_is_rejected_and_preserves_cv_reference(self):
        from profiles.models import Profile

        self.upload('cv.pdf', self.pdf_bytes(), alt='')
        cv = UploadedMedia.objects.get(title='cv.pdf')
        profile = Profile.objects.create(cv=cv)
        self.upload('image.png', self.image_bytes())
        image = UploadedMedia.objects.get(title='image.png')
        for media, filename, content in (
            (cv, 'replacement.png', self.image_bytes()),
            (image, 'replacement.pdf', self.pdf_bytes()),
        ):
            with self.subTest(original_kind=media.kind):
                original_name = media.file.name
                response = self.client.post(f'/admin/uploads/uploadedmedia/{media.pk}/change/', {
                    'title': media.title, 'file': SimpleUploadedFile(filename, content),
                    'alt_text': 'Replacement description', '_save': 'Save',
                })
                self.assertEqual(response.status_code, 200)
                self.assertIn('file', response.context['adminform'].form.errors)
                media.refresh_from_db()
                self.assertEqual(media.file.name, original_name)
        profile.refresh_from_db()
        self.assertEqual(profile.cv.kind, 'pdf')

    def test_same_kind_replacement_remains_allowed(self):
        for filename, original, replacement_name, replacement in (
            ('same.pdf', self.pdf_bytes(), 'new.pdf', self.pdf_bytes(pages=2)),
            ('same.png', self.image_bytes(), 'new.jpg', self.image_bytes('JPEG')),
        ):
            with self.subTest(filename=filename):
                self.upload(filename, original)
                media = UploadedMedia.objects.get(title=filename)
                response = self.client.post(f'/admin/uploads/uploadedmedia/{media.pk}/change/', {
                    'title': media.title, 'file': SimpleUploadedFile(replacement_name, replacement),
                    'alt_text': 'Updated description', '_save': 'Save',
                })
                self.assertEqual(response.status_code, 302)
                media.refresh_from_db()
                with media.file.open('rb') as stored:
                    self.assertEqual(stored.read(), replacement)
