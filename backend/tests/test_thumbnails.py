import io
import tempfile

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image

from blog.models import BlogPost
from projects.models import Project
from uploads.models import UploadedMedia


class ThumbnailTests(TestCase):
    def setUp(self):
        storage = tempfile.TemporaryDirectory()
        self.addCleanup(storage.cleanup)
        self.enterContext(override_settings(MEDIA_ROOT=storage.name))
        stream = io.BytesIO()
        Image.new('RGB', (8, 8), 'blue').save(stream, format='PNG')
        self.image = UploadedMedia.objects.create(
            title='Cover', alt_text='Blue cover',
            file=SimpleUploadedFile('cover.png', stream.getvalue()),
        )
        self.project = Project.objects.create(
            title='Example', slug='example', problem='Problem', contribution='Work',
            technologies=['Python'],
        )
        self.post = BlogPost.objects.create(
            title='Example', slug='example', body='Body',
            author=get_user_model().objects.create_user(username='author'),
            status='published', published_at=timezone.now(),
        )

    def test_optional_thumbnail_and_uploaded_image_in_list_and_detail(self):
        for obj, endpoint in [(self.project, 'projects'), (self.post, 'blog/posts')]:
            path = f'/api/v1/{endpoint}/'
            self.assertIsNone(self.client.get(path, HTTP_HOST='localhost').json()['results'][0]['thumbnail'])
            obj.thumbnail = self.image
            obj.full_clean()
            obj.save()
            expected = {'url': self.image.file.url, 'alt_text': 'Blue cover'}
            self.assertEqual(self.client.get(path, HTTP_HOST='localhost').json()['results'][0]['thumbnail'], expected)
            self.assertEqual(self.client.get(path + 'example/', HTTP_HOST='localhost').json()['thumbnail'], expected)

    def test_non_image_is_rejected_and_deleting_image_clears_thumbnail(self):
        for obj in (self.project, self.post):
            obj.thumbnail = self.image
            obj.save()
        UploadedMedia.objects.filter(pk=self.image.pk).update(kind='pdf')
        for obj in (self.project, self.post):
            with self.assertRaises(ValidationError):
                obj.full_clean()
        self.image.delete()
        for obj in (self.project, self.post):
            obj.refresh_from_db()
            self.assertIsNone(obj.thumbnail_id)
