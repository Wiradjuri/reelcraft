"""Validation for customer-supplied AI server URLs (SSRF protection)."""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urlparse

from app.core.errors import ValidationFailed


def _is_private(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast


async def validate_base_url(url: str, *, allow_private: bool) -> str:
    """Return a normalised URL or raise :class:`ValidationFailed`.

    In hosted deployments ``allow_private`` is False so customers can't point the
    server at internal infrastructure (cloud metadata endpoints, databases…). Local
    installations allow private addresses so LM Studio/Ollama on ``localhost`` work.
    """
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValidationFailed(
            "Enter a full address starting with http:// or https://, for example http://localhost:1234/v1.",
            title="That server address doesn't look right",
            details={"field": "base_url"},
        )
    if parsed.username or parsed.password:
        raise ValidationFailed("Remove the username/password from the address.", details={"field": "base_url"})
    if not allow_private:
        try:
            infos = await asyncio.get_running_loop().getaddrinfo(parsed.hostname, parsed.port or 443)
        except socket.gaierror:
            raise ValidationFailed(
                "We couldn't find that server. Check the address.", details={"field": "base_url"}
            ) from None
        if any(_is_private(str(info[4][0])) for info in infos):
            raise ValidationFailed(
                "Private and local network addresses can't be used on the hosted service.",
                title="That server address isn't allowed",
                details={"field": "base_url"},
            )
    return url.strip().rstrip("/")
