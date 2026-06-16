import os
import uuid

from django.core.files.storage import default_storage
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import GameAPIException

from .admin_serializers import (
    AdminCharacterBulkImportSerializer,
    AdminCharacterSerializer,
    AdminCharacterWriteSerializer,
    AdminThemeSerializer,
    AdminThemeWriteSerializer,
)
from .models import Character, Theme
from .permissions import AdminAPIKeyPermission


class AdminAuthVerifyView(APIView):
    permission_classes = [AdminAPIKeyPermission]

    def post(self, request):
        return Response({"ok": True})


class AdminThemeListCreateView(APIView):
    permission_classes = [AdminAPIKeyPermission]

    def get(self, request):
        themes = Theme.objects.select_related("game_mode").order_by("name_en")
        return Response(AdminThemeSerializer(themes, many=True).data)

    def post(self, request):
        serializer = AdminThemeWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        theme = serializer.save()
        return Response(AdminThemeSerializer(theme).data, status=201)


class AdminThemeDetailView(APIView):
    permission_classes = [AdminAPIKeyPermission]

    def get_object(self, theme_id):
        theme = Theme.objects.select_related("game_mode").filter(id=theme_id).first()
        if not theme:
            raise GameAPIException("NOT_FOUND", "Theme not found", 404)
        return theme

    def get(self, request, theme_id):
        return Response(AdminThemeSerializer(self.get_object(theme_id)).data)

    def patch(self, request, theme_id):
        theme = self.get_object(theme_id)
        serializer = AdminThemeWriteSerializer(theme, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        theme = serializer.save()
        return Response(AdminThemeSerializer(theme).data)


class AdminCharacterListCreateView(APIView):
    permission_classes = [AdminAPIKeyPermission]

    def get_theme(self, theme_id):
        theme = Theme.objects.filter(id=theme_id).first()
        if not theme:
            raise GameAPIException("NOT_FOUND", "Theme not found", 404)
        return theme

    def get(self, request, theme_id):
        theme = self.get_theme(theme_id)
        characters = theme.characters.order_by("name_en")
        return Response(AdminCharacterSerializer(characters, many=True).data)

    def post(self, request, theme_id):
        theme = self.get_theme(theme_id)
        serializer = AdminCharacterWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        character = Character.objects.create(theme=theme, **serializer.validated_data)
        return Response(AdminCharacterSerializer(character).data, status=201)


class AdminCharacterBulkImportView(APIView):
    permission_classes = [AdminAPIKeyPermission]

    def get_theme(self, theme_id):
        theme = Theme.objects.filter(id=theme_id).first()
        if not theme:
            raise GameAPIException("NOT_FOUND", "Theme not found", 404)
        return theme

    def post(self, request, theme_id):
        theme = self.get_theme(theme_id)
        serializer = AdminCharacterBulkImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        created = []
        skipped = []
        for index, row in enumerate(serializer.validated_data["characters"], start=1):
            name_zh = row["name_zh"].strip()
            name_en = row["name_en"].strip()
            if not name_zh or not name_en:
                skipped.append(
                    {
                        "row": index,
                        "message": "Both Chinese and English names are required.",
                    }
                )
                continue
            character = Character.objects.create(
                theme=theme,
                name_zh=name_zh,
                name_en=name_en,
                image_url="",
                is_active=True,
            )
            created.append(AdminCharacterSerializer(character).data)

        return Response(
            {
                "created": len(created),
                "skipped": len(skipped),
                "characters": created,
                "errors": skipped,
            },
            status=201,
        )


class AdminCharacterDetailView(APIView):
    permission_classes = [AdminAPIKeyPermission]

    def get_character(self, character_id):
        character = Character.objects.select_related("theme").filter(id=character_id).first()
        if not character:
            raise GameAPIException("NOT_FOUND", "Character not found", 404)
        return character

    def patch(self, request, character_id):
        character = self.get_character(character_id)
        serializer = AdminCharacterWriteSerializer(character, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        character = serializer.save()
        return Response(AdminCharacterSerializer(character).data)

    def delete(self, request, character_id):
        character = self.get_character(character_id)
        character.delete()
        return Response(status=204)


class AdminImageUploadView(APIView):
    permission_classes = [AdminAPIKeyPermission]

    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}

    def post(self, request):
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise GameAPIException("INVALID_REQUEST", "No file uploaded", 400)

        theme_slug = (request.data.get("theme_slug") or "misc").strip().lower()
        ext = os.path.splitext(uploaded.name)[1].lower()
        if ext not in self.ALLOWED_EXTENSIONS:
            raise GameAPIException(
                "INVALID_FILE",
                f"Unsupported file type. Allowed: {', '.join(sorted(self.ALLOWED_EXTENSIONS))}",
                400,
            )

        filename = f"{uuid.uuid4().hex}{ext}"
        path = default_storage.save(f"characters/{theme_slug}/{filename}", uploaded)
        url = default_storage.url(path)
        return Response({"url": url})
