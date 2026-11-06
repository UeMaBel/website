from django.contrib import admin

from .models import DailyPageTotal


@admin.register(DailyPageTotal)
class DailyPageTotalAdmin(admin.ModelAdmin):
    list_display = ['day', 'path', 'referrer', 'views', 'seconds', 'average_seconds']
    list_filter = ['day', 'referrer']
    search_fields = ['path']
    date_hierarchy = 'day'
    actions = None

    @admin.display(description='Approx. seconds / view')
    def average_seconds(self, obj):
        return round(obj.seconds / obj.views, 1) if obj.views else None

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
