import io
import warnings
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader
from pypdf.errors import PdfReadError


IMAGE_TYPES = {'.jpg': 'JPEG', '.jpeg': 'JPEG', '.png': 'PNG', '.webp': 'WEBP'}


def upload_path(instance, filename):
    return f'uploads/{uuid4().hex}{Path(filename).suffix.lower()}'


def media_type(upload):
    limit = settings.UPLOAD_MAX_BYTES
    if upload.size == 0 or upload.size > limit:
        raise ValidationError(f'Upload must contain between 1 and {limit} bytes.')
    suffix = Path(upload.name).suffix.lower()
    if suffix not in {*IMAGE_TYPES, '.pdf'}:
        raise ValidationError('Supported files: JPEG, PNG, WebP images and PDF documents.')
    position = upload.tell()
    try:
        upload.seek(0)
        content = io.BytesIO(upload.read(limit + 1))
        if suffix == '.pdf':
            pdf = PdfReader(content, strict=True)
            if pdf.is_encrypted or not pdf.pages:
                raise ValidationError('PDF must be unencrypted and contain at least one page.')
            return 'pdf'
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            image = Image.open(content)
            if image.format != IMAGE_TYPES[suffix]:
                raise ValidationError('File contents do not match the image extension.')
            image.verify()
            content.seek(0)
            with Image.open(content) as decoded:
                decoded.load()
        return 'image'
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, KeyError, TypeError,
            IndexError, PdfReadError,
            Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ValidationError('The file is not a valid supported image or PDF.') from error
    finally:
        upload.seek(position)


class UploadedMedia(models.Model):
    title = models.CharField(max_length=250)
    file = models.FileField(upload_to=upload_path)
    alt_text = models.CharField(max_length=500, blank=True,
                                help_text='Describe the image for readers who cannot see it.')
    kind = models.CharField(max_length=5, editable=False, blank=True,
                            choices=[('image', 'Image'), ('pdf', 'PDF')])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-pk']
        verbose_name_plural = 'uploaded media'

    def clean(self):
        super().clean()
        if not self.file:
            return
        try:
            self.kind = media_type(self.file)
        except ValidationError as error:
            raise ValidationError({'file': error.messages}) from error
        if self.pk:
            original_kind = type(self).objects.filter(pk=self.pk).values_list('kind', flat=True).first()
            if original_kind is not None and self.kind != original_kind:
                raise ValidationError({
                    'file': 'Replacement must keep the same media kind. Create a new upload instead.',
                })
        if self.kind == 'image' and not self.alt_text.strip():
            raise ValidationError({'alt_text': 'Images require descriptive alternative text.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.title
