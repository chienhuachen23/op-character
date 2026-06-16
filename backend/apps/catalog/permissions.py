import os

from rest_framework.permissions import BasePermission

from apps.core.exceptions import GameAPIException


class AdminAPIKeyPermission(BasePermission):
    def has_permission(self, request, view):
        expected = os.getenv("ADMIN_API_KEY", "")
        if not expected:
            raise GameAPIException("ADMIN_DISABLED", "Admin API is disabled", 403)
        provided = request.headers.get("X-Admin-Key", "")
        if provided != expected:
            raise GameAPIException("UNAUTHORIZED", "Invalid admin key", 401)
        return True
