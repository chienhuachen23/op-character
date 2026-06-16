from rest_framework import serializers

from .models import Character, GameMode, Theme


class GameModeSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameMode
        fields = ["slug", "name_zh", "name_en", "is_active", "config_schema"]


class ThemeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Theme
        fields = ["slug", "name_zh", "name_en"]


class CharacterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Character
        fields = ["id", "name_zh", "name_en", "image_url"]
