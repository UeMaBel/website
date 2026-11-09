from django.http import JsonResponse
from django.db.models import Prefetch
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_safe

from .models import Project, ProjectImage


PROJECT_IMAGES = Prefetch('project_images', queryset=ProjectImage.objects.select_related('image'))


def _project_data(project):
    return {
        'position': project.position,
        'slug': project.slug,
        'title': project.title,
        'hide_thumbnail_on_detail': project.hide_thumbnail_on_detail,
        'thumbnail': {
            'url': project.thumbnail.file.url,
            'alt_text': project.thumbnail.alt_text,
        } if project.thumbnail_id else None,
        'problem': project.problem,
        'contribution': project.contribution,
        'technologies': project.technologies,
        'description': project.description,
        'repository_url': project.repository_url or None,
        'demo_url': project.demo_url or None,
        'images': [
            {
                'position': project_image.position,
                'url': project_image.image.file.url,
                'alt_text': project_image.image.alt_text,
            }
            for project_image in project.project_images.all()
        ],
    }


@csrf_exempt
@require_safe
def public_project_list(request):
    """Return all public projects in their configured order."""
    if request.GET:
        return JsonResponse({'detail': 'This endpoint does not accept query parameters.'}, status=400)

    projects = Project.objects.select_related('thumbnail').prefetch_related(PROJECT_IMAGES)
    results = [_project_data(project) for project in projects]
    return JsonResponse({'count': len(results), 'results': results})


@csrf_exempt
@require_safe
def public_project_detail(request, slug):
    """Return a project by its stable slug."""
    if request.GET:
        return JsonResponse({'detail': 'This endpoint does not accept query parameters.'}, status=400)

    project = (
        Project.objects.select_related('thumbnail').prefetch_related(PROJECT_IMAGES)
        .filter(slug=slug)
        .first()
    )
    if project is None:
        return JsonResponse({'detail': 'Not found.'}, status=404)
    return JsonResponse(_project_data(project))
