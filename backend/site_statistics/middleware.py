class DiscardStatisticsIdentity:
    """Keep the public collector outside Django's session/cookie machinery."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == '/api/v1/statistics/':
            request.COOKIES = {}
            for key in (
                'HTTP_COOKIE', 'HTTP_AUTHORIZATION', 'HTTP_USER_AGENT', 'HTTP_REFERER',
                'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_FORWARDED', 'REMOTE_ADDR',
            ):
                request.META.pop(key, None)
        return self.get_response(request)
