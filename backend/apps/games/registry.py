from apps.games.trait_guess.engine import TraitGuessEngine

GAME_ENGINES = {
    "trait_guess": TraitGuessEngine,
}


def get_engine_for_room(room):
    slug = room.game_mode.slug
    engine_cls = GAME_ENGINES.get(slug)
    if not engine_cls:
        raise ValueError(f"No engine for game mode: {slug}")
    return engine_cls()
