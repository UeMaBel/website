from django.contrib import admin

from .models import UploadedMedia


@admin.register(UploadedMedia)
class UploadedMediaAdmin(admin.ModelAdmin):
    list_display = ['title', 'kind', 'created_at']
    list_filter = ['kind']
    search_fields = ['title', 'alt_text']
    readonly_fields = ['kind', 'created_at']
