from django.urls import path

from .admin_views import (
    AdminAuthVerifyView,
    AdminCharacterDetailView,
    AdminCharacterListCreateView,
    AdminImageUploadView,
    AdminThemeDetailView,
    AdminThemeListCreateView,
)
from .views import GameModeListView, ThemeListView

urlpatterns = [
    path("game-modes", GameModeListView.as_view(), name="game-mode-list"),
    path("game-modes/<slug:slug>/themes", ThemeListView.as_view(), name="theme-list"),
    path("admin/auth/verify", AdminAuthVerifyView.as_view(), name="admin-auth-verify"),
    path("admin/themes", AdminThemeListCreateView.as_view(), name="admin-theme-list"),
    path("admin/themes/<int:theme_id>", AdminThemeDetailView.as_view(), name="admin-theme-detail"),
    path(
        "admin/themes/<int:theme_id>/characters",
        AdminCharacterListCreateView.as_view(),
        name="admin-character-list",
    ),
    path(
        "admin/characters/<int:character_id>",
        AdminCharacterDetailView.as_view(),
        name="admin-character-detail",
    ),
    path("admin/upload-image", AdminImageUploadView.as_view(), name="admin-upload-image"),
]
