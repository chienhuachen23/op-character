import uuid

from django.db import models

from apps.catalog.models import GameMode, Theme


class RoomStatus(models.TextChoices):
    WAITING = "waiting", "Waiting"
    PLAYING = "playing", "Playing"
    REPLAY_PENDING = "replay_pending", "Replay Pending"
    CLOSED = "closed", "Closed"


class GameType(models.TextChoices):
    COOPERATIVE = "cooperative", "Cooperative"
    COMPETITIVE = "competitive", "Competitive"


class Room(models.Model):
    room_code = models.CharField(max_length=6, unique=True, db_index=True)
    game_mode = models.ForeignKey(GameMode, on_delete=models.PROTECT, related_name="rooms")
    theme = models.ForeignKey(Theme, on_delete=models.PROTECT, related_name="rooms")
    host_player = models.ForeignKey(
        "Player", on_delete=models.SET_NULL, null=True, blank=True, related_name="hosted_rooms"
    )
    status = models.CharField(max_length=20, choices=RoomStatus.choices, default=RoomStatus.WAITING)
    game_type = models.CharField(max_length=20, choices=GameType.choices)
    settings = models.JSONField(default=dict)
    current_match = models.ForeignKey(
        "Match", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rooms"

    def __str__(self):
        return self.room_code


class Language(models.TextChoices):
    ZH = "zh", "Chinese"
    EN = "en", "English"


class Player(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="players")
    display_name = models.CharField(max_length=32)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    language = models.CharField(max_length=5, choices=Language.choices, default=Language.ZH)
    seat_index = models.PositiveSmallIntegerField()
    is_host = models.BooleanField(default=False)
    is_connected = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "players"
        unique_together = [("room", "seat_index")]

    def __str__(self):
        return f"{self.display_name} ({self.room.room_code})"


class MatchStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    FINISHED = "finished", "Finished"


class Match(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="matches")
    match_number = models.PositiveIntegerField()
    settings_snapshot = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=MatchStatus.choices, default=MatchStatus.ACTIVE)
    result = models.JSONField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "matches"
        unique_together = [("room", "match_number")]

    def __str__(self):
        return f"Match {self.match_number} in {self.room.room_code}"


class MatchPlayerAssignment(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="assignments")
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="assignments")
    character = models.ForeignKey(
        "catalog.Character", on_delete=models.PROTECT, related_name="assignments"
    )
    display_image_url = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "match_player_assignments"
        unique_together = [("match", "player")]

    def __str__(self):
        return f"{self.player.display_name} -> {self.character.name_en}"


class RoundPhase(models.TextChoices):
    HINTS = "hints", "Hints"
    GUESSING = "guessing", "Guessing"
    JUDGING = "judging", "Judging"
    RATING = "rating", "Rating"
    SETTLEMENT = "settlement", "Settlement"
    COMPLETE = "complete", "Complete"


def default_assignments_snapshot():
    return []


class Round(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="rounds")
    round_number = models.PositiveIntegerField()
    phase = models.CharField(max_length=20, choices=RoundPhase.choices, default=RoundPhase.HINTS)
    is_coop_success = models.BooleanField(null=True, blank=True)
    assignments_snapshot = models.JSONField(default=default_assignments_snapshot, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "rounds"
        unique_together = [("match", "round_number")]
        ordering = ["round_number"]

    def __str__(self):
        return f"Round {self.round_number} ({self.phase})"


class Hint(models.Model):
    round = models.ForeignKey(Round, on_delete=models.CASCADE, related_name="hints")
    author_player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="hints")
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "hints"
        ordering = ["created_at"]


class GuessVerdict(models.TextChoices):
    PENDING = "pending", "Pending"
    CORRECT = "correct", "Correct"
    INCORRECT = "incorrect", "Incorrect"
    SKIPPED = "skipped", "Skipped"


def default_guess_history():
    return []


class Guess(models.Model):
    round = models.ForeignKey(Round, on_delete=models.CASCADE, related_name="guesses")
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="guesses")
    guess_text = models.CharField(max_length=100, blank=True, default="")
    guessed_character = models.ForeignKey(
        "catalog.Character", on_delete=models.SET_NULL, null=True, blank=True
    )
    is_skipped = models.BooleanField(default=False)
    verdict = models.CharField(max_length=20, choices=GuessVerdict.choices, default=GuessVerdict.PENDING)
    guess_history = models.JSONField(default=default_guess_history, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "guesses"
        unique_together = [("round", "player")]


class GuessVote(models.Model):
    guess = models.ForeignKey(Guess, on_delete=models.CASCADE, related_name="votes")
    voter_player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="guess_votes")
    is_correct = models.BooleanField()

    class Meta:
        db_table = "guess_votes"
        unique_together = [("guess", "voter_player")]


class HintRatingType(models.TextChoices):
    LIKE = "like", "Like"
    DISLIKE = "dislike", "Dislike"


class HintRating(models.Model):
    hint = models.ForeignKey(Hint, on_delete=models.CASCADE, related_name="ratings")
    rater_player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="hint_ratings")
    rating = models.CharField(max_length=10, choices=HintRatingType.choices)

    class Meta:
        db_table = "hint_ratings"
        unique_together = [("hint", "rater_player")]


class AuthorHintRating(models.Model):
    """One like/dislike per rater per hint author per round."""

    round = models.ForeignKey(Round, on_delete=models.CASCADE, related_name="author_hint_ratings")
    author_player = models.ForeignKey(
        Player, on_delete=models.CASCADE, related_name="author_hint_ratings_received"
    )
    rater_player = models.ForeignKey(
        Player, on_delete=models.CASCADE, related_name="author_hint_ratings_given"
    )
    rating = models.CharField(max_length=10, choices=HintRatingType.choices)

    class Meta:
        db_table = "author_hint_ratings"
        unique_together = [("round", "author_player", "rater_player")]


class RoundScore(models.Model):
    round = models.ForeignKey(Round, on_delete=models.CASCADE, related_name="scores")
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="round_scores")
    points = models.IntegerField(default=0)
    breakdown = models.JSONField(default=dict)

    class Meta:
        db_table = "round_scores"
        unique_together = [("round", "player")]


class MatchScore(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="match_scores")
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="match_scores")
    total_points = models.IntegerField(default=0)

    class Meta:
        db_table = "match_scores"
        unique_together = [("match", "player")]


class ReplayVote(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="replay_votes")
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name="replay_votes")
    approved = models.BooleanField(default=False)

    class Meta:
        db_table = "replay_votes"
        unique_together = [("match", "player")]


class CharacterRerollStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    REJECTED = "rejected", "Rejected"


class CharacterRerollRequest(models.Model):
    round = models.ForeignKey(Round, on_delete=models.CASCADE, related_name="character_reroll_requests")
    target_player = models.ForeignKey(
        Player, on_delete=models.CASCADE, related_name="character_reroll_targets"
    )
    requester_player = models.ForeignKey(
        Player, on_delete=models.CASCADE, related_name="character_reroll_requests_made"
    )
    status = models.CharField(
        max_length=20,
        choices=CharacterRerollStatus.choices,
        default=CharacterRerollStatus.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "character_reroll_requests"
        indexes = [
            models.Index(fields=["round", "status"], name="character_r_round_i_6f0a2a_idx"),
        ]
