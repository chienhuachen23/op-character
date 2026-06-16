from django.test import TestCase

from apps.catalog.models import Character, GameMode, Theme
from apps.games.trait_guess.engine import TraitGuessEngine
from apps.rooms.models import (
    GameType,
    GuessVerdict,
    Player,
    RoundPhase,
)
from apps.rooms.services.room_service import create_room, join_room, start_game


class TraitGuessEngineTest(TestCase):
    def setUp(self):
        game_mode = GameMode.objects.create(
            slug="trait_guess", name_zh="测试", name_en="Test", is_active=True
        )
        theme = Theme.objects.create(game_mode=game_mode, slug="one_piece", name_zh="海贼王", name_en="One Piece")
        for i in range(5):
            Character.objects.create(
                theme=theme,
                name_zh=f"角色{i}",
                name_en=f"Char{i}",
                image_url=f"/c{i}.svg",
                is_active=True,
            )

        self.room, self.host = create_room(
            "trait_guess", "one_piece", GameType.COOPERATIVE, "Host", "zh",
            {"total_rounds": 2, "target_rounds": 1, "early_win_enabled": True},
        )
        self.room, self.p2 = join_room(self.room.room_code, "P2", "en")
        self.room, self.p3 = join_room(self.room.room_code, "P3", "zh")
        self.match = start_game(self.room, self.host)
        self.engine = TraitGuessEngine()

    def test_character_assignment_hidden_until_correct(self):
        state = self.engine.get_state(self.match, self.host)
        self.assertIsNone(state["self"]["character"])
        self.assertEqual(len(state["others"]), 2)

    def test_text_guess_and_reveal_on_correct(self):
        assignment = self.match.assignments.get(player=self.host)
        char_name = assignment.character.name_zh

        self.engine.submit_guess(self.match, self.host, text=char_name)
        guess = self.match.rounds.first().guesses.get(player=self.host)
        self.assertEqual(guess.guess_text, char_name)
        self.assertEqual(guess.verdict, GuessVerdict.PENDING)

        state_p2 = self.engine.get_state(self.match, self.p2)
        pending = [g for g in state_p2["guesses"] if g["verdict"] == "pending"]
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["guess_text"], char_name)

        self.engine.submit_guess_vote(guess, self.p2, True)
        self.engine.submit_guess_vote(guess, self.p3, True)
        guess.refresh_from_db()
        self.assertEqual(guess.verdict, GuessVerdict.CORRECT)

        state = self.engine.get_state(self.match, self.host)
        self.assertIsNotNone(state["self"]["character"])
        self.assertEqual(state["self"]["character"]["name_zh"], char_name)

    def test_incorrect_guess_can_retry(self):
        self.engine.submit_guess(self.match, self.host, text="wrong name")
        guess = self.match.rounds.first().guesses.get(player=self.host)
        self.engine.submit_guess_vote(guess, self.p2, False)
        self.engine.submit_guess_vote(guess, self.p3, False)
        guess.refresh_from_db()
        self.assertEqual(guess.verdict, GuessVerdict.INCORRECT)
        self.assertEqual(guess.guess_history, [{"text": "wrong name", "verdict": "incorrect"}])

        self.engine.submit_guess(self.match, self.host, text="wrong again")
        guess.refresh_from_db()
        self.engine.submit_guess_vote(guess, self.p2, False)
        self.engine.submit_guess_vote(guess, self.p3, False)
        guess.refresh_from_db()
        self.assertEqual(
            guess.guess_history,
            [
                {"text": "wrong name", "verdict": "incorrect"},
                {"text": "wrong again", "verdict": "incorrect"},
            ],
        )

        assignment = self.match.assignments.get(player=self.host)
        self.engine.submit_guess(self.match, self.host, text=assignment.character.name_zh)
        guess.refresh_from_db()
        self.assertEqual(guess.verdict, GuessVerdict.PENDING)

    def test_hint_personalization(self):
        self.engine.submit_hint(self.match, self.p2, "Both are fighters")
        state = self.engine.get_state(self.match, self.host)
        hint = next(h for h in state["hints"] if h["author_id"] == self.p2.id)
        self.assertFalse(hint["is_own"])
        self.assertEqual(hint["other_player_id"], self.p3.id)

    def test_can_guess_while_in_legacy_judging_phase(self):
        current_round = self.match.rounds.first()
        current_round.phase = RoundPhase.JUDGING
        current_round.save(update_fields=["phase"])

        self.engine.submit_guess(self.match, self.host, text="路飞")
        current_round.refresh_from_db()
        self.assertEqual(current_round.phase, RoundPhase.HINTS)
        self.assertTrue(current_round.guesses.filter(player=self.host).exists())

    def test_can_hint_after_correct_guess(self):
        assignment = self.match.assignments.get(player=self.host)
        self.engine.submit_guess(self.match, self.host, text=assignment.character.name_zh)
        guess = self.match.rounds.first().guesses.get(player=self.host)
        self.engine.submit_guess_vote(guess, self.p2, True)
        self.engine.submit_guess_vote(guess, self.p3, True)

        state = self.engine.submit_hint(self.match, self.host, "Another hint")
        self.assertEqual(len(state["hints"]), 1)
        self.assertEqual(self.match.rounds.first().phase, RoundPhase.HINTS)

    def _complete_all_guesses(self):
        for player in (self.host, self.p2, self.p3):
            char_name = self.match.assignments.get(player=player).character.name_zh
            self.engine.submit_guess(self.match, player, text=char_name)
            guess = self.match.rounds.first().guesses.get(player=player)
            for voter in (self.host, self.p2, self.p3):
                if voter.id != player.id:
                    self.engine.submit_guess_vote(guess, voter, True)

    def _complete_rating(self, round_obj=None):
        round_obj = round_obj or self.match.rounds.order_by("-round_number").first()
        author_ids = list(
            round_obj.hints.values_list("author_player_id", flat=True).distinct()
        )
        for rater in (self.host, self.p2, self.p3):
            for author_id in author_ids:
                if author_id != rater.id:
                    author = Player.objects.get(id=author_id)
                    self.engine.submit_author_hint_rating(round_obj, author, rater, "like")

    def test_author_hint_rating_groups_and_scoring(self):
        self.engine.submit_hint(self.match, self.p2, "fighters")
        self.engine.submit_hint(self.match, self.p2, "swords")
        self.engine.submit_hint(self.match, self.p3, "pirates")
        self._complete_all_guesses()

        current_round = self.match.rounds.first()
        self.assertEqual(current_round.phase, RoundPhase.RATING)

        state = self.engine.get_state(self.match, self.host)
        groups = state["hint_rating_groups"]
        self.assertEqual(len(groups), 2)
        p2_group = next(g for g in groups if g["author_id"] == self.p2.id)
        self.assertEqual(len(p2_group["hints"]), 2)

        self.engine.submit_author_hint_rating(current_round, self.p2, self.host, "like")
        self.engine.submit_author_hint_rating(current_round, self.p2, self.p3, "like")
        self.engine.submit_author_hint_rating(current_round, self.p3, self.host, "dislike")
        self.engine.submit_author_hint_rating(current_round, self.p3, self.p2, "like")

        current_round.refresh_from_db()
        self.assertEqual(current_round.phase, RoundPhase.COMPLETE)

        from apps.rooms.models import AuthorHintRating

        self.assertEqual(
            AuthorHintRating.objects.filter(
                round=current_round, author_player=self.p2, rating="like"
            ).count(),
            2,
        )

    def test_round_result_during_rating(self):
        self.engine.submit_hint(self.match, self.p2, "hint")
        self._complete_all_guesses()
        current_round = self.match.rounds.first()
        self.assertEqual(current_round.phase, RoundPhase.RATING)

        state = self.engine.get_state(self.match, self.host)
        self.assertIsNotNone(state["round_result"])
        self.assertTrue(state["round_result"]["is_coop_success"])
        self.assertEqual(len(state["round_result"]["guesses"]), 3)

    def test_competitive_pending_guess_scores_during_rating(self):
        room, host = create_room(
            "trait_guess",
            "one_piece",
            GameType.COMPETITIVE,
            "HostC",
            "zh",
            {
                "end_condition": "rounds",
                "max_rounds": 3,
                "target_score": 20,
                "scoring": {"correct_guess": 3, "hint_liked": 1, "hint_disliked": -1},
            },
        )
        _, p2 = join_room(room.room_code, "P2c", "en")
        _, p3 = join_room(room.room_code, "P3c", "zh")
        match = start_game(room, host)
        engine = TraitGuessEngine()

        engine.submit_hint(match, p2, "hint")
        for player in (host, p2, p3):
            char_name = match.assignments.get(player=player).character.name_zh
            engine.submit_guess(match, player, text=char_name)
            guess = match.rounds.first().guesses.get(player=player)
            for voter in (host, p2, p3):
                if voter.id != player.id:
                    engine.submit_guess_vote(guess, voter, True)

        state = engine.get_state(match, host)
        self.assertEqual(state["round_result"]["pending_scores"][str(host.id)], 3)
        self.assertEqual(state["round_result"]["scores"][str(host.id)], 0)

    def test_characters_reassigned_on_new_round(self):
        room, host = create_room(
            "trait_guess",
            "one_piece",
            GameType.COOPERATIVE,
            "Host2",
            "zh",
            {"total_rounds": 3, "target_rounds": 3, "early_win_enabled": False},
        )
        _, p2 = join_room(room.room_code, "P2b", "en")
        _, p3 = join_room(room.room_code, "P3b", "zh")
        match = start_game(room, host)
        engine = TraitGuessEngine()

        engine.submit_hint(match, p2, "fighters")
        for player in (host, p2, p3):
            char_name = match.assignments.get(player=player).character.name_zh
            engine.submit_guess(match, player, text=char_name)
            guess = match.rounds.first().guesses.get(player=player)
            for voter in (host, p2, p3):
                if voter.id != player.id:
                    engine.submit_guess_vote(guess, voter, True)

        current_round = match.rounds.first()
        author_ids = list(
            current_round.hints.values_list("author_player_id", flat=True).distinct()
        )
        for rater in (host, p2, p3):
            for author_id in author_ids:
                if author_id != rater.id:
                    author = Player.objects.get(id=author_id)
                    engine.submit_author_hint_rating(current_round, author, rater, "like")

        round2 = match.rounds.filter(phase=RoundPhase.HINTS).order_by("-round_number").first()
        self.assertIsNotNone(round2)
        self.assertEqual(round2.round_number, 2)

        round2_chars = {a.player_id: a.character_id for a in match.assignments.all()}
        self.assertEqual(len(round2_chars), 3)
        state = engine.get_state(match, host)
        self.assertIsNone(state["self"]["character"])
        self.assertTrue(all(o["character"] for o in state["others"]))


class RoomServiceTest(TestCase):
    def setUp(self):
        game_mode = GameMode.objects.create(
            slug="trait_guess", name_zh="测试", name_en="Test", is_active=True
        )
        Theme.objects.create(game_mode=game_mode, slug="one_piece", name_zh="海贼王", name_en="One Piece")
        for i in range(5):
            Character.objects.create(
                theme=Theme.objects.get(slug="one_piece"),
                name_zh=f"角色{i}",
                name_en=f"Char{i}",
                image_url=f"/c{i}.svg",
            )

    def test_create_and_join_room(self):
        room, host = create_room(
            "trait_guess", "one_piece", GameType.COOPERATIVE, "Host", "zh",
            {"total_rounds": 3, "target_rounds": 2, "early_win_enabled": True},
        )
        _, p2 = join_room(room.room_code, "P2", "en")
        self.assertEqual(p2.seat_index, 1)

    def test_room_full(self):
        room, _ = create_room(
            "trait_guess", "one_piece", GameType.COOPERATIVE, "H", "zh",
            {"total_rounds": 3, "target_rounds": 2, "early_win_enabled": True},
        )
        join_room(room.room_code, "P2", "en")
        join_room(room.room_code, "P3", "zh")
        from apps.core.exceptions import GameAPIException
        with self.assertRaises(GameAPIException):
            join_room(room.room_code, "P4", "zh")
