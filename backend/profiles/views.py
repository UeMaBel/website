from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_safe

from .models import Profile


def _date(value):
    return value.isoformat() if value is not None else None


@csrf_exempt
@require_safe
def public_profile(request):
    """Return the owner's public About/CV and contact content."""
    if request.GET:
        return JsonResponse({'detail': 'This endpoint does not accept query parameters.'}, status=400)

    profile = (
        Profile.objects.filter(pk=1)
        .select_related('cv')
        .prefetch_related('experience', 'education', 'skills', 'links')
        .first()
    )
    if profile is None:
        return JsonResponse({
            'display_name': '',
            'biography': '',
            'contact_introduction': '',
            'impressum': '',
            'projects_introduction': '',
            'email': '',
            'cv_url': None,
            'experience': [],
            'education': [],
            'skills': [],
            'links': [],
        })

    return JsonResponse({
        'display_name': profile.display_name,
        'biography': profile.biography,
        'contact_introduction': profile.contact_introduction,
        'impressum': profile.impressum,
        'projects_introduction': profile.projects_introduction,
        'email': profile.email,
        'cv_url': profile.cv.file.url if profile.cv_id else None,
        'experience': [
            {
                'position': item.position,
                'employer': item.employer,
                'role': item.role,
                'start_date': _date(item.start_date),
                'end_date': _date(item.end_date),
                'description': item.description,
            }
            for item in profile.experience.all()
        ],
        'education': [
            {
                'position': item.position,
                'institution': item.institution,
                'qualification': item.qualification,
                'start_date': _date(item.start_date),
                'end_date': _date(item.end_date),
                'description': item.description,
            }
            for item in profile.education.all()
        ],
        'skills': [
            {'position': item.position, 'name': item.name, 'category': item.category}
            for item in profile.skills.all()
        ],
        'links': [
            {'position': item.position, 'label': item.label, 'url': item.url}
            for item in profile.links.all()
        ],
    })
