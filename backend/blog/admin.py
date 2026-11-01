from django.contrib import admin
from django.utils import timezone

from .models import BlogPost, Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ['title', 'author', 'status', 'published_at']
    list_filter = ['status', 'tags', 'author']
    search_fields = ['title', 'slug', 'body']
    filter_horizontal = ['tags']
    readonly_fields = ['created_at', 'updated_at']
    actions = ['publish', 'unpublish']

    def get_prepopulated_fields(self, request, obj=None):
        return {'slug': ('title',)} if obj is None else {}

    @admin.action(description='Publish selected posts', permissions=['change'])
    def publish(self, request, queryset):
        for post in queryset:
            post.status = BlogPost.Status.PUBLISHED
            if post.published_at is None:
                post.published_at = timezone.now()
            post.full_clean()
            post.save()
        self.message_user(request, 'Selected posts published.')

    @admin.action(description='Unpublish selected posts', permissions=['change'])
    def unpublish(self, request, queryset):
        for post in queryset:
            post.status = BlogPost.Status.DRAFT
            post.save()
        self.message_user(request, 'Selected posts returned to draft.')
