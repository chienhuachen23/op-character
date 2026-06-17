from django.db import models, transaction
from django.utils import timezone

from apps.catalog.images import assignment_display_image_url, pick_character_image
from apps.catalog.models import Character
from apps.core.exceptions import GameAPIException
from apps.games.base import GameEngine
from apps.rooms.models import (
    AuthorHintRating,
    CharacterRerollRequest,
    CharacterRerollStatus,
    GameType,
    Guess,
    GuessVerdict,
    GuessVote,
    Hint,
    HintRatingType,
    Match,
    MatchPlayerAssignment,
    MatchScore,
    MatchStatus,
    Player,
    ReplayVote,
    Room,
    RoomStatus,
    Round,
    RoundPhase,
    RoundScore,
)
from apps.rooms.services.broadcast import broadcast_game_over, broadcast_match_update, broadcast_room_update


class CharacterAssigner:
    @staticmethod
    def assign(match: Match):
        theme = match.room.theme
        characters = list(Character.objects.filter(theme=theme, is_active=True).order_by("?")[:3])
        if len(characters) < 3:
            raise GameAPIException("NOT_ENOUGH_CHARACTERS", "Not enough characters in theme", 500)
        players = list(match.room.players.order_by("seat_index"))
        for player, character in zip(players, characters):
            MatchPlayerAssignment.objects.update_or_create(
                match=match,
                player=player,
                defaults={
                    "character": character,
                    "display_image_url": pick_character_image(character),
                },
            )

    @staticmethod
    def reroll_for_player(match: Match, player: Player) -> Character:
        theme = match.room.theme
        assigned_ids = list(match.assignments.values_list("character_id", flat=True))
        assignment = match.assignments.get(player=player)
        candidates = list(
            Character.objects.filter(theme=theme, is_active=True)
            .exclude(id__in=assigned_ids)
            .order_by("?")
        )
        if not candidates:
            candidates = list(
                Character.objects.filter(theme=theme, is_active=True)
                .exclude(id=assignment.character_id)
                .order_by("?")
            )
        if not candidates:
            raise GameAPIException(
                "NOT_ENOUGH_CHARACTERS",
                "No alternative character available for reroll",
                500,
            )
        assignment.character = candidates[0]
        assignment.display_image_url = pick_character_image(candidates[0])
        assignment.save(update_fields=["character", "display_image_url"])
        return assignment.character


class ScoreCalculator:
    @staticmethod
    def settle_round(round_obj: Round):
        match = round_obj.match
        room = match.room
        if room.game_type != GameType.COMPETITIVE:
            return

        settings = match.settings_snapshot
        scoring = settings.get("scoring", {})
        correct_pts = scoring.get("correct_guess", 3)
        like_pts = scoring.get("hint_liked", 1)
        dislike_pts = scoring.get("hint_disliked", -1)

        players = list(room.players.all())
        for player in players:
            breakdown = {"correct_guess": 0, "hints_liked": 0, "hints_disliked": 0}
            points = 0

            guess = round_obj.guesses.filter(player=player).first()
            if guess and guess.verdict == GuessVerdict.CORRECT:
                breakdown["correct_guess"] = correct_pts
                points += correct_pts

            hints = round_obj.hints.filter(author_player=player)
            if hints.exists():
                ratings = AuthorHintRating.objects.filter(
                    round=round_obj, author_player=player
                )
                likes = ratings.filter(rating=HintRatingType.LIKE).count()
                dislikes = ratings.filter(rating=HintRatingType.DISLIKE).count()
                breakdown["hints_liked"] = likes * like_pts
                breakdown["hints_disliked"] = dislikes * dislike_pts
                points += likes * like_pts + dislikes * dislike_pts

            RoundScore.objects.update_or_create(
                round=round_obj,
                player=player,
                defaults={"points": points, "breakdown": breakdown},
            )

            match_score, _ = MatchScore.objects.get_or_create(match=match, player=player)
            total = (
                RoundScore.objects.filter(round__match=match, player=player).aggregate(
                    total=models.Sum("points")
                )["total"]
                or 0
            )
            match_score.total_points = total
            match_score.save()


class MatchResultBuilder:
    @staticmethod
    def _character_payload(char: Character, image_url: str | None = None) -> dict:
        return {
            "id": char.id,
            "name_zh": char.name_zh,
            "name_en": char.name_en,
            "image_url": image_url if image_url is not None else (char.image_url or ""),
        }

    @staticmethod
    def _assignment_character_payload(assignment: MatchPlayerAssignment) -> dict:
        return MatchResultBuilder._character_payload(
            assignment.character,
            assignment_display_image_url(assignment),
        )

    @staticmethod
    def _fallback_players_snapshot(match: Match, players: list[Player]) -> list[dict]:
        assignments = {
            a.player_id: a
            for a in match.assignments.select_related("character")
        }
        snapshot = []
        for player in players:
            assignment = assignments.get(player.id)
            snapshot.append(
                {
                    "player_id": player.id,
                    "display_name": player.display_name,
                    "seat_index": player.seat_index,
                    "character": (
                        MatchResultBuilder._assignment_character_payload(assignment)
                        if assignment
                        else None
                    ),
                }
            )
        return snapshot

    @staticmethod
    def _other_characters_for_author(author_id: int, round_players: list[dict]) -> list[dict]:
        others = sorted(
            [p for p in round_players if p["player_id"] != author_id],
            key=lambda p: p.get("seat_index", 0),
        )
        characters = []
        for player in others[:2]:
            char = player.get("character")
            if char:
                characters.append(
                    {"name_zh": char["name_zh"], "name_en": char["name_en"]}
                )
            else:
                characters.append({"name_zh": "?", "name_en": "?"})
        while len(characters) < 2:
            characters.append({"name_zh": "?", "name_en": "?"})
        return characters

    @staticmethod
    def _attach_hint_context(hint_authors: list[dict], round_players: list[dict]):
        for group in hint_authors:
            group["other_characters"] = MatchResultBuilder._other_characters_for_author(
                group["author_id"], round_players
            )

    @staticmethod
    def _build_round_entry(r: Round, room: Room, players: list[Player], match: Match) -> dict:
        round_players = list(r.assignments_snapshot or [])
        if not round_players or not any(p.get("character") for p in round_players):
            round_players = MatchResultBuilder._fallback_players_snapshot(match, players)

        hints_by_author: dict[int, dict] = {}
        for h in r.hints.select_related("author_player").order_by("created_at"):
            author_id = h.author_player_id
            if author_id not in hints_by_author:
                hints_by_author[author_id] = {
                    "author_id": author_id,
                    "author_name": h.author_player.display_name,
                    "contents": [],
                    "likes": 0,
                    "dislikes": 0,
                }
            hints_by_author[author_id]["contents"].append(h.content)

        for author_id, group in hints_by_author.items():
            group["likes"] = AuthorHintRating.objects.filter(
                round=r, author_player_id=author_id, rating=HintRatingType.LIKE
            ).count()
            group["dislikes"] = AuthorHintRating.objects.filter(
                round=r, author_player_id=author_id, rating=HintRatingType.DISLIKE
            ).count()

        hint_authors = []
        for player_data in sorted(round_players, key=lambda p: p.get("seat_index", 0)):
            author_id = player_data["player_id"]
            if author_id in hints_by_author:
                hint_authors.append(hints_by_author[author_id])
            else:
                hint_authors.append(
                    {
                        "author_id": author_id,
                        "author_name": player_data["display_name"],
                        "contents": [],
                        "likes": 0,
                        "dislikes": 0,
                    }
                )

        hint_authors.sort(key=lambda h: (-h["likes"], h["author_name"]))
        MatchResultBuilder._attach_hint_context(hint_authors, round_players)

        return {
            "round_number": r.round_number,
            "is_coop_success": r.is_coop_success,
            "phase": r.phase,
            "players": round_players,
            "hint_authors": hint_authors,
            "scores": {
                str(s.player_id): s.points for s in r.scores.all()
            }
            if room.game_type == GameType.COMPETITIVE
            else {},
        }

    @staticmethod
    def build(match: Match):
        room = match.room
        players = list(room.players.order_by("seat_index"))
        assignments = {
            a.player_id: a for a in match.assignments.select_related("character")
        }

        rounds_data = []
        for r in match.rounds.filter(phase=RoundPhase.COMPLETE).order_by("round_number"):
            rounds_data.append(MatchResultBuilder._build_round_entry(r, room, players, match))

        player_results = []
        for p in players:
            assignment = assignments.get(p.id)
            total_score = 0
            if room.game_type == GameType.COMPETITIVE:
                ms = MatchScore.objects.filter(match=match, player=p).first()
                total_score = ms.total_points if ms else 0
            player_results.append(
                {
                    "player_id": p.id,
                    "display_name": p.display_name,
                    "character": (
                        MatchResultBuilder._assignment_character_payload(assignment)
                        if assignment
                        else None
                    ),
                    "total_score": total_score,
                }
            )

        success_rounds = match.rounds.filter(is_coop_success=True).count()
        result = {
            "game_type": room.game_type,
            "players": player_results,
            "rounds": rounds_data,
            "ended_at": match.ended_at.isoformat() if match.ended_at else None,
        }

        if room.game_type == GameType.COOPERATIVE:
            settings = match.settings_snapshot
            target = settings.get("target_rounds", 1)
            total = settings.get("total_rounds", 1)
            won = success_rounds >= target
            result["coop"] = {
                "success_rounds": success_rounds,
                "target_rounds": target,
                "total_rounds": total,
                "won": won,
            }
        else:
            settings = match.settings_snapshot
            ranked = sorted(player_results, key=lambda x: x["total_score"], reverse=True)
            result["competitive"] = {
                "ranking": [p["player_id"] for p in ranked],
                "winner_id": ranked[0]["player_id"] if ranked else None,
                "end_condition": settings.get("end_condition", "rounds"),
            }

        return result


class TraitGuessEngine(GameEngine):
    def _get_current_round(self, match: Match) -> Round | None:
        return match.rounds.exclude(phase=RoundPhase.COMPLETE).order_by("-round_number").first()

    def _get_or_create_current_round(self, match: Match) -> Round:
        current = self._get_current_round(match)
        if current:
            return current
        round_number = match.rounds.count() + 1
        return Round.objects.create(match=match, round_number=round_number, phase=RoundPhase.HINTS)

    def _serialize_guess(self, guess: Guess) -> dict:
        return {
            "id": guess.id,
            "player_id": guess.player_id,
            "player_name": guess.player.display_name,
            "guess_text": guess.guess_text,
            "is_skipped": guess.is_skipped,
            "verdict": guess.verdict,
            "guess_history": list(guess.guess_history or []),
            "votes": [
                {"voter_id": v.voter_player_id, "is_correct": v.is_correct}
                for v in guess.votes.all()
            ],
        }

    @staticmethod
    def _append_guess_history(guess: Guess, text: str, verdict: str):
        if not text or not str(text).strip():
            return
        history = list(guess.guess_history or [])
        entry = {"text": str(text).strip(), "verdict": verdict}
        if history and history[-1] == entry:
            return
        history.append(entry)
        guess.guess_history = history

    def _format_hints_for_viewer(self, round_obj, viewer, room_players, assignments):
        hints = []
        players_by_id = {p.id: p for p in room_players}
        for h in round_obj.hints.select_related("author_player").order_by("created_at"):
            author_id = h.author_player_id
            base = {
                "id": h.id,
                "author_id": author_id,
                "author_name": h.author_player.display_name,
                "content": h.content,
                "created_at": h.created_at.isoformat(),
                "is_own": int(author_id) == int(viewer.id),
            }
            if int(author_id) == int(viewer.id):
                hints.append(base)
                continue

            other_player = next(
                (p for p in room_players if p.id not in (viewer.id, author_id)),
                None,
            )
            if not other_player:
                hints.append(base)
                continue

            other_char = assignments.get(other_player.id)
            base["other_player_id"] = other_player.id
            base["other_player_name"] = other_player.display_name
            if other_char:
                base["other_character"] = {
                    "name_zh": other_char.name_zh,
                    "name_en": other_char.name_en,
                }
            hints.append(base)
        return hints

    def _build_hint_rating_groups(self, round_obj, viewer, room_players, assignments):
        my_ratings = {
            r.author_player_id: r.rating
            for r in round_obj.author_hint_ratings.filter(rater_player=viewer)
        }
        groups: dict[int, dict] = {}
        for hint in self._format_hints_for_viewer(round_obj, viewer, room_players, assignments):
            if hint.get("is_own"):
                continue
            author_id = hint["author_id"]
            if author_id not in groups:
                groups[author_id] = {
                    "author_id": author_id,
                    "author_name": hint["author_name"],
                    "hints": [],
                    "my_rating": my_ratings.get(author_id),
                }
            groups[author_id]["hints"].append(hint)
        return list(groups.values())

    def _pending_guess_scores(self, round_obj: Round, match: Match) -> dict[str, int]:
        """Guess points for the current round only (excludes hint rating scores)."""
        correct_pts = match.settings_snapshot.get("scoring", {}).get("correct_guess", 3)
        pending: dict[str, int] = {}
        for guess in round_obj.guesses.all():
            pending[str(guess.player_id)] = (
                correct_pts if guess.verdict == GuessVerdict.CORRECT else 0
            )
        return pending

    def _is_round_active(self, round_obj: Round) -> bool:
        """Round is active while players can still hint/guess."""
        return round_obj.phase not in (
            RoundPhase.RATING,
            RoundPhase.SETTLEMENT,
            RoundPhase.COMPLETE,
        )

    def _all_players_terminal(self, round_obj: Round) -> bool:
        players = list(round_obj.match.room.players.all())
        pending_guesses = round_obj.guesses.filter(
            is_skipped=False, verdict=GuessVerdict.PENDING
        )
        for g in pending_guesses:
            if g.votes.count() < len(players) - 1:
                return False
        for p in players:
            g = round_obj.guesses.filter(player=p).first()
            if not g:
                return False
            if g.verdict not in (GuessVerdict.CORRECT, GuessVerdict.SKIPPED):
                return False
        return True

    def _normalize_round_phase(self, round_obj: Round):
        """Keep a single active phase; fix legacy judging/guessing/rating states."""
        if round_obj.phase in (RoundPhase.JUDGING, RoundPhase.GUESSING):
            round_obj.phase = RoundPhase.HINTS
            round_obj.save(update_fields=["phase"])
        elif round_obj.phase == RoundPhase.RATING and not self._all_players_terminal(round_obj):
            round_obj.phase = RoundPhase.HINTS
            round_obj.save(update_fields=["phase"])

    def _is_play_phase(self, round_obj: Round) -> bool:
        return self._is_round_active(round_obj)

    def _broadcast(self, match: Match):
        broadcast_match_update(match.room)
        broadcast_room_update(match.room)

    def start_match(self, match: Match):
        with transaction.atomic():
            CharacterAssigner.assign(match)
            Round.objects.create(match=match, round_number=1, phase=RoundPhase.HINTS)
            for player in match.room.players.all():
                if match.room.game_type == GameType.COMPETITIVE:
                    MatchScore.objects.get_or_create(match=match, player=player, defaults={"total_points": 0})
        self._broadcast(match)

    def get_state(self, match: Match, player: Player):
        room = match.room
        current_round = self._get_current_round(match)
        assignment_map = {
            a.player_id: a for a in match.assignments.select_related("character")
        }
        assignments = {player_id: a.character for player_id, a in assignment_map.items()}

        others = []
        for p in room.players.exclude(id=player.id).order_by("seat_index"):
            assignment = assignment_map.get(p.id)
            others.append(
                {
                    "player_id": p.id,
                    "display_name": p.display_name,
                    "seat_index": p.seat_index,
                    "is_connected": p.is_connected,
                    "character": (
                        MatchResultBuilder._assignment_character_payload(assignment)
                        if assignment
                        else None
                    ),
                }
            )

        hints = []
        guesses = []
        if current_round:
            self._normalize_round_phase(current_round)
            hints = self._format_hints_for_viewer(
                current_round, player, list(room.players.all()), assignments
            )
            guesses = []
            for g in current_round.guesses.select_related("player", "guessed_character"):
                guesses.append(self._serialize_guess(g))

        self_character = None
        if current_round:
            correct_guess = current_round.guesses.filter(
                player=player, verdict=GuessVerdict.CORRECT
            ).first()
            if correct_guess:
                assignment = assignment_map.get(player.id)
                if assignment:
                    self_character = MatchResultBuilder._assignment_character_payload(assignment)

        scores = {}
        if room.game_type == GameType.COMPETITIVE:
            for ms in match.match_scores.all():
                scores[str(ms.player_id)] = ms.total_points

        coop_info = None
        if room.game_type == GameType.COOPERATIVE:
            settings = match.settings_snapshot
            coop_info = {
                "success_rounds": match.rounds.filter(is_coop_success=True).count(),
                "total_rounds": settings.get("total_rounds", 1),
                "target_rounds": settings.get("target_rounds", 1),
                "early_win_enabled": settings.get("early_win_enabled", True),
            }

        replay_votes = {}
        if room.status == RoomStatus.REPLAY_PENDING:
            for rv in match.replay_votes.all():
                replay_votes[str(rv.player_id)] = rv.approved

        hint_rating_groups = []
        if current_round and current_round.phase == RoundPhase.RATING:
            hint_rating_groups = self._build_hint_rating_groups(
                current_round, player, list(room.players.all()), assignments
            )

        round_result = None
        if current_round and current_round.phase == RoundPhase.RATING:
            round_guesses = list(
                current_round.guesses.select_related("player").order_by("player__seat_index")
            )
            all_correct = bool(round_guesses) and all(
                g.verdict == GuessVerdict.CORRECT for g in round_guesses
            )
            round_result = {
                "guesses": [self._serialize_guess(g) for g in round_guesses],
                "is_coop_success": all_correct,
                "scores": scores if room.game_type == GameType.COMPETITIVE else None,
                "pending_scores": (
                    self._pending_guess_scores(current_round, match)
                    if room.game_type == GameType.COMPETITIVE
                    else None
                ),
            }

        return {
            "match_id": match.id,
            "match_status": match.status,
            "room_status": room.status,
            "game_type": room.game_type,
            "round": {
                "number": current_round.round_number if current_round else 0,
                "phase": current_round.phase if current_round else None,
                "id": current_round.id if current_round else None,
            },
            "self": {
                "player_id": player.id,
                "display_name": player.display_name,
                "language": player.language,
                "is_host": player.is_host,
                "character": self_character,
            },
            "others": others,
            "hints": hints,
            "guesses": guesses,
            "hint_rating_groups": hint_rating_groups,
            "round_result": round_result,
            "scores": scores,
            "coop": coop_info,
            "replay_votes": replay_votes,
            "players_ready_hints": self._players_ready_hints(current_round) if current_round else [],
            "character_reroll": self._serialize_character_reroll(current_round, player)
            if current_round
            else None,
        }

    def _get_third_player_id(self, round_obj: Round, player_a_id: int, player_b_id: int) -> int | None:
        for player in round_obj.match.room.players.all():
            if player.id not in (player_a_id, player_b_id):
                return player.id
        return None

    def _serialize_character_reroll(self, round_obj: Round, viewer: Player):
        if not round_obj or not self._is_round_active(round_obj):
            return None
        request = (
            CharacterRerollRequest.objects.filter(
                round=round_obj, status=CharacterRerollStatus.PENDING
            )
            .select_related("target_player", "requester_player")
            .first()
        )
        if not request:
            return None
        confirmer_id = self._get_third_player_id(
            round_obj, request.requester_player_id, request.target_player_id
        )
        return {
            "target_player_id": request.target_player_id,
            "target_player_name": request.target_player.display_name,
            "requester_player_id": request.requester_player_id,
            "requester_player_name": request.requester_player.display_name,
            "confirmer_player_id": confirmer_id,
            "status": request.status,
        }

    def _reset_player_guess_after_reroll(self, round_obj: Round, target_player: Player):
        Guess.objects.filter(round=round_obj, player=target_player).delete()

    def request_character_reroll(self, match: Match, requester: Player, target_player_id: int):
        current_round = self._get_current_round(match)
        if not current_round:
            raise GameAPIException("INVALID_PHASE", "No active round")
        self._normalize_round_phase(current_round)
        if not self._is_round_active(current_round):
            raise GameAPIException("INVALID_PHASE", "Round is not active")
        if requester.id == target_player_id:
            raise GameAPIException("INVALID_TARGET", "Cannot reroll your own character")
        target = match.room.players.filter(id=target_player_id).first()
        if not target:
            raise GameAPIException("INVALID_TARGET", "Target player not found", 404)
        if not match.assignments.filter(player=target).exists():
            raise GameAPIException("INVALID_TARGET", "Target player has no assignment", 400)
        if CharacterRerollRequest.objects.filter(
            round=current_round, status=CharacterRerollStatus.PENDING
        ).exists():
            raise GameAPIException("REROLL_PENDING", "Another character reroll is pending", 409)

        CharacterRerollRequest.objects.create(
            round=current_round,
            target_player=target,
            requester_player=requester,
            status=CharacterRerollStatus.PENDING,
        )
        self._broadcast(match)
        return self.get_state(match, requester)

    def confirm_character_reroll(
        self, match: Match, confirmer: Player, target_player_id: int, approved: bool
    ):
        current_round = self._get_current_round(match)
        if not current_round:
            raise GameAPIException("INVALID_PHASE", "No active round")
        self._normalize_round_phase(current_round)
        if not self._is_round_active(current_round):
            raise GameAPIException("INVALID_PHASE", "Round is not active")

        request = CharacterRerollRequest.objects.filter(
            round=current_round,
            target_player_id=target_player_id,
            status=CharacterRerollStatus.PENDING,
        ).select_related("target_player").first()
        if not request:
            raise GameAPIException("REROLL_NOT_FOUND", "No pending reroll for this player", 404)

        expected_confirmer_id = self._get_third_player_id(
            current_round, request.requester_player_id, request.target_player_id
        )
        if confirmer.id != expected_confirmer_id:
            raise GameAPIException("INVALID_CONFIRMER", "Only the third player can confirm reroll", 403)

        if approved:
            CharacterAssigner.reroll_for_player(match, request.target_player)
            self._reset_player_guess_after_reroll(current_round, request.target_player)
        request.delete()

        self._broadcast(match)
        return self.get_state(match, confirmer)

    def _players_ready_hints(self, round_obj: Round):
        if not round_obj or not self._is_round_active(round_obj):
            return []
        return list(
            round_obj.hints.values_list("author_player_id", flat=True).distinct()
        )

    def submit_hint(self, match: Match, player: Player, content: str):
        current_round = self._get_current_round(match)
        if not current_round:
            raise GameAPIException("INVALID_PHASE", "No active round")
        self._normalize_round_phase(current_round)
        if not self._is_round_active(current_round):
            raise GameAPIException("INVALID_PHASE", "Round is not active")
        if not content or not content.strip():
            raise GameAPIException("INVALID_HINT", "Hint content cannot be empty")
        Hint.objects.create(round=current_round, author_player=player, content=content.strip())
        self._broadcast(match)
        return self.get_state(match, player)

    def advance_hints_phase(self, match: Match, player: Player):
        # Guessing is allowed during hints; no manual advance needed.
        return self.get_state(match, player)

    def submit_guess(self, match: Match, player: Player, text=None, skip=False):
        current_round = self._get_current_round(match)
        if not current_round:
            raise GameAPIException("INVALID_PHASE", "No active round")
        self._normalize_round_phase(current_round)
        if not self._is_round_active(current_round):
            raise GameAPIException("INVALID_PHASE", "Round is not active")

        existing = Guess.objects.filter(round=current_round, player=player).first()

        if skip:
            if existing and existing.verdict == GuessVerdict.CORRECT:
                raise GameAPIException("ALREADY_GUESSED", "Already guessed correctly", 409)
            if existing:
                existing.is_skipped = True
                existing.verdict = GuessVerdict.SKIPPED
                existing.guess_text = ""
                existing.guessed_character = None
                existing.save()
                existing.votes.all().delete()
            else:
                Guess.objects.create(
                    round=current_round,
                    player=player,
                    is_skipped=True,
                    verdict=GuessVerdict.SKIPPED,
                    guess_history=[],
                )
        else:
            if not text or not str(text).strip():
                raise GameAPIException("INVALID_GUESS", "Guess text required")
            text = str(text).strip()

            if existing:
                if existing.verdict == GuessVerdict.CORRECT:
                    raise GameAPIException("ALREADY_GUESSED", "Already guessed correctly", 409)
                if existing.verdict == GuessVerdict.SKIPPED:
                    raise GameAPIException("ALREADY_GUESSED", "Already skipped guessing", 409)
                if existing.verdict == GuessVerdict.PENDING:
                    raise GameAPIException("GUESS_PENDING", "Wait for judgment on current guess", 409)
                existing.guess_text = text
                existing.verdict = GuessVerdict.PENDING
                existing.is_skipped = False
                existing.guessed_character = None
                existing.save()
                existing.votes.all().delete()
            else:
                Guess.objects.create(
                    round=current_round,
                    player=player,
                    guess_text=text,
                    verdict=GuessVerdict.PENDING,
                    guess_history=[],
                )

        self._check_round_completion(current_round)
        self._broadcast(match)
        return self.get_state(match, player)

    def _check_round_completion(self, round_obj: Round):
        if not self._is_round_active(round_obj):
            return
        if not self._all_players_terminal(round_obj):
            return
        round_obj.phase = RoundPhase.RATING
        round_obj.save(update_fields=["phase"])

    def _check_guessing_complete(self, round_obj: Round):
        self._check_round_completion(round_obj)

    def submit_guess_vote(self, guess: Guess, voter: Player, is_correct: bool):
        round_obj = guess.round
        self._normalize_round_phase(round_obj)
        if not self._is_round_active(round_obj):
            raise GameAPIException("INVALID_PHASE", "Round is not active")
        if guess.player_id == voter.id:
            raise GameAPIException("INVALID_VOTER", "Cannot vote on own guess")
        if guess.is_skipped:
            raise GameAPIException("INVALID_GUESS", "Guess was skipped")

        if GuessVote.objects.filter(guess=guess, voter_player=voter).exists():
            raise GameAPIException("ALREADY_VOTED", "Already voted", 409)

        GuessVote.objects.create(guess=guess, voter_player=voter, is_correct=is_correct)

        voters_needed = round_obj.match.room.players.count() - 1
        if guess.votes.count() >= voters_needed:
            votes = list(guess.votes.values_list("is_correct", flat=True))
            if all(votes) and len(votes) == voters_needed:
                guess.verdict = GuessVerdict.CORRECT
                self._append_guess_history(guess, guess.guess_text, GuessVerdict.CORRECT)
            else:
                guess.verdict = GuessVerdict.INCORRECT
                self._append_guess_history(guess, guess.guess_text, GuessVerdict.INCORRECT)
            guess.save(update_fields=["verdict", "guess_history"])

        self._check_round_completion(round_obj)
        self._broadcast(round_obj.match)
        return self.get_state(round_obj.match, voter)

    def _check_judging_complete(self, round_obj: Round):
        self._check_round_completion(round_obj)

    def submit_hint_rating(self, hint: Hint, rater: Player, rating: str):
        return self.submit_author_hint_rating(hint.round, hint.author_player, rater, rating)

    def submit_author_hint_rating(self, round_obj: Round, author: Player, rater: Player, rating: str):
        if round_obj.phase != RoundPhase.RATING:
            raise GameAPIException("INVALID_PHASE", "Not in rating phase")
        if author.id == rater.id:
            raise GameAPIException("INVALID_RATER", "Cannot rate own hints")
        if not round_obj.hints.filter(author_player=author).exists():
            raise GameAPIException("INVALID_AUTHOR", "Player has no hints to rate")
        if rating not in (HintRatingType.LIKE, HintRatingType.DISLIKE):
            raise GameAPIException("INVALID_RATING", "Invalid rating")

        AuthorHintRating.objects.update_or_create(
            round=round_obj,
            author_player=author,
            rater_player=rater,
            defaults={"rating": rating},
        )

        self._check_rating_complete(round_obj)
        self._broadcast(round_obj.match)
        return self.get_state(round_obj.match, rater)

    def _check_rating_complete(self, round_obj: Round):
        if round_obj.phase != RoundPhase.RATING:
            return
        players = list(round_obj.match.room.players.all())
        author_ids = list(
            round_obj.hints.values_list("author_player_id", flat=True).distinct()
        )
        if not author_ids:
            round_obj.phase = RoundPhase.SETTLEMENT
            round_obj.save(update_fields=["phase"])
            self._complete_settlement(round_obj)
            return

        raters_needed = len(players) - 1
        all_rated = True
        for author_id in author_ids:
            if (
                AuthorHintRating.objects.filter(
                    round=round_obj, author_player_id=author_id
                ).count()
                < raters_needed
            ):
                all_rated = False
                break
        if all_rated:
            round_obj.phase = RoundPhase.SETTLEMENT
            round_obj.save(update_fields=["phase"])
            self._complete_settlement(round_obj)

    def _snapshot_round_assignments(self, round_obj: Round):
        snapshot = []
        for assignment in round_obj.match.assignments.select_related("player", "character"):
            snapshot.append(
                {
                    "player_id": assignment.player_id,
                    "display_name": assignment.player.display_name,
                    "seat_index": assignment.player.seat_index,
                    "character": MatchResultBuilder._assignment_character_payload(assignment),
                }
            )
        snapshot.sort(key=lambda item: item["seat_index"])
        round_obj.assignments_snapshot = snapshot

    def _complete_settlement(self, round_obj: Round):
        match = round_obj.match
        room = match.room

        self._snapshot_round_assignments(round_obj)

        all_correct = all(
            g.verdict == GuessVerdict.CORRECT
            for g in round_obj.guesses.all()
        )
        round_obj.is_coop_success = all_correct
        round_obj.phase = RoundPhase.COMPLETE
        round_obj.ended_at = timezone.now()
        round_obj.save(
            update_fields=[
                "assignments_snapshot",
                "is_coop_success",
                "phase",
                "ended_at",
            ]
        )

        if room.game_type == GameType.COMPETITIVE:
            ScoreCalculator.settle_round(round_obj)

        game_over = self._check_game_over(match)
        if game_over:
            self._finish_match(match)
        else:
            settings = match.settings_snapshot
            if room.game_type == GameType.COOPERATIVE:
                success = match.rounds.filter(is_coop_success=True).count()
                target = settings.get("target_rounds", 1)
                early = settings.get("early_win_enabled", True)
                if early and success >= target:
                    self._finish_match(match)
                    return

            Round.objects.create(
                match=match,
                round_number=round_obj.round_number + 1,
                phase=RoundPhase.HINTS,
            )
            CharacterAssigner.assign(match)

        self._broadcast(match)

    def _check_game_over(self, match: Match) -> bool:
        room = match.room
        settings = match.settings_snapshot

        if room.game_type == GameType.COOPERATIVE:
            total_rounds = settings.get("total_rounds", 1)
            completed = match.rounds.filter(phase=RoundPhase.COMPLETE).count()
            early = settings.get("early_win_enabled", True)
            if not early and completed >= total_rounds:
                return True
            if early:
                success = match.rounds.filter(is_coop_success=True).count()
                target = settings.get("target_rounds", 1)
                if success >= target:
                    return True
            if completed >= total_rounds:
                return True
            return False

        end_condition = settings.get("end_condition", "rounds")
        if end_condition == "rounds":
            max_rounds = settings.get("max_rounds", 1)
            completed = match.rounds.filter(phase=RoundPhase.COMPLETE).count()
            return completed >= max_rounds

        target_score = settings.get("target_score", 20)
        for ms in match.match_scores.all():
            if ms.total_points >= target_score:
                return True
        return False

    def _finish_match(self, match: Match):
        match.status = MatchStatus.FINISHED
        match.ended_at = timezone.now()
        match.result = MatchResultBuilder.build(match)
        match.save(update_fields=["status", "ended_at", "result"])

        room = match.room
        room.status = RoomStatus.REPLAY_PENDING
        room.save(update_fields=["status"])
        broadcast_game_over(room, match)
        self._broadcast(match)

    def get_summary(self, match: Match):
        return MatchResultBuilder.build(match)

    def request_replay(self, match: Match, player: Player):
        room = match.room
        if room.status != RoomStatus.REPLAY_PENDING:
            raise GameAPIException("INVALID_STATE", "Not in replay pending state")
        ReplayVote.objects.update_or_create(
            match=match, player=player, defaults={"approved": True}
        )
        self._check_replay_complete(match)
        self._broadcast(match)
        return self._replay_response_state(match, player)

    def vote_replay(self, match: Match, player: Player, approved: bool):
        room = match.room
        if room.status != RoomStatus.REPLAY_PENDING:
            raise GameAPIException("INVALID_STATE", "Not in replay pending state")
        ReplayVote.objects.update_or_create(
            match=match, player=player, defaults={"approved": approved}
        )
        if approved:
            self._check_replay_complete(match)
        self._broadcast(match)
        return self._replay_response_state(match, player)

    def _replay_response_state(self, match: Match, player: Player):
        room = match.room
        room.refresh_from_db()
        active_match = (
            room.current_match if room.status == RoomStatus.PLAYING else match
        )
        return self.get_state(active_match, player)

    def _check_replay_complete(self, match: Match):
        room = match.room
        players = list(room.players.all())
        votes = {rv.player_id: rv.approved for rv in match.replay_votes.all()}
        if len(votes) < len(players):
            return
        if not all(votes.get(p.id) for p in players):
            return

        with transaction.atomic():
            match_number = room.matches.count() + 1
            new_match = Match.objects.create(
                room=room,
                match_number=match_number,
                settings_snapshot=room.settings,
                status=MatchStatus.ACTIVE,
            )
            room.current_match = new_match
            room.status = RoomStatus.PLAYING
            room.save(update_fields=["current_match", "status"])
            ReplayVote.objects.filter(match=match).delete()
            self.start_match(new_match)
