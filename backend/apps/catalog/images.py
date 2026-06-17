import random

from .models import Character, CharacterImage

SEED_IMAGE_PREFIX = "/characters/one_piece/"


def is_usable_admin_image_url(url: str) -> bool:
    trimmed = (url or "").strip()
    if not trimmed:
        return False
    return not trimmed.startswith(SEED_IMAGE_PREFIX)


def usable_admin_image_count(character: Character) -> int:
    return sum(
        1
        for url in character.images.values_list("image_url", flat=True)
        if is_usable_admin_image_url(url)
    )


def usable_admin_image_urls(character: Character) -> list[str]:
    return [
        url.strip()
        for url in character.images.order_by("sort_order", "id").values_list("image_url", flat=True)
        if is_usable_admin_image_url(url)
    ]


def ensure_legacy_image_in_gallery(character: Character) -> None:
    legacy = (character.image_url or "").strip()
    if not legacy or not is_usable_admin_image_url(legacy):
        return
    if character.images.filter(image_url=legacy).exists():
        return
    CharacterImage.objects.create(
        character=character,
        image_url=legacy,
        sort_order=character.images.count(),
    )


def character_image_urls(character: Character) -> list[str]:
    urls = list(
        character.images.order_by("sort_order", "id").values_list("image_url", flat=True)
    )
    cleaned = [url.strip() for url in urls if url and url.strip()]
    if cleaned:
        return cleaned
    legacy = (character.image_url or "").strip()
    return [legacy] if legacy else []


def pick_character_image(character: Character) -> str:
    urls = character_image_urls(character)
    if not urls:
        return ""
    return random.choice(urls)


def assignment_display_image_url(assignment) -> str:
    stored = (assignment.display_image_url or "").strip()
    if stored:
        return stored
    if assignment.character_id:
        return (assignment.character.image_url or "").strip()
    return ""
