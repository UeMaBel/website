from django.contrib import admin

from .models import Education, Experience, Profile, ProfileLink, Skill


class ExperienceInline(admin.TabularInline):
    model = Experience
    extra = 0
    fields = ['position', 'employer', 'role', 'start_date', 'end_date', 'description']


class EducationInline(admin.TabularInline):
    model = Education
    extra = 0
    fields = ['position', 'institution', 'qualification', 'start_date', 'end_date', 'description']


class SkillInline(admin.TabularInline):
    model = Skill
    extra = 0
    fields = ['position', 'name', 'category']


class ProfileLinkInline(admin.TabularInline):
    model = ProfileLink
    extra = 0
    fields = ['position', 'label', 'url']


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    fields = ['display_name', 'biography', 'contact_introduction', 'projects_introduction', 'email', 'cv']
    inlines = [ExperienceInline, EducationInline, SkillInline, ProfileLinkInline]

    def has_add_permission(self, request):
        return super().has_add_permission(request) and not Profile.objects.exists()
