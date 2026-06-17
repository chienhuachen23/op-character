from rest_framework import serializers

from .models import Character, CharacterImage, GameMode, Theme


class AdminCharacterImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CharacterImage
        fields = ["id", "image_url", "sort_order"]


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
    images = AdminCharacterImageSerializer(many=True, read_only=True)
    image_count = serializers.SerializerMethodField()

    class Meta:
        model = Character
        fields = ["id", "name_zh", "name_en", "image_url", "images", "image_count", "is_active"]

    def get_image_count(self, obj):
        return obj.images.count()


class AdminCharacterWriteSerializer(serializers.ModelSerializer):
    image_url = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = Character
        fields = ["name_zh", "name_en", "image_url", "is_active"]

    def validate_image_url(self, value):
        return (value or "").strip()


class AdminCharacterImportRowSerializer(serializers.Serializer):
    name_zh = serializers.CharField(max_length=100)
    name_en = serializers.CharField(max_length=100)


class AdminCharacterBulkImportSerializer(serializers.Serializer):
    characters = AdminCharacterImportRowSerializer(many=True)

    def validate_characters(self, value):
        if not value:
            raise serializers.ValidationError("At least one character row is required.")
        return value
