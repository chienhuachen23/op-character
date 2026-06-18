from django.urls import path

from .views import (
    AdvanceHintsView,
    ConfirmCharacterRerollView,
    CurrentMatchView,
    DeleteHintView,
    MatchSummaryView,
    RequestCharacterRerollView,
    RequestReplayView,
    SubmitAuthorHintRatingView,
    SubmitGuessView,
    SubmitGuessVoteView,
    SubmitHintRatingView,
    SubmitHintView,
    ThemeCharactersView,
    VoteReplayView,
)

urlpatterns = [
    path("matches/current", CurrentMatchView.as_view(), name="match-current"),
    path("matches/<int:match_id>/summary", MatchSummaryView.as_view(), name="match-summary"),
    path("rounds/current/hints", SubmitHintView.as_view(), name="submit-hint"),
    path("hints/<int:hint_id>", DeleteHintView.as_view(), name="delete-hint"),
    path("rounds/current/advance", AdvanceHintsView.as_view(), name="advance-hints"),
    path("rounds/current/guesses", SubmitGuessView.as_view(), name="submit-guess"),
    path(
        "rounds/current/character-rerolls",
        RequestCharacterRerollView.as_view(),
        name="request-character-reroll",
    ),
    path(
        "rounds/current/character-rerolls/confirm",
        ConfirmCharacterRerollView.as_view(),
        name="confirm-character-reroll",
    ),
    path("guesses/<int:guess_id>/votes", SubmitGuessVoteView.as_view(), name="submit-guess-vote"),
    path("hints/<int:hint_id>/ratings", SubmitHintRatingView.as_view(), name="submit-hint-rating"),
    path(
        "rounds/current/author-hint-ratings",
        SubmitAuthorHintRatingView.as_view(),
        name="submit-author-hint-rating",
    ),
    path("matches/<int:match_id>/replay", RequestReplayView.as_view(), name="request-replay"),
    path("matches/<int:match_id>/replay/vote", VoteReplayView.as_view(), name="vote-replay"),
    path("characters", ThemeCharactersView.as_view(), name="theme-characters"),
]
