from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Tag(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)

    class Meta:
        ordering = ['name', 'pk']
        constraints = [
            models.CheckConstraint(condition=~models.Q(slug=''), name='tag_slug_nonempty'),
        ]

    def __str__(self):
        return self.name


class BlogPost(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'

    title = models.CharField(max_length=250)
    slug = models.SlugField(max_length=250, unique=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='blog_posts',
    )
    body = models.TextField(help_text='Markdown source')
    tags = models.ManyToManyField(Tag, blank=True, related_name='blog_posts')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = [models.F('published_at').desc(nulls_last=True), '-pk']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=['draft', 'published']), name='post_valid_status',
            ),
            models.CheckConstraint(
                condition=~models.Q(slug=''), name='post_slug_nonempty',
            ),
            models.CheckConstraint(
                condition=~models.Q(status='published') | models.Q(published_at__isnull=False),
                name='published_post_has_timestamp',
            ),
        ]

    def clean(self):
        super().clean()
        if self.status == self.Status.PUBLISHED and self.published_at is None:
            raise ValidationError({'published_at': 'Published posts require a publication timestamp.'})

    def __str__(self):
        return self.title
