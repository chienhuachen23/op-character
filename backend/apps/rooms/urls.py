from django.urls import path

from .views import (
    CreateRoomView,
    JoinRoomView,
    RoomDetailView,
    RoomPreviewView,
    StartRoomView,
    UpdatePlayerView,
)

urlpatterns = [
    path("rooms", CreateRoomView.as_view(), name="room-create"),
    path("rooms/join", JoinRoomView.as_view(), name="room-join"),
    path("rooms/<str:code>/preview", RoomPreviewView.as_view(), name="room-preview"),
    path("rooms/<str:code>", RoomDetailView.as_view(), name="room-detail"),
    path("rooms/<str:code>/start", StartRoomView.as_view(), name="room-start"),
    path("players/me", UpdatePlayerView.as_view(), name="player-update"),
]
