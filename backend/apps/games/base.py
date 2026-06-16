from abc import ABC, abstractmethod


class GameEngine(ABC):
    @abstractmethod
    def start_match(self, match):
        pass

    @abstractmethod
    def get_state(self, match, player):
        pass

    @abstractmethod
    def submit_hint(self, match, player, content):
        pass

    @abstractmethod
    def submit_guess(self, match, player, text=None, skip=False):
        pass

    @abstractmethod
    def submit_guess_vote(self, guess, voter, is_correct):
        pass

    @abstractmethod
    def submit_hint_rating(self, hint, rater, rating):
        pass

    @abstractmethod
    def advance_hints_phase(self, match, player):
        pass

    @abstractmethod
    def get_summary(self, match):
        pass

    @abstractmethod
    def request_replay(self, match, player):
        pass

    @abstractmethod
    def vote_replay(self, match, player, approved):
        pass
