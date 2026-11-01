from django.core.paginator import EmptyPage, Paginator
from django.http import JsonResponse
from django.db.models import Count, Q
from django.urls import reverse
from django.utils.http import urlencode
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_safe

from .models import BlogPost, Tag


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


def _post_data(post, include_body=False):
    full_name = post.author.get_full_name().strip()
    data = {
        'slug': post.slug,
        'title': post.title,
        'published_at': post.published_at.isoformat(),
        'author': {
            'username': post.author.get_username(),
            'name': full_name or post.author.get_username(),
        },
        'tags': [{'name': tag.name, 'slug': tag.slug} for tag in post.tags.all()],
    }
    if include_body:
        data['body'] = post.body
    return data


@csrf_exempt
@require_safe
def public_blog_list(request):
    """Return published posts, optionally filtered by a published tag."""
    unsupported = set(request.GET.keys()) - {'page', 'page_size', 'tag'}
    if unsupported:
        return JsonResponse({'detail': 'Unsupported query parameter.'}, status=400)

    page_number, error = _positive_integer(request, 'page', 1)
    if error:
        return error
    page_size, error = _positive_integer(request, 'page_size', DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
    if error:
        return error

    tag_slug = request.GET.get('tag')
    if 'tag' in request.GET and not tag_slug:
        return JsonResponse({'detail': 'tag must be a non-empty slug.'}, status=400)

    posts = BlogPost.objects.filter(status=BlogPost.Status.PUBLISHED)
    if tag_slug:
        tag_is_public = Tag.objects.filter(
            slug=tag_slug, blog_posts__status=BlogPost.Status.PUBLISHED,
        ).exists()
        if not tag_is_public:
            return JsonResponse({'detail': 'Not found.'}, status=404)
        posts = posts.filter(tags__slug=tag_slug)
    posts = posts.select_related('author').prefetch_related('tags')
    paginator = Paginator(posts, page_size)
    try:
        page = paginator.page(page_number)
    except EmptyPage:
        return JsonResponse({'detail': 'Page not found.'}, status=404)

    def page_url(number):
        if number is None:
            return None
        parameters = {'page': number, 'page_size': page_size}
        if tag_slug:
            parameters['tag'] = tag_slug
        query = urlencode(parameters)
        return f'{reverse("public-blog-list")}?{query}'

    results = [_post_data(post) for post in page.object_list]

    return JsonResponse({
        'count': paginator.count,
        'next': page_url(page.next_page_number() if page.has_next() else None),
        'previous': page_url(page.previous_page_number() if page.has_previous() else None),
        'results': results,
    })


@csrf_exempt
@require_safe
def public_blog_detail(request, slug):
    """Return one published post; missing and draft posts are indistinguishable."""
    if request.GET:
        return JsonResponse({'detail': 'This endpoint does not accept query parameters.'}, status=400)

    post = (
        BlogPost.objects.filter(slug=slug, status=BlogPost.Status.PUBLISHED)
        .select_related('author')
        .prefetch_related('tags')
        .first()
    )
    if post is None:
        return JsonResponse({'detail': 'Not found.'}, status=404)
    return JsonResponse(_post_data(post, include_body=True))


@csrf_exempt
@require_safe
def public_blog_tags(request):
    """Return tags attached to at least one published post."""
    if request.GET:
        return JsonResponse({'detail': 'This endpoint does not accept query parameters.'}, status=400)

    tags = (
        Tag.objects.filter(blog_posts__status=BlogPost.Status.PUBLISHED)
        .annotate(post_count=Count('blog_posts', filter=Q(blog_posts__status=BlogPost.Status.PUBLISHED), distinct=True))
        .order_by('name', 'pk')
        .distinct()
    )
    results = [
        {'slug': tag.slug, 'name': tag.name, 'post_count': tag.post_count}
        for tag in tags
    ]
    return JsonResponse({'count': len(results), 'results': results})
