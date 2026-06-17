from django.test import TestCase

from apps.catalog.images import pick_character_image
from apps.catalog.models import Character, CharacterImage, GameMode, Theme
from apps.games.trait_guess.engine import CharacterAssigner
from apps.rooms.models import GameType, MatchPlayerAssignment
from apps.rooms.services.room_service import create_room, join_room, start_game


class CharacterImageTest(TestCase):
    def setUp(self):
        game_mode = GameMode.objects.create(
            slug="trait_guess", name_zh="测试", name_en="Test", is_active=True
        )
        theme = Theme.objects.create(
            game_mode=game_mode, slug="one_piece", name_zh="海贼王", name_en="One Piece"
        )
        self.character = Character.objects.create(
            theme=theme,
            name_zh="路飞",
            name_en="Luffy",
            image_url="/legacy.jpg",
            is_active=True,
        )
        CharacterImage.objects.create(
            character=self.character, image_url="/media/a.jpg", sort_order=0
        )
        CharacterImage.objects.create(
            character=self.character, image_url="/media/b.jpg", sort_order=1
        )

    def test_pick_character_image_uses_gallery(self):
        picked = {pick_character_image(self.character) for _ in range(20)}
        self.assertTrue(picked.issubset({"/media/a.jpg", "/media/b.jpg"}))
        self.assertGreater(len(picked), 1)

    def test_assignment_stores_random_display_image(self):
        Character.objects.filter(theme=self.character.theme).exclude(id=self.character.id).delete()
        for i, url in enumerate(["/media/c.jpg", "/media/d.jpg"]):
            extra = Character.objects.create(
                theme=self.character.theme,
                name_zh=f"角色{i}",
                name_en=f"Char{i}",
                image_url=url,
                is_active=True,
            )
            CharacterImage.objects.create(character=extra, image_url=url, sort_order=0)

        room, host = create_room(
            "trait_guess",
            "one_piece",
            GameType.COOPERATIVE,
            "Host",
            "zh",
            {"total_rounds": 1, "target_rounds": 1, "early_win_enabled": True},
        )
        room, _ = join_room(room.room_code, "P2", "en")
        room, _ = join_room(room.room_code, "P3", "zh")
        match = start_game(room, host)

        for assignment in match.assignments.select_related("character"):
            if assignment.character_id == self.character.id:
                self.assertIn(
                    assignment.display_image_url,
                    {"/media/a.jpg", "/media/b.jpg"},
                )
                break
        else:
            self.fail("Luffy was not assigned in this match")

        CharacterAssigner.assign(match)
        assignment = match.assignments.get(character=self.character)
        self.assertIn(
            assignment.display_image_url,
            {"/media/a.jpg", "/media/b.jpg"},
        )

    def test_upload_preserves_legacy_image_in_gallery(self):
        self.character.images.all().delete()
        self.character.image_url = "/media/legacy-only.jpg"
        self.character.save(update_fields=["image_url"])

        from apps.catalog.images import ensure_legacy_image_in_gallery

        ensure_legacy_image_in_gallery(self.character)
        CharacterImage.objects.create(
            character=self.character,
            image_url="/media/new.jpg",
            sort_order=self.character.images.count(),
        )

        urls = list(self.character.images.order_by("sort_order").values_list("image_url", flat=True))
        self.assertEqual(len(urls), 2)
        self.assertIn("/media/legacy-only.jpg", urls)
        self.assertIn("/media/new.jpg", urls)

    def test_seed_legacy_image_not_copied_into_gallery(self):
        self.character.images.all().delete()
        self.character.image_url = "/characters/one_piece/luffy.svg"
        self.character.save(update_fields=["image_url"])

        from apps.catalog.images import ensure_legacy_image_in_gallery, usable_admin_image_count

        ensure_legacy_image_in_gallery(self.character)
        self.assertEqual(self.character.images.count(), 0)
        self.assertEqual(usable_admin_image_count(self.character), 0)
