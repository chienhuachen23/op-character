from rest_framework.permissions import BasePermission

from apps.core.exceptions import GameAPIException
from apps.rooms.models import Player


class PlayerTokenPermission(BasePermission):
    def has_permission(self, request, view):
        token = request.headers.get("X-Player-Token")
        if not token:
            raise GameAPIException("MISSING_TOKEN", "X-Player-Token header required", 401)
        try:
            player = Player.objects.select_related("room", "room__game_mode", "room__theme").get(
                token=token
            )
        except Player.DoesNotExist:
            raise GameAPIException("INVALID_TOKEN", "Invalid player token", 401)
        request.player = player
        request.room = player.room
        return True
