from django.db import models


class GameMode(models.Model):
    slug = models.SlugField(max_length=50, unique=True)
    name_zh = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    config_schema = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "game_modes"

    def __str__(self):
        return self.slug


class Theme(models.Model):
    game_mode = models.ForeignKey(GameMode, on_delete=models.CASCADE, related_name="themes")
    slug = models.SlugField(max_length=50)
    name_zh = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)

    class Meta:
        db_table = "themes"
        unique_together = [("game_mode", "slug")]

    def __str__(self):
        return self.slug


class Character(models.Model):
    theme = models.ForeignKey(Theme, on_delete=models.CASCADE, related_name="characters")
    name_zh = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    image_url = models.CharField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "characters"
        indexes = [
            models.Index(fields=["theme", "is_active"]),
        ]

    def __str__(self):
        return self.name_en


class CharacterImage(models.Model):
    character = models.ForeignKey(
        Character, on_delete=models.CASCADE, related_name="images"
    )
    image_url = models.CharField(max_length=500)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "character_images"
        ordering = ["sort_order", "id"]
        indexes = [
            models.Index(fields=["character", "sort_order"]),
        ]

    def __str__(self):
        return f"{self.character.name_en} #{self.id}"
