from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from django.conf import settings

from apps.core.exceptions import GameAPIException
from apps.rooms.models import Room, RoomStatus
from apps.rooms.permissions import PlayerTokenPermission
from apps.rooms.serializers import (
    CreateRoomSerializer,
    JoinRoomSerializer,
    PlayerSerializer,
    PlayerTokenSerializer,
    RoomSerializer,
    UpdatePlayerSerializer,
)
from apps.rooms.services.room_service import create_room, join_room, start_game


class CreateRoomView(APIView):
    def post(self, request):
        serializer = CreateRoomSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        room, player = create_room(
            game_mode_slug=data["game_mode"],
            theme_slug=data["theme"],
            game_type=data["game_type"],
            display_name=data["display_name"],
            language=data["language"],
            settings_data=data["settings"],
        )
        return Response(
            {
                "room": RoomSerializer(room).data,
                "player": PlayerTokenSerializer(player).data,
            },
            status=status.HTTP_201_CREATED,
        )


class JoinRoomView(APIView):
    def post(self, request):
        serializer = JoinRoomSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        room, player = join_room(
            room_code=data["room_code"],
            display_name=data["display_name"],
            language=data["language"],
        )
        return Response(
            {
                "room": RoomSerializer(room).data,
                "player": PlayerTokenSerializer(player).data,
            },
            status=status.HTTP_200_OK,
        )


class RoomPreviewView(APIView):
    """Public room info for share links (no auth)."""

    def get(self, request, code):
        try:
            room = Room.objects.prefetch_related("players").get(room_code=code.upper())
        except Room.DoesNotExist:
            raise GameAPIException("ROOM_NOT_FOUND", "Room not found", 404)

        players = room.players.order_by("seat_index")
        joinable = room.status == RoomStatus.WAITING and players.count() < settings.MAX_PLAYERS_PER_ROOM

        return Response(
            {
                "code": room.room_code,
                "status": room.status,
                "game_type": room.game_type,
                "joinable": joinable,
                "player_count": players.count(),
                "max_players": settings.MAX_PLAYERS_PER_ROOM,
                "players": PlayerSerializer(players, many=True).data,
            }
        )


class RoomDetailView(APIView):
    permission_classes = [PlayerTokenPermission]

    def get(self, request, code):
        room = request.room
        if room.room_code != code.upper():
            raise GameAPIException("ROOM_MISMATCH", "Room code mismatch", 403)
        return Response(RoomSerializer(room).data)


class UpdatePlayerView(APIView):
    permission_classes = [PlayerTokenPermission]

    def patch(self, request):
        serializer = UpdatePlayerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        player = request.player
        data = serializer.validated_data
        if "display_name" in data:
            player.display_name = data["display_name"]
        if "language" in data:
            player.language = data["language"]
        player.save()
        return Response(PlayerTokenSerializer(player).data)


class StartRoomView(APIView):
    permission_classes = [PlayerTokenPermission]

    def post(self, request, code):
        room = request.room
        if room.room_code != code.upper():
            raise GameAPIException("ROOM_MISMATCH", "Room code mismatch", 403)
        match = start_game(room, request.player)
        return Response({"match_id": match.id, "room": RoomSerializer(room).data})
