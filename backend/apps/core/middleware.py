import os
from pathlib import Path

from django.http import FileResponse, HttpResponse


def health_view(request):
    return HttpResponse("ok\n", content_type="text/plain")


class SPAFallbackMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        frontend_dist = os.getenv("FRONTEND_DIST", "")
        self.index_path = Path(frontend_dist) / "index.html" if frontend_dist else None

    def __call__(self, request):
        response = self.get_response(request)
        if response.status_code != 404 or not self.index_path or not self.index_path.is_file():
            return response

        path = request.path
        if (
            path.startswith("/api/")
            or path.startswith("/ws/")
            or path.startswith("/media/")
            or path.startswith("/health")
            or path.startswith("/static/")
        ):
            return response

        return FileResponse(self.index_path.open("rb"), content_type="text/html")
