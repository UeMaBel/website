from django.core.paginator import EmptyPage, Paginator
from django.http import JsonResponse
from django.urls import reverse
from django.utils.http import urlencode
from django.views.decorators.http import require_safe

from .models import BlogPost


DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100


def _positive_integer(request, name, default, maximum=None):
    raw_value = request.GET.get(name)
    if raw_value is None:
        return default, None
    if not raw_value.isdecimal():
        return None, JsonResponse({'detail': f'{name} must be a positive integer.'}, status=400)

    try:
        value = int(raw_value)
    except ValueError:
        return None, JsonResponse({'detail': f'{name} must be a positive integer.'}, status=400)
    if value < 1 or (maximum is not None and value > maximum):
        detail = f'{name} must be between 1 and {maximum}.' if maximum else f'{name} must be positive.'
        return None, JsonResponse({'detail': detail}, status=400)
    return value, None


@require_safe
def public_blog_list(request):
    """Return the published blog posts in reverse publication order."""
    unsupported = set(request.GET.keys()) - {'page', 'page_size'}
    if unsupported:
        return JsonResponse({'detail': 'Unsupported query parameter.'}, status=400)

    page_number, error = _positive_integer(request, 'page', 1)
    if error:
        return error
    page_size, error = _positive_integer(request, 'page_size', DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
    if error:
        return error

    posts = BlogPost.objects.filter(status=BlogPost.Status.PUBLISHED)
    posts = posts.select_related('author').prefetch_related('tags')
    paginator = Paginator(posts, page_size)
    try:
        page = paginator.page(page_number)
    except EmptyPage:
        return JsonResponse({'detail': 'Page not found.'}, status=404)

    def page_url(number):
        if number is None:
            return None
        query = urlencode({'page': number, 'page_size': page_size})
        return f'{reverse("public-blog-list")}?{query}'

    results = []
    for post in page.object_list:
        full_name = post.author.get_full_name().strip()
        results.append({
            'slug': post.slug,
            'title': post.title,
            'published_at': post.published_at.isoformat(),
            'author': {
                'username': post.author.get_username(),
                'name': full_name or post.author.get_username(),
            },
            'tags': [{'name': tag.name, 'slug': tag.slug} for tag in post.tags.all()],
        })

    return JsonResponse({
        'count': paginator.count,
        'next': page_url(page.next_page_number() if page.has_next() else None),
        'previous': page_url(page.previous_page_number() if page.has_previous() else None),
        'results': results,
    })
