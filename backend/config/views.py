from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_safe


@csrf_exempt
@require_safe
def health(request):
    """Public process-liveness signal; deliberately independent of services."""
    return JsonResponse({"status": "ok"})
