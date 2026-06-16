from django.contrib import admin

from .models import Character, GameMode, Theme


@admin.register(GameMode)
class GameModeAdmin(admin.ModelAdmin):
    list_display = ("slug", "name_en", "is_active")


@admin.register(Theme)
class ThemeAdmin(admin.ModelAdmin):
    list_display = ("slug", "name_en", "game_mode")


@admin.register(Character)
class CharacterAdmin(admin.ModelAdmin):
    list_display = ("name_en", "name_zh", "theme", "is_active")
    list_filter = ("theme",)
