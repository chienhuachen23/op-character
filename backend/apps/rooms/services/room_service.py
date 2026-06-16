from django.conf import settings
from django.db import transaction

from apps.catalog.models import GameMode, Theme
from apps.core.exceptions import GameAPIException
from apps.core.utils import generate_room_code
from apps.games.registry import get_engine_for_room
from apps.rooms.models import GameType, Match, MatchStatus, Player, Room, RoomStatus
from apps.rooms.services.broadcast import broadcast_room_update


def validate_settings(game_type: str, settings_data: dict):
    if game_type == GameType.COOPERATIVE:
        total = settings_data.get("total_rounds", 0)
        target = settings_data.get("target_rounds", 0)
        if total < 1 or target < 1 or target > total:
            raise GameAPIException(
                "INVALID_SETTINGS",
                "total_rounds and target_rounds must be positive and target <= total",
            )
    elif game_type == GameType.COMPETITIVE:
        end_condition = settings_data.get("end_condition", "rounds")
        if end_condition == "rounds":
            if settings_data.get("max_rounds", 0) < 1:
                raise GameAPIException("INVALID_SETTINGS", "max_rounds must be at least 1")
        elif end_condition == "score":
            if settings_data.get("target_score", 0) < 1:
                raise GameAPIException("INVALID_SETTINGS", "target_score must be at least 1")
        else:
            raise GameAPIException("INVALID_SETTINGS", "Invalid end_condition")
        scoring = settings_data.get("scoring", {})
        if not scoring:
            raise GameAPIException("INVALID_SETTINGS", "scoring settings required")
    else:
        raise GameAPIException("INVALID_GAME_TYPE", "Invalid game type")


def create_room(game_mode_slug, theme_slug, game_type, display_name, language, settings_data):
    try:
        game_mode = GameMode.objects.get(slug=game_mode_slug, is_active=True)
    except GameMode.DoesNotExist:
        raise GameAPIException("INVALID_GAME_MODE", "Game mode not found", 404)

    try:
        theme = Theme.objects.get(slug=theme_slug, game_mode=game_mode)
    except Theme.DoesNotExist:
        raise GameAPIException("INVALID_THEME", "Theme not found", 404)

    validate_settings(game_type, settings_data)

    with transaction.atomic():
        for _ in range(10):
            code = generate_room_code()
            if not Room.objects.filter(room_code=code).exists():
                break
        else:
            raise GameAPIException("ROOM_CREATE_FAILED", "Could not generate room code", 500)

        room = Room.objects.create(
            room_code=code,
            game_mode=game_mode,
            theme=theme,
            game_type=game_type,
            settings=settings_data,
            status=RoomStatus.WAITING,
        )
        player = Player.objects.create(
            room=room,
            display_name=display_name,
            language=language,
            seat_index=0,
            is_host=True,
        )
        room.host_player = player
        room.save(update_fields=["host_player"])

    broadcast_room_update(room)
    return room, player


def join_room(room_code, display_name, language):
    try:
        room = Room.objects.select_related("game_mode", "theme").get(room_code=room_code.upper())
    except Room.DoesNotExist:
        raise GameAPIException("ROOM_NOT_FOUND", "Room not found", 404)

    if room.status != RoomStatus.WAITING:
        raise GameAPIException("ROOM_NOT_JOINABLE", "Room is not accepting players")

    player_count = room.players.count()
    if player_count >= settings.MAX_PLAYERS_PER_ROOM:
        raise GameAPIException("ROOM_FULL", "Room is full", 409)

    taken_seats = set(room.players.values_list("seat_index", flat=True))
    seat_index = next(i for i in range(settings.MAX_PLAYERS_PER_ROOM) if i not in taken_seats)

    player = Player.objects.create(
        room=room,
        display_name=display_name,
        language=language,
        seat_index=seat_index,
        is_host=False,
    )
    broadcast_room_update(room)
    return room, player


def start_game(room: Room, host_player: Player):
    if not host_player.is_host:
        raise GameAPIException("NOT_HOST", "Only host can start the game", 403)
    if room.status != RoomStatus.WAITING:
        raise GameAPIException("INVALID_STATE", "Game already started")
    if room.players.count() < settings.MAX_PLAYERS_PER_ROOM:
        raise GameAPIException("NOT_ENOUGH_PLAYERS", "Need 3 players to start")

    with transaction.atomic():
        match = Match.objects.create(
            room=room,
            match_number=1,
            settings_snapshot=room.settings,
            status=MatchStatus.ACTIVE,
        )
        room.current_match = match
        room.status = RoomStatus.PLAYING
        room.save(update_fields=["current_match", "status"])

        engine = get_engine_for_room(room)
        engine.start_match(match)

    return match
