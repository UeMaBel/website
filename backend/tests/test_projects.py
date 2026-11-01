import io
import tempfile

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from PIL import Image
from pypdf import PdfWriter

from projects.models import Project, ProjectImage
from uploads.models import UploadedMedia


class ProjectPersistenceTests(TestCase):
    def setUp(self):
        storage = tempfile.TemporaryDirectory()
        self.addCleanup(storage.cleanup)
        settings = override_settings(MEDIA_ROOT=storage.name)
        settings.enable()
        self.addCleanup(settings.disable)

    def project(self, slug='sample-project', **fields):
        values = {
            'title': 'Sample project',
            'slug': slug,
            'problem': 'The problem in Markdown.',
            'contribution': 'The owner contribution in Markdown.',
            'technologies': ['Django', 'PostgreSQL'],
            'description': 'Additional Markdown details.',
        }
        values.update(fields)
        return Project.objects.create(**values)

    def image(self, title, color='red'):
        stream = io.BytesIO()
        Image.new('RGB', (3, 2), color).save(stream, format='PNG')
        return UploadedMedia.objects.create(
            title=title,
            alt_text=f'{title} description',
            file=SimpleUploadedFile(f'{title}.png', stream.getvalue()),
        )

    def pdf(self):
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        stream = io.BytesIO()
        writer.write(stream)
        return UploadedMedia.objects.create(
            title='PDF document',
            file=SimpleUploadedFile('document.pdf', stream.getvalue()),
        )

    def test_content_and_optional_links_persist_and_title_edit_keeps_slug(self):
        project = self.project(repository_url='https://example.test/source')
        project.title = 'Renamed project'
        project.save()

        saved = Project.objects.get(pk=project.pk)
        self.assertEqual(saved.title, 'Renamed project')
        self.assertEqual(saved.slug, 'sample-project')
        self.assertEqual(saved.problem, 'The problem in Markdown.')
        self.assertEqual(saved.contribution, 'The owner contribution in Markdown.')
        self.assertEqual(saved.technologies, ['Django', 'PostgreSQL'])
        self.assertEqual(saved.description, 'Additional Markdown details.')
        self.assertEqual(saved.repository_url, 'https://example.test/source')
        self.assertEqual(saved.demo_url, '')

    def test_repository_demo_and_images_are_optional(self):
        project = self.project()
        project.full_clean()
        self.assertEqual(project.repository_url, '')
        self.assertEqual(project.demo_url, '')
        self.assertFalse(project.project_images.exists())

    def test_project_slugs_are_unique_and_nonempty(self):
        self.project(slug='unique-project')
        with self.assertRaises(ValidationError) as duplicate:
            self.project(slug='unique-project')
        self.assertIn('slug', duplicate.exception.message_dict)

        with self.assertRaises(IntegrityError), transaction.atomic():
            Project.objects.bulk_create([
                Project(title='Empty slug', slug='', problem='Problem', contribution='Work'),
            ])

    def test_project_images_persist_in_position_order_with_stable_ties(self):
        project = self.project()
        later = ProjectImage.objects.create(project=project, image=self.image('later'), position=2)
        first = ProjectImage.objects.create(project=project, image=self.image('first'), position=0)
        tied = ProjectImage.objects.create(project=project, image=self.image('tied'), position=0)

        saved = Project.objects.get(pk=project.pk)
        self.assertQuerySetEqual(saved.project_images.all(), [first, tied, later])

        later.position = 0
        later.save()
        self.assertQuerySetEqual(project.project_images.all(), [later, first, tied])

    def test_pdf_upload_cannot_be_attached_as_a_project_image(self):
        with self.assertRaises(ValidationError) as caught:
            ProjectImage.objects.create(project=self.project(), image=self.pdf())
        self.assertIn('image', caught.exception.message_dict)
