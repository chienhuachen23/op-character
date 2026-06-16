from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Character
from apps.catalog.serializers import CharacterSerializer
from apps.core.exceptions import GameAPIException
from apps.games.registry import get_engine_for_room
from apps.rooms.models import Guess, Hint, Player, RoomStatus
from apps.rooms.permissions import PlayerTokenPermission


class CurrentMatchView(APIView):
    permission_classes = [PlayerTokenPermission]

    def get(self, request):
        room = request.room
        if not room.current_match_id:
            raise GameAPIException("NO_ACTIVE_MATCH", "No active match", 404)
        match = room.current_match
        engine = get_engine_for_room(room)
        state = engine.get_state(match, request.player)
        return Response(state)


class MatchSummaryView(APIView):
    permission_classes = [PlayerTokenPermission]

    def get(self, request, match_id):
        room = request.room
        match = room.matches.filter(id=match_id).first()
        if not match:
            raise GameAPIException("MATCH_NOT_FOUND", "Match not found", 404)
        engine = get_engine_for_room(room)
        return Response(engine.get_summary(match))


class SubmitHintView(APIView):
    permission_classes = [PlayerTokenPermission]

    def post(self, request):
        content = request.data.get("content", "")
        room = request.room
        match = room.current_match
        if not match:
            raise GameAPIException("NO_ACTIVE_MATCH", "No active match", 404)
        engine = get_engine_for_room(room)
        state = engine.submit_hint(match, request.player, content)
        return Response(state)


class AdvanceHintsView(APIView):
    permission_classes = [PlayerTokenPermission]

    def post(self, request):
        room = request.room
        if not request.player.is_host:
            raise GameAPIException("NOT_HOST", "Only host can advance phase", 403)
        match = room.current_match
        if not match:
            raise GameAPIException("NO_ACTIVE_MATCH", "No active match", 404)
        engine = get_engine_for_room(room)
        state = engine.advance_hints_phase(match, request.player)
        return Response(state)


class SubmitGuessView(APIView):
    permission_classes = [PlayerTokenPermission]

    def post(self, request):
        room = request.room
        match = room.current_match
        if not match:
            raise GameAPIException("NO_ACTIVE_MATCH", "No active match", 404)
        skip = request.data.get("skip", False)
        text = request.data.get("text", "")
        engine = get_engine_for_room(room)
        state = engine.submit_guess(match, request.player, text=text, skip=skip)
        return Response(state)


class SubmitGuessVoteView(APIView):
    permission_classes = [PlayerTokenPermission]

    def post(self, request, guess_id):
        room = request.room
        match = room.current_match
        if not match:
            raise GameAPIException("NO_ACTIVE_MATCH", "No active match", 404)
        try:
            guess = Guess.objects.select_related("round", "round__match").get(
                id=guess_id, round__match=match
            )
        except Guess.DoesNotExist:
            raise GameAPIException("GUESS_NOT_FOUND", "Guess not found", 404)
        is_correct = request.data.get("is_correct")
        if is_correct is None:
            raise GameAPIException("INVALID_VOTE", "is_correct required")
        engine = get_engine_for_room(room)
        state = engine.submit_guess_vote(guess, request.player, bool(is_correct))
        return Response(state)


class SubmitHintRatingView(APIView):
    permission_classes = [PlayerTokenPermission]

    def post(self, request, hint_id):
        room = request.room
        match = room.current_match
        if not match:
            raise GameAPIException("NO_ACTIVE_MATCH", "No active match", 404)
        try:
            hint = Hint.objects.select_related("round", "round__match", "author_player").get(
                id=hint_id, round__match=match
            )
        except Hint.DoesNotExist:
            raise GameAPIException("HINT_NOT_FOUND", "Hint not found", 404)
        rating = request.data.get("rating")
        engine = get_engine_for_room(room)
        state = engine.submit_hint_rating(hint, request.player, rating)
        return Response(state)


class SubmitAuthorHintRatingView(APIView):
    permission_classes = [PlayerTokenPermission]

    def post(self, request):
        room = request.room
        match = room.current_match
        if not match:
            raise GameAPIException("NO_ACTIVE_MATCH", "No active match", 404)
        author_id = request.data.get("author_id")
        rating = request.data.get("rating")
        if not author_id:
            raise GameAPIException("INVALID_AUTHOR", "author_id required")
        try:
            author = Player.objects.get(id=author_id, room=room)
        except Player.DoesNotExist:
            raise GameAPIException("INVALID_AUTHOR", "Player not found", 404)
        current_round = match.rounds.order_by("-round_number").first()
        if not current_round:
            raise GameAPIException("INVALID_PHASE", "No active round", 400)
        engine = get_engine_for_room(room)
        state = engine.submit_author_hint_rating(current_round, author, request.player, rating)
        return Response(state)


class RequestReplayView(APIView):
    permission_classes = [PlayerTokenPermission]

    def post(self, request, match_id):
        room = request.room
        match = room.matches.filter(id=match_id).first()
        if not match:
            raise GameAPIException("MATCH_NOT_FOUND", "Match not found", 404)
        engine = get_engine_for_room(room)
        state = engine.request_replay(match, request.player)
        return Response(state)


class VoteReplayView(APIView):
    permission_classes = [PlayerTokenPermission]

    def post(self, request, match_id):
        room = request.room
        match = room.matches.filter(id=match_id).first()
        if not match:
            raise GameAPIException("MATCH_NOT_FOUND", "Match not found", 404)
        approved = request.data.get("approved", False)
        engine = get_engine_for_room(room)
        state = engine.vote_replay(match, request.player, bool(approved))
        return Response(state)


class ThemeCharactersView(APIView):
    permission_classes = [PlayerTokenPermission]

    def get(self, request):
        room = request.room
        characters = Character.objects.filter(theme=room.theme, is_active=True)
        return Response(CharacterSerializer(characters, many=True).data)
