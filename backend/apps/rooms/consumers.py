import json

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from apps.rooms.models import Player


class RoomConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_code = self.scope["url_route"]["kwargs"]["room_code"].upper()
        self.group_name = f"room_{self.room_code}"
        self.player = None

        token = self.scope["query_string"].decode().split("token=")
        if len(token) < 2:
            await self.close()
            return
        player_token = token[1].split("&")[0]

        self.player = await self.get_player(player_token)
        if not self.player or self.player.room.room_code != self.room_code:
            await self.close()
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.set_connected(self.player.id, True)
        await self.broadcast_player_connected(self.player.id, True)

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if self.player:
            await self.set_connected(self.player.id, False)
            await self.broadcast_player_connected(self.player.id, False)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get("type") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def room_message(self, event):
        await self.send(
            text_data=json.dumps(
                {"type": event["event_type"], "payload": event.get("payload", {})}
            )
        )

    @database_sync_to_async
    def get_player(self, token):
        try:
            return Player.objects.select_related("room").get(token=token)
        except Player.DoesNotExist:
            return None

    @database_sync_to_async
    def set_connected(self, player_id, connected):
        Player.objects.filter(id=player_id).update(is_connected=connected)

    async def broadcast_player_connected(self, player_id, connected):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "room.message",
                "event_type": "player.connected",
                "payload": {"player_id": player_id, "is_connected": connected},
            },
        )
