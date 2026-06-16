from rest_framework import serializers

from .models import Character, GameMode, Theme


class AdminThemeSerializer(serializers.ModelSerializer):
    game_mode_slug = serializers.SlugField(source="game_mode.slug", read_only=True)
    character_count = serializers.SerializerMethodField()

    class Meta:
        model = Theme
        fields = [
            "id",
            "slug",
            "name_zh",
            "name_en",
            "game_mode_slug",
            "character_count",
        ]

    def get_character_count(self, obj):
        return obj.characters.filter(is_active=True).count()


class AdminThemeWriteSerializer(serializers.ModelSerializer):
    game_mode = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=GameMode.objects.all(),
        default="trait_guess",
    )

    class Meta:
        model = Theme
        fields = ["slug", "name_zh", "name_en", "game_mode"]

    def validate_slug(self, value):
        return value.strip().lower()


class AdminCharacterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Character
        fields = ["id", "name_zh", "name_en", "image_url", "is_active"]


class AdminCharacterWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Character
        fields = ["name_zh", "name_en", "image_url", "is_active"]

    def validate_image_url(self, value):
        return (value or "").strip()
