import os

from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from django.views.static import serve

from apps.core.middleware import health_view

urlpatterns = [
    path("health", health_view),
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.rooms.urls")),
    path("api/v1/", include("apps.catalog.urls")),
    path("api/v1/", include("apps.games.urls")),
]

if settings.MEDIA_ROOT:
    urlpatterns += [
        path(
            "media/<path:path>",
            serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
