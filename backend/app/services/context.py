"""Per-request tenancy context passed into every service call."""

from __future__ import annotations

from dataclasses import dataclass

from app.core.errors import PermissionDenied
from app.db.models import User, Workspace

ROLE_RANK = {"viewer": 0, "editor": 1, "admin": 2, "owner": 3}


@dataclass(frozen=True)
class RequestContext:
    user: User
    workspace: Workspace
    role: str

    def require(self, minimum_role: str) -> None:
        """Authorisation seam for team roles (viewer < editor < admin < owner)."""
        if ROLE_RANK.get(self.role, -1) < ROLE_RANK[minimum_role]:
            raise PermissionDenied()
