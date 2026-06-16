from rest_framework import generics

from .models import GameMode, Theme
from .serializers import GameModeSerializer, ThemeSerializer


class GameModeListView(generics.ListAPIView):
    queryset = GameMode.objects.filter(is_active=True)
    serializer_class = GameModeSerializer


class ThemeListView(generics.ListAPIView):
    serializer_class = ThemeSerializer

    def get_queryset(self):
        return Theme.objects.filter(game_mode__slug=self.kwargs["slug"], game_mode__is_active=True)
