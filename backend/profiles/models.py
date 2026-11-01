from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import models

from uploads.models import UploadedMedia


class Profile(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    display_name = models.CharField(max_length=200, blank=True)
    biography = models.TextField(blank=True, help_text='Markdown source')
    email = models.EmailField(blank=True)
    cv = models.ForeignKey('uploads.UploadedMedia', null=True, blank=True,
                           on_delete=models.PROTECT, related_name='profiles',
                           limit_choices_to={'kind': 'pdf'})

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(id=1), name='single_owner_profile')]
        verbose_name = 'About/CV'
        verbose_name_plural = 'About/CV'

    def clean(self):
        super().clean()
        if self.cv_id and not UploadedMedia.objects.filter(pk=self.cv_id, kind='pdf').exists():
            raise ValidationError({'cv': 'Choose an uploaded PDF for the CV.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.display_name or 'About/CV'


class OrderedItem(models.Model):
    position = models.PositiveIntegerField(default=0)

    class Meta:
        abstract = True
        ordering = ['position', 'pk']


class Experience(OrderedItem):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='experience')
    employer = models.CharField(max_length=200)
    role = models.CharField(max_length=200)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True, help_text='Markdown source')

    class Meta(OrderedItem.Meta):
        abstract = False
        constraints = [models.CheckConstraint(
            condition=models.Q(end_date__isnull=True) | models.Q(end_date__gte=models.F('start_date')),
            name='experience_dates_in_order',
        )]

    def __str__(self):
        return f'{self.role} at {self.employer}'


class Education(OrderedItem):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='education')
    institution = models.CharField(max_length=200)
    qualification = models.CharField(max_length=200)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True, help_text='Markdown source')

    class Meta(OrderedItem.Meta):
        abstract = False
        constraints = [models.CheckConstraint(
            condition=models.Q(end_date__isnull=True) | models.Q(end_date__gte=models.F('start_date')),
            name='education_dates_in_order',
        )]

    def __str__(self):
        return f'{self.qualification}, {self.institution}'


class Skill(OrderedItem):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='skills')
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=150, blank=True)

    def __str__(self):
        return self.name


class ProfileLink(OrderedItem):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='links')
    label = models.CharField(max_length=150)
    url = models.URLField(max_length=1000, validators=[URLValidator(schemes=['http', 'https'])])

    def __str__(self):
        return self.label
