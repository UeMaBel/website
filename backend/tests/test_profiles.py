import io
import tempfile
from datetime import date

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models.deletion import ProtectedError
from django.test import TestCase, override_settings
from PIL import Image
from pypdf import PdfWriter

from profiles.models import Education, Experience, Profile, ProfileLink, Skill
from uploads.models import UploadedMedia


class ProfilePersistenceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = Profile.objects.create()

    def setUp(self):
        storage = tempfile.TemporaryDirectory()
        self.addCleanup(storage.cleanup)
        settings = override_settings(MEDIA_ROOT=storage.name)
        settings.enable()
        self.addCleanup(settings.disable)

    def pdf(self):
        stream = io.BytesIO()
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.write(stream)
        return UploadedMedia.objects.create(title='CV', file=SimpleUploadedFile('cv.pdf', stream.getvalue()))

    def test_biography_and_contact_data_survive_reload_and_edit(self):
        owner = Profile.objects.get(pk=self.owner.pk)
        owner.display_name = 'Owner'
        owner.biography = '# Biography\n\nTechnical experience.'
        owner.email = 'owner@example.test'
        owner.save()
        link = ProfileLink.objects.create(profile=owner, label='Professional profile', url='https://example.test/owner')
        saved = Profile.objects.get(pk=owner.pk)
        self.assertEqual(saved.display_name, 'Owner')
        self.assertEqual(saved.biography, '# Biography\n\nTechnical experience.')
        self.assertEqual(saved.email, 'owner@example.test')
        self.assertEqual(saved.links.get().url, 'https://example.test/owner')
        link.url = 'https://example.test/updated'
        link.save()
        self.assertEqual(saved.links.get().url, 'https://example.test/updated')

    def test_empty_profile_and_missing_cv_are_valid(self):
        saved = Profile.objects.get(pk=self.owner.pk)
        saved.full_clean()
        self.assertEqual(saved.biography, '')
        self.assertEqual(saved.email, '')
        self.assertIsNone(saved.cv)
        self.assertFalse(saved.links.exists())
        self.assertFalse(saved.experience.exists())

    def test_structured_entries_order_by_position_with_stable_ties(self):
        cases = (
            (Experience, 'experience', {'employer': 'Client', 'role': 'Engineer', 'start_date': date(2020, 1, 1)}),
            (Education, 'education', {'institution': 'University', 'qualification': 'MSc', 'start_date': date(2018, 1, 1)}),
            (Skill, 'skills', {'name': 'Python', 'category': 'Languages'}),
            (ProfileLink, 'links', {'label': 'Profile', 'url': 'https://example.test/owner'}),
        )
        for model, relation, fields in cases:
            with self.subTest(relation=relation):
                later = model.objects.create(profile=self.owner, position=2, **fields)
                first = model.objects.create(profile=self.owner, position=0, **fields)
                tied = model.objects.create(profile=self.owner, position=0, **fields)
                self.assertQuerySetEqual(getattr(self.owner, relation).all(), [first, tied, later])
                later.position = 0
                later.save()
                self.assertQuerySetEqual(getattr(self.owner, relation).all(), [later, first, tied])

    def test_experience_and_education_preserve_structured_details(self):
        experience = Experience.objects.create(profile=self.owner, employer='Client', role='Engineer',
                                               start_date=date(2020, 1, 1), end_date=date(2022, 12, 31),
                                               description='## Contribution')
        education = Education.objects.create(profile=self.owner, institution='University', qualification='MSc',
                                             start_date=date(2018, 1, 1), description='AI specialization')
        saved_experience = self.owner.experience.get(pk=experience.pk)
        saved_education = self.owner.education.get(pk=education.pk)
        self.assertEqual(saved_experience.employer, 'Client')
        self.assertEqual(saved_experience.end_date, date(2022, 12, 31))
        self.assertEqual(saved_experience.description, '## Contribution')
        self.assertEqual(saved_education.qualification, 'MSc')
        self.assertIsNone(saved_education.end_date)
        self.assertEqual(saved_education.description, 'AI specialization')

    def test_cv_can_be_attached_and_removed_without_deleting_upload(self):
        cv = self.pdf()
        owner = Profile.objects.get(pk=self.owner.pk)
        owner.cv = cv
        owner.save()
        owner.refresh_from_db()
        self.assertEqual(owner.cv, cv)
        self.assertEqual(owner.cv.kind, 'pdf')
        with self.assertRaises(ProtectedError):
            cv.delete()
        owner.cv = None
        owner.save()
        owner.refresh_from_db()
        self.assertIsNone(owner.cv)
        self.assertTrue(UploadedMedia.objects.filter(pk=cv.pk).exists())
        self.assertTrue(cv.file.storage.exists(cv.file.name))

    def test_image_and_missing_upload_cannot_be_used_as_cv(self):
        stream = io.BytesIO()
        Image.new('RGB', (2, 2), 'red').save(stream, format='PNG')
        image = UploadedMedia.objects.create(title='Image', file=SimpleUploadedFile('image.png', stream.getvalue()), alt_text='Red square')
        for cv_id in (image.pk, 999999):
            with self.subTest(cv_id=cv_id):
                owner = Profile.objects.get(pk=self.owner.pk)
                owner.cv_id = cv_id
                with self.assertRaises(ValidationError) as caught:
                    owner.save()
                self.assertIn('cv', caught.exception.message_dict)
                owner.refresh_from_db()
                self.assertIsNone(owner.cv)

    def test_only_one_owner_profile_is_allowed(self):
        with self.assertRaises(ValidationError):
            Profile(id=2, biography='Second owner').save()
        self.assertEqual(Profile.objects.count(), 1)

    def test_invalid_email_and_unsafe_contact_urls_fail_validation(self):
        owner = Profile.objects.get(pk=self.owner.pk)
        owner.email = 'not-an-email'
        with self.assertRaises(ValidationError):
            owner.save()
        for url in ('javascript:alert(1)', 'ftp://example.test/profile'):
            with self.subTest(url=url), self.assertRaises(ValidationError):
                ProfileLink(profile=self.owner, label='Invalid', url=url).full_clean()
