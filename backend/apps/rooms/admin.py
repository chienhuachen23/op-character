from django.contrib import admin

from .models import (
    AuthorHintRating,
    Hint,
    HintRating,
    Match,
    MatchPlayerAssignment,
    MatchScore,
    Player,
    ReplayVote,
    Room,
    Round,
    RoundScore,
    Guess,
    GuessVote,
)


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("room_code", "status", "game_type", "created_at")


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ("display_name", "room", "seat_index", "is_host", "is_connected")


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ("room", "match_number", "status", "started_at")


admin.site.register(MatchPlayerAssignment)
admin.site.register(Round)
admin.site.register(Hint)
admin.site.register(Guess)
admin.site.register(GuessVote)
admin.site.register(HintRating)
admin.site.register(AuthorHintRating)
admin.site.register(RoundScore)
admin.site.register(MatchScore)
admin.site.register(ReplayVote)
