from django.core.management.base import BaseCommand

from apps.catalog.models import Character, GameMode, Theme

ONE_PIECE_CHARACTERS = [
    ("路飞", "Luffy", "luffy"),
    ("索隆", "Zoro", "zoro"),
    ("娜美", "Nami", "nami"),
    ("乌索普", "Usopp", "usopp"),
    ("山治", "Sanji", "sanji"),
    ("乔巴", "Chopper", "chopper"),
    ("罗宾", "Robin", "robin"),
    ("弗兰奇", "Franky", "franky"),
    ("布鲁克", "Brook", "brook"),
    ("甚平", "Jinbe", "jinbe"),
    ("艾斯", "Ace", "ace"),
    ("萨博", "Sabo", "sabo"),
    ("卡普", "Garp", "garp"),
    ("战国", "Sengoku", "sengoku"),
    ("赤犬", "Akainu", "akainu"),
    ("黄猿", "Kizaru", "kizaru"),
    ("青雉", "Aokiji", "aokiji"),
    ("藤虎", "Fujitora", "fujitora"),
    ("绿牛", "Ryokugyu", "ryokugyu"),
    ("香克斯", "Shanks", "shanks"),
    ("白胡子", "Whitebeard", "whitebeard"),
    ("黑胡子", "Blackbeard", "blackbeard"),
    ("凯多", "Kaido", "kaido"),
    ("大妈", "Big Mom", "bigmom"),
    ("多弗朗明哥", "Doflamingo", "doflamingo"),
    ("克洛克达尔", "Crocodile", "crocodile"),
    ("莫利亚", "Moria", "moria"),
    ("汉库克", "Hancock", "hancock"),
    ("罗", "Law", "law"),
    ("基德", "Kid", "kid"),
    ("巴基", "Buggy", "buggy"),
    ("雷利", "Rayleigh", "rayleigh"),
    ("御田", "Oden", "oden"),
    ("大和", "Yamato", "yamato"),
]


class Command(BaseCommand):
    help = "Seed game mode, One Piece theme, and characters"

    def handle(self, *args, **options):
        game_mode, _ = GameMode.objects.update_or_create(
            slug="trait_guess",
            defaults={
                "name_zh": "人物共性猜谜",
                "name_en": "Trait Guess",
                "is_active": True,
                "config_schema": {},
            },
        )
        theme, _ = Theme.objects.update_or_create(
            game_mode=game_mode,
            slug="one_piece",
            defaults={
                "name_zh": "海贼王",
                "name_en": "One Piece",
            },
        )
        created = 0
        for name_zh, name_en, slug in ONE_PIECE_CHARACTERS:
            _, was_created = Character.objects.update_or_create(
                theme=theme,
                name_en=name_en,
                defaults={
                    "name_zh": name_zh,
                    "image_url": f"/characters/one_piece/{slug}.svg",
                    "is_active": True,
                },
            )
            if was_created:
                created += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded game mode, theme, and {len(ONE_PIECE_CHARACTERS)} characters ({created} new)"
            )
        )
