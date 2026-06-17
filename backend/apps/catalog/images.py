import random

from .models import Character

SEED_IMAGE_PREFIX = "/characters/one_piece/"


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
