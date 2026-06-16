from rest_framework import serializers

from apps.rooms.models import Player, Room


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = [
            "id",
            "display_name",
            "seat_index",
            "is_host",
            "language",
            "is_connected",
        ]


class RoomSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source="room_code")
    players = PlayerSerializer(many=True, read_only=True)
    share_url = serializers.SerializerMethodField()
    game_mode = serializers.CharField(source="game_mode.slug", read_only=True)
    theme = serializers.CharField(source="theme.slug", read_only=True)
    current_match_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Room
        fields = [
            "code",
            "status",
            "game_type",
            "game_mode",
            "theme",
            "settings",
            "players",
            "share_url",
            "current_match_id",
        ]

    def get_share_url(self, obj):
        return f"/room/{obj.room_code}"


class PlayerTokenSerializer(serializers.ModelSerializer):
    token = serializers.UUIDField(read_only=True)

    class Meta:
        model = Player
        fields = ["id", "token", "seat_index", "display_name", "language", "is_host"]


class CreateRoomSerializer(serializers.Serializer):
    game_mode = serializers.CharField()
    theme = serializers.CharField()
    game_type = serializers.ChoiceField(choices=["cooperative", "competitive"])
    display_name = serializers.CharField(max_length=32)
    language = serializers.ChoiceField(choices=["zh", "en"], default="zh")
    settings = serializers.JSONField()


class JoinRoomSerializer(serializers.Serializer):
    room_code = serializers.CharField(max_length=6)
    display_name = serializers.CharField(max_length=32)
    language = serializers.ChoiceField(choices=["zh", "en"], default="zh")


class UpdatePlayerSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=32, required=False)
    language = serializers.ChoiceField(choices=["zh", "en"], required=False)
