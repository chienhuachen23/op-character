from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


class GameAPIException(APIException):
    status_code = 400
    default_code = "game_error"

    def __init__(self, code, message, status_code=400, details=None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(detail=message)
        self.status_code = status_code


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        if isinstance(exc, GameAPIException):
            response.data = {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            }
        elif isinstance(response.data, dict) and "detail" in response.data:
            response.data = {
                "code": "error",
                "message": str(response.data["detail"]),
                "details": {},
            }
    return response
