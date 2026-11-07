from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, router, transaction


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

    thumbnail = models.ForeignKey(
        'uploads.UploadedMedia', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='%(app_label)s_thumbnails', limit_choices_to={'kind': 'image'},
        help_text='Optional image used in cards and at the top of the detail page.',
    )
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
        if self.thumbnail_id:
            from uploads.models import UploadedMedia
            if not UploadedMedia.objects.filter(pk=self.thumbnail_id, kind='image').exists():
                raise ValidationError({'thumbnail': 'Choose uploaded image media.'})
        if self.status == self.Status.PUBLISHED and self.published_at is None:
            raise ValidationError({'published_at': 'Published posts require a publication timestamp.'})
        if self.slug:
            reserved_slug = BlogPostSlug.objects.filter(slug=self.slug).first()
            if reserved_slug and (
                self.pk is None
                or reserved_slug.post_id != self.pk
                or not reserved_slug.is_current
            ):
                raise ValidationError({'slug': 'This URL slug has already been used.'})

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields')
        if update_fields is not None and 'slug' not in update_fields:
            return super().save(*args, **kwargs)

        using = kwargs.get('using') or router.db_for_write(type(self), instance=self) or 'default'
        with transaction.atomic(using=using):
            creating = self._state.adding
            old_slug = None
            if not creating:
                old_slug = (
                    type(self).objects.using(using).select_for_update()
                    .filter(pk=self.pk)
                    .values_list('slug', flat=True)
                    .first()
                )
                creating = old_slug is None
            slug_changed = creating or old_slug != self.slug
            reserved_slug = BlogPostSlug.objects.using(using).filter(slug=self.slug).first()
            if slug_changed and reserved_slug and not reserved_slug.is_current:
                raise ValidationError({'slug': 'This URL slug has already been used.'})

            result = super().save(*args, **kwargs)
            if creating:
                BlogPostSlug.objects.using(using).create(post=self, slug=self.slug, is_current=True)
            elif slug_changed:
                previous = BlogPostSlug.objects.using(using).select_for_update().get(
                    post_id=self.pk, slug=old_slug, is_current=True,
                )
                previous.is_current = False
                previous.save(using=using, update_fields=['is_current'])
                BlogPostSlug.objects.using(using).create(post=self, slug=self.slug, is_current=True)
            return result

    def __str__(self):
        return self.title


class BlogPostSlug(models.Model):
    post = models.ForeignKey(BlogPost, on_delete=models.CASCADE, related_name='url_slugs')
    slug = models.SlugField(max_length=250, unique=True)
    is_current = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['post'], condition=models.Q(is_current=True),
                name='one_current_blogpost_slug',
            ),
        ]

    def __str__(self):
        return self.slug
