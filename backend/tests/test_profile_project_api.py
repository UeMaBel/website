import io
import tempfile
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from PIL import Image
from pypdf import PdfWriter

from profiles.models import Education, Experience, Profile, ProfileLink, Skill
from projects.models import Project, ProjectImage
from uploads.models import UploadedMedia


class PublicProfileApiTests(TestCase):
    def setUp(self):
        storage = tempfile.TemporaryDirectory()
        self.addCleanup(storage.cleanup)
        settings = override_settings(MEDIA_ROOT=storage.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.client = Client(enforce_csrf_checks=True, HTTP_HOST='localhost')

    def empty_profile_response(self):
        return {
            'display_name': '',
            'biography': '',
            'contact_introduction': '',
            'projects_introduction': '',
            'email': '',
            'cv_url': None,
            'experience': [],
            'education': [],
            'skills': [],
            'links': [],
        }

    def test_page_introductions_are_persisted_and_returned_as_markdown(self):
        profile = Profile.objects.create(
            contact_introduction='Get in **touch**.',
            projects_introduction='## Things I build',
        )
        profile.refresh_from_db()
        data = self.client.get('/api/v1/profile/').json()
        self.assertEqual(data['contact_introduction'], profile.contact_introduction)
        self.assertEqual(data['projects_introduction'], profile.projects_introduction)

    def pdf_upload(self):
        stream = io.BytesIO()
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.write(stream)
        return UploadedMedia.objects.create(
            title='CV', file=SimpleUploadedFile('cv.pdf', stream.getvalue()),
        )

    def test_missing_and_empty_profile_return_the_same_complete_shape(self):
        missing = self.client.get('/api/v1/profile/')
        self.assertEqual(missing.status_code, 200)
        self.assertEqual(missing.json(), self.empty_profile_response())

        Profile.objects.create()
        empty = self.client.get('/api/v1/profile/')
        self.assertEqual(empty.status_code, 200)
        self.assertEqual(empty.json(), self.empty_profile_response())

    def test_profile_returns_ordered_content_contact_and_valid_cv_url(self):
        profile = Profile.objects.create(
            display_name='Site Owner', biography='# Biography', email='owner@example.test',
        )
        Experience.objects.create(
            profile=profile, position=2, employer='Later Co', role='Lead',
            start_date=date(2022, 1, 1), description='Later role',
        )
        Experience.objects.create(
            profile=profile, position=0, employer='First Co', role='Engineer',
            start_date=date(2020, 1, 1), end_date=date(2021, 1, 1), description='First role',
        )
        Education.objects.create(
            profile=profile, position=1, institution='Later University',
            qualification='MSc', start_date=date(2019, 1, 1),
        )
        Education.objects.create(
            profile=profile, position=0, institution='First University',
            qualification='BSc', start_date=date(2015, 1, 1),
        )
        Skill.objects.create(profile=profile, position=1, name='Django', category='Frameworks')
        Skill.objects.create(profile=profile, position=0, name='Python', category='Languages')
        ProfileLink.objects.create(
            profile=profile, position=1, label='Code', url='https://example.test/code',
        )
        ProfileLink.objects.create(
            profile=profile, position=0, label='Professional profile',
            url='https://example.test/owner',
        )
        cv = self.pdf_upload()
        profile.cv = cv
        profile.save()

        response = self.client.get('/api/v1/profile/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(set(payload), set(self.empty_profile_response()))
        self.assertEqual(payload['display_name'], 'Site Owner')
        self.assertEqual(payload['biography'], '# Biography')
        self.assertEqual(payload['email'], 'owner@example.test')
        self.assertEqual(payload['cv_url'], cv.file.url)
        self.assertTrue(payload['cv_url'].startswith('/media/uploads/'))
        self.assertEqual([item['employer'] for item in payload['experience']], ['First Co', 'Later Co'])
        self.assertEqual(payload['experience'][0]['start_date'], '2020-01-01')
        self.assertEqual(payload['experience'][0]['end_date'], '2021-01-01')
        self.assertIsNone(payload['experience'][1]['end_date'])
        self.assertEqual([item['institution'] for item in payload['education']], [
            'First University', 'Later University',
        ])
        self.assertEqual([item['name'] for item in payload['skills']], ['Python', 'Django'])
        self.assertEqual([item['label'] for item in payload['links']], [
            'Professional profile', 'Code',
        ])

    def test_profile_rejects_query_and_unsafe_methods_with_csrf_checks(self):
        self.assertEqual(self.client.get('/api/v1/profile/?unexpected=1').status_code, 400)
        head = self.client.head('/api/v1/profile/')
        self.assertEqual(head.status_code, 200)
        self.assertEqual(head.content, b'')
        for method in ('post', 'put', 'patch', 'delete'):
            with self.subTest(method=method):
                response = getattr(self.client, method)('/api/v1/profile/')
                self.assertEqual(response.status_code, 405)
                self.assertEqual(response.headers['Allow'], 'GET, HEAD')


class PublicProjectApiTests(TestCase):
    def setUp(self):
        storage = tempfile.TemporaryDirectory()
        self.addCleanup(storage.cleanup)
        settings = override_settings(MEDIA_ROOT=storage.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.client = Client(enforce_csrf_checks=True, HTTP_HOST='localhost')

    def project(self, title, slug, **fields):
        values = {
            'title': title,
            'slug': slug,
            'problem': f'{title} problem',
            'contribution': f'{title} contribution',
            'technologies': ['Django', 'PostgreSQL'],
        }
        values.update(fields)
        return Project.objects.create(**values)

    def image(self, title, color):
        stream = io.BytesIO()
        Image.new('RGB', (3, 2), color).save(stream, format='PNG')
        return UploadedMedia.objects.create(
            title=title,
            alt_text=f'{title} alternative text',
            file=SimpleUploadedFile(f'{title}.png', stream.getvalue()),
        )

    def test_project_listing_shape_order_and_optional_content(self):
        self.project('Zulu project', 'zulu')
        self.project('Alpha project', 'alpha')

        response = self.client.get('/api/v1/projects/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['count'], 2)
        self.assertEqual([item['slug'] for item in payload['results']], ['alpha', 'zulu'])
        for item in payload['results']:
            self.assertEqual(set(item), {
                'slug', 'title', 'problem', 'contribution', 'technologies',
                'description', 'repository_url', 'demo_url', 'images',
            })
            self.assertIsNone(item['repository_url'])
            self.assertIsNone(item['demo_url'])
            self.assertEqual(item['images'], [])

    def test_project_detail_returns_optional_links_and_ordered_valid_image_urls(self):
        project = self.project(
            'Showcase project', 'showcase',
            description='## Details', repository_url='https://example.test/repo',
            demo_url='https://demo.example.test',
        )
        later_image = self.image('later', 'red')
        first_image = self.image('first', 'blue')
        ProjectImage.objects.create(project=project, image=later_image, position=2)
        ProjectImage.objects.create(project=project, image=first_image, position=0)

        response = self.client.get('/api/v1/projects/showcase/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['slug'], project.slug)
        self.assertEqual(payload['problem'], 'Showcase project problem')
        self.assertEqual(payload['contribution'], 'Showcase project contribution')
        self.assertEqual(payload['technologies'], ['Django', 'PostgreSQL'])
        self.assertEqual(payload['description'], '## Details')
        self.assertEqual(payload['repository_url'], 'https://example.test/repo')
        self.assertEqual(payload['demo_url'], 'https://demo.example.test')
        self.assertEqual([item['position'] for item in payload['images']], [0, 2])
        self.assertEqual([item['alt_text'] for item in payload['images']], [
            'first alternative text', 'later alternative text',
        ])
        self.assertEqual([item['url'] for item in payload['images']], [
            first_image.file.url, later_image.file.url,
        ])
        self.assertTrue(all(item['url'].startswith('/media/uploads/') for item in payload['images']))

    def test_missing_project_returns_not_found_and_endpoints_reject_bad_requests(self):
        missing = self.client.get('/api/v1/projects/not-found/')
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(missing.json(), {'detail': 'Not found.'})
        self.assertEqual(self.client.get('/api/v1/projects/?unexpected=1').status_code, 400)
        self.assertEqual(self.client.get('/api/v1/projects/not-found/?unexpected=1').status_code, 400)
        self.project('Example project', 'example')

        for path in ('/api/v1/projects/', '/api/v1/projects/example/'):
            with self.subTest(path=path):
                head = self.client.head(path)
                self.assertEqual(head.status_code, 200)
                self.assertEqual(head.content, b'')
                for method in ('post', 'put', 'patch', 'delete'):
                    with self.subTest(method=method):
                        response = getattr(self.client, method)(path)
                        self.assertEqual(response.status_code, 405)
                        self.assertEqual(response.headers['Allow'], 'GET, HEAD')
