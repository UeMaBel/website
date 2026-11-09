from django.contrib import admin

from .models import Project, ProjectImage


class ProjectImageInline(admin.TabularInline):
    model = ProjectImage
    extra = 0
    fields = ['position', 'image']
    autocomplete_fields = ['image']


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['title', 'position', 'slug']
    list_editable = ['position']
    autocomplete_fields = ['thumbnail']
    search_fields = ['title', 'slug', 'thumbnail', 'hide_thumbnail_on_detail', 'problem', 'contribution']
    inlines = [ProjectImageInline]
    fieldsets = [
        (None, {'fields': ['title', 'slug', 'position', 'thumbnail', 'hide_thumbnail_on_detail', 'problem', 'contribution', 'technologies', 'description']}),
        ('External links (optional)', {
            'fields': ['repository_url', 'demo_url'],
            'description': 'Links are optional. A project remains available when its demo is offline.',
        }),
    ]

    def get_prepopulated_fields(self, request, obj=None):
        return {'slug': ('title',)} if obj is None else {}
