from django.contrib import admin

from .models import UploadedMedia


@admin.register(UploadedMedia)
class UploadedMediaAdmin(admin.ModelAdmin):
    list_display = ['title', 'kind', 'created_at']
    list_filter = ['kind']
    search_fields = ['title', 'alt_text']
    readonly_fields = ['kind', 'created_at', 'media_url', 'markdown_image']

    @admin.display(description='Media URL')
    def media_url(self, obj):
        return obj.file.url if obj and obj.file else 'Save the upload first.'

    @admin.display(description='Markdown image')
    def markdown_image(self, obj):
        if not obj or not obj.file:
            return 'Save the upload first.'
        if obj.kind != 'image':
            return 'Only images can be embedded as Markdown images.'
        alt = obj.alt_text.replace('\\', '\\\\').replace('[', '\\[').replace(']', '\\]')
        return f'![{alt}]({obj.file.url})'
