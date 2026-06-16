from django.test import TestCase
from rest_framework.test import APIClient

from apps.catalog.models import Character, GameMode, Theme


class RoomAPITest(TestCase):
    def setUp(self):
        game_mode = GameMode.objects.create(
            slug="trait_guess", name_zh="测试", name_en="Test", is_active=True
        )
        theme = Theme.objects.create(game_mode=game_mode, slug="one_piece", name_zh="海贼王", name_en="One Piece")
        for i in range(5):
            Character.objects.create(
                theme=theme, name_zh=f"角色{i}", name_en=f"Char{i}", image_url=f"/c{i}.svg"
            )
        self.client = APIClient()

    def test_create_room_api(self):
        res = self.client.post("/api/v1/rooms", {
            "game_mode": "trait_guess",
            "theme": "one_piece",
            "game_type": "cooperative",
            "display_name": "Host",
            "language": "zh",
            "settings": {"total_rounds": 3, "target_rounds": 2, "early_win_enabled": True},
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertIn("room", res.data)
        self.assertIn("player", res.data)
        self.assertEqual(len(res.data["room"]["code"]), 6)

    def test_game_modes_list(self):
        res = self.client.get("/api/v1/game-modes")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
