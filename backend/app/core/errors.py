"""Application error model.

Every error that reaches a customer is an :class:`AppError` with a stable ``code``, a
plain-language ``title``/``message`` and optional technical ``details`` that the UI
shows only under "Advanced details". Unexpected exceptions are converted into a
generic error without leaking stack traces.
"""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    status_code: int = 400
    code: str = "bad_request"
    title: str = "Something went wrong"
    message: str = "Please try again."

    def __init__(
        self,
        message: str | None = None,
        *,
        title: str | None = None,
        code: str | None = None,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
        retryable: bool = False,
    ) -> None:
        self.message = message or self.message
        self.title = title or self.title
        self.code = code or self.code
        self.status_code = status_code or self.status_code
        self.details = details or {}
        self.retryable = retryable
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "title": self.title,
            "message": self.message,
            "retryable": self.retryable,
            "details": self.details,
        }


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    title = "We couldn't find that"
    message = "It may have been deleted or you may not have access to it."


class ValidationFailed(AppError):
    status_code = 422
    code = "validation_error"
    title = "Please check the highlighted fields"
    message = "Some of the information provided isn't valid."


class AuthenticationRequired(AppError):
    status_code = 401
    code = "auth_required"
    title = "Please sign in"
    message = "Your session has ended. Sign in again to continue."


class PermissionDenied(AppError):
    status_code = 403
    code = "forbidden"
    title = "You don't have access to this"
    message = "Ask a workspace owner for access."


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    title = "That already exists"


class RateLimited(AppError):
    status_code = 429
    code = "rate_limited"
    title = "You're going a little fast"
    message = "Please wait a moment and try again."

    def __init__(self, retry_after: int = 30, **kwargs: Any) -> None:
        super().__init__(retryable=True, **kwargs)
        self.retry_after = retry_after
        self.details.setdefault("retry_after_seconds", retry_after)
