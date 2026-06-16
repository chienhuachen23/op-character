from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _room_group_name(room_code: str) -> str:
    return f"room_{room_code}"


def broadcast_room_update(room):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    from apps.rooms.serializers import RoomSerializer

    data = RoomSerializer(room).data
    async_to_sync(channel_layer.group_send)(
        _room_group_name(room.room_code),
        {"type": "room.message", "event_type": "room.updated", "payload": data},
    )


def broadcast_match_update(room):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    async_to_sync(channel_layer.group_send)(
        _room_group_name(room.room_code),
        {
            "type": "room.message",
            "event_type": "match.updated",
            "payload": {"room_code": room.room_code, "match_id": room.current_match_id},
        },
    )


def broadcast_phase_changed(room, phase: str, round_number: int):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    async_to_sync(channel_layer.group_send)(
        _room_group_name(room.room_code),
        {
            "type": "room.message",
            "event_type": "round.phase_changed",
            "payload": {"phase": phase, "round": round_number},
        },
    )


def broadcast_game_over(room, match):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    async_to_sync(channel_layer.group_send)(
        _room_group_name(room.room_code),
        {
            "type": "room.message",
            "event_type": "game.over",
            "payload": {"match_id": match.id, "result": match.result},
        },
    )
