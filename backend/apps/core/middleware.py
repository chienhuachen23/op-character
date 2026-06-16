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

    def _is_backend_path(self, path: str) -> bool:
        return (
            path.startswith("/api/")
            or path.startswith("/ws/")
            or path.startswith("/media/")
            or path.startswith("/health")
            or path.startswith("/static/")
            or path.startswith("/django-admin")
        )

    def _is_react_admin_path(self, path: str) -> bool:
        return path == "/admin" or path.startswith("/admin/")

    def _should_serve_spa(self, path: str) -> bool:
        if self._is_backend_path(path):
            return False
        if self._is_react_admin_path(path):
            return True
        if path.startswith("/room/"):
            return True
        return False

    def __call__(self, request):
        path = request.path
        if (
            self.index_path
            and self.index_path.is_file()
            and self._should_serve_spa(path)
        ):
            return FileResponse(self.index_path.open("rb"), content_type="text/html")

        response = self.get_response(request)
        if response.status_code != 404 or not self.index_path or not self.index_path.is_file():
            return response

        if self._is_backend_path(path):
            return response

        return FileResponse(self.index_path.open("rb"), content_type="text/html")
