import json
import re
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from blog.models import BlogPost
from projects.models import Project
from .models import DailyPageTotal

STATIC_PATHS = {'/', '/about', '/blog', '/projects', '/contact', '/datenschutz'}
SOURCES = {'direct', 'google', 'bing', 'duckduckgo', 'github', 'linkedin', 'other'}


def public_path(path):
    if path in STATIC_PATHS:
        return True
    match = re.fullmatch(r'/(blog|projects)/([a-zA-Z0-9_-]{1,250})', path)
    if not match:
        return False
    kind, slug = match.groups()
    if kind == 'blog':
        return BlogPost.objects.filter(slug=slug, status='published', published_at__lte=timezone.now()).exists()
    return Project.objects.filter(slug=slug).exists()


def reply(status):
    response = HttpResponse(status=status)
    response['Cache-Control'] = 'no-store'
    return response


@csrf_exempt
@require_POST
def collect(request):
    # No session, cookie, IP, browser, fingerprint, event ID, or precise timestamp is read or stored.
    if not settings.STATISTICS_ENABLED:
        return reply(204)
    if request.GET:
        return reply(400)
    if request.content_type != 'application/json':
        return reply(415)
    try:
        if int(request.META.get('CONTENT_LENGTH') or 0) > 1024:
            return reply(413)
        body = request.body
        if len(body) > 1024:
            return reply(413)
        data = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        return reply(400)
    if not isinstance(data, dict) or set(data) != {'path', 'referrer', 'views', 'seconds'}:
        return reply(400)
    path, source, views, seconds = (data[key] for key in ('path', 'referrer', 'views', 'seconds'))
    if not isinstance(path, str) or len(path) > 280 or not isinstance(source, str) or source not in SOURCES:
        return reply(400)
    if type(views) is not int or views not in (0, 1) or type(seconds) is not int:
        return reply(400)
    if seconds < 0 or seconds > 30 or seconds % 5 or (views == 1 and seconds != 0) or (views == 0 and seconds == 0):
        return reply(400)
    if not public_path(path):
        return reply(400)
    today = timezone.now().date()
    with transaction.atomic():
        # Only aggregates exist. Contributions are merged immediately, never inserted as event rows.
        row, _ = DailyPageTotal.objects.get_or_create(day=today, path=path, referrer=source)
        DailyPageTotal.objects.filter(pk=row.pk).update(views=F('views') + views, seconds=F('seconds') + seconds)
        DailyPageTotal.objects.filter(day__lt=today - timedelta(days=89)).delete()
    return reply(204)
