from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import models

from uploads.models import UploadedMedia


class Project(models.Model):
    position = models.IntegerField(default=0)
    thumbnail = models.ForeignKey(
        'uploads.UploadedMedia', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='%(app_label)s_thumbnails', limit_choices_to={'kind': 'image'},
        help_text='Optional image used in cards and at the top of the detail page.',
    )
    hide_thumbnail_on_detail = models.BooleanField(
        'Hide thumbnail on detail page', default=False,
        help_text='Keep the thumbnail in listings, but hide it on its own page and draft preview.',
    )
    title = models.CharField(max_length=250)
    slug = models.SlugField(max_length=250, unique=True)
    problem = models.TextField(help_text='Markdown source')
    contribution = models.TextField(help_text='Markdown source')
    technologies = models.JSONField(default=list)
    description = models.TextField(blank=True, help_text='Markdown source')
    repository_url = models.URLField(
        max_length=1000, blank=True, validators=[URLValidator(schemes=['http', 'https'])],
    )
    demo_url = models.URLField(
        max_length=1000, blank=True, validators=[URLValidator(schemes=['http', 'https'])],
    )
    class Meta:
        ordering = ['position', 'title', 'pk']
        constraints = [
            models.CheckConstraint(condition=~models.Q(slug=''), name='project_slug_nonempty'),
        ]

    def clean(self):
        super().clean()
        if self.thumbnail_id:
            from uploads.models import UploadedMedia
            if not UploadedMedia.objects.filter(pk=self.thumbnail_id, kind='image').exists():
                raise ValidationError({'thumbnail': 'Choose uploaded image media.'})
        if not isinstance(self.technologies, list) or any(
            not isinstance(technology, str) or not technology.strip()
            for technology in self.technologies
        ):
            raise ValidationError({'technologies': 'Enter a list of non-empty technology names.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class ProjectImage(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='project_images')
    image = models.ForeignKey(
        UploadedMedia, on_delete=models.PROTECT, related_name='project_image_links',
        limit_choices_to={'kind': 'image'},
    )
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['position', 'pk']
        constraints = [
            models.UniqueConstraint(fields=['project', 'image'], name='project_image_unique'),
        ]

    def clean(self):
        super().clean()
        if self.image_id and not UploadedMedia.objects.filter(pk=self.image_id, kind='image').exists():
            raise ValidationError({'image': 'Choose uploaded image media.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.project}: {self.image}'
