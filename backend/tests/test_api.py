"""End-to-end API workflows with the AI provider faked at the adapter boundary."""

from __future__ import annotations

import pytest

from app.ai.errors import AIAuthenticationError, AIUnavailable
from tests.conftest import BRAND, APIClient, onboard, signup
from tests.fakes import FakeProviderFactory

# --- First launch & accounts ---------------------------------------------------------


async def test_first_launch_flow(client: APIClient) -> None:
    status = (await client.get("/setup/status")).json()
    assert status == {
        "needs_account": True,
        "authenticated": False,
        "onboarding_completed": False,
        "signup_allowed": True,
        "platform_ai_available": True,
    }
    session = await signup(client)
    assert session["workspace"]["onboarding_completed"] is False
    status = (await client.get("/setup/status")).json()
    assert status["authenticated"] is True
    assert status["needs_account"] is False

    # Onboarding can't finish without a brand.
    response = await client.post("/setup/complete", json={})
    assert response.status_code == 422
    assert response.json()["error"]["title"] == "Add your brand to continue"

    response = await client.post("/setup/complete", json={"brand": {"name": "Bloom & Brew"}})
    assert response.status_code == 200
    workspace = response.json()
    assert workspace["onboarding_completed"] is True
    assert workspace["active_brand_id"]


async def test_login_logout_and_bad_credentials(client: APIClient) -> None:
    await signup(client)
    await client.post("/auth/logout")
    assert (await client.get("/auth/session")).status_code == 401

    bad = await client.post("/auth/login", json={"email": "owner@example.com", "password": "nope"})
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "invalid_credentials"
    unknown = await client.post("/auth/login", json={"email": "who@example.com", "password": "nope"})
    assert unknown.json()["error"]["code"] == "invalid_credentials"

    ok = await client.post("/auth/login", json={"email": "OWNER@example.com", "password": "Sup3r-secret!"})
    assert ok.status_code == 200
    assert (await client.get("/auth/session")).json()["user"]["email"] == "owner@example.com"


async def test_signup_validation_and_duplicates(client: APIClient) -> None:
    weak = await client.post(
        "/auth/signup", json={"email": "a@b.co", "password": "aaaaaaaaaaaa", "name": "A", "workspace_name": "W"}
    )
    assert weak.status_code == 422
    await signup(client)
    dup = await client.post(
        "/auth/signup",
        json={"email": "owner@example.com", "password": "Sup3r-secret!", "name": "A", "workspace_name": "W"},
    )
    assert dup.status_code == 409


async def test_requests_without_csrf_header_are_blocked(client: APIClient) -> None:
    response = await client.post("/auth/signup", json={}, headers={"X-Requested-With": "evil"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf"


async def test_protected_routes_require_a_session(client: APIClient) -> None:
    for path in ("/brands", "/generations", "/library", "/settings/ai", "/workspace"):
        response = await client.get(path)
        assert response.status_code == 401, path
        assert response.json()["error"]["title"] == "Please sign in"


# --- Brands --------------------------------------------------------------------------


async def test_brand_crud_and_active_brand(client: APIClient) -> None:
    await onboard(client)
    brands = (await client.get("/brands")).json()
    assert len(brands) == 1
    assert brands[0]["is_active"]
    assert brands[0]["prohibited_words"] == ["cheap"]

    second = await client.post(
        "/brands",
        json={
            "name": "Second",
            "content_pillars": [" tips ", "Tips", ""],
            "make_active": False,
            "tone_of_voice": "bold",
        },
    )
    assert second.status_code == 201
    second_brand = second.json()
    assert second_brand["content_pillars"] == ["tips"]
    assert second_brand["is_active"] is False

    patched = await client.patch(f"/brands/{second_brand['id']}", json={"industry": "Fitness"})
    assert patched.json()["industry"] == "Fitness"
    assert patched.json()["name"] == "Second"

    await client.post(f"/brands/{second_brand['id']}/activate")
    assert (await client.get("/workspace")).json()["active_brand_id"] == second_brand["id"]

    assert (await client.delete(f"/brands/{second_brand['id']}")).status_code == 204
    remaining = (await client.get("/brands")).json()
    assert [b["name"] for b in remaining] == ["Bloom & Brew"]
    assert remaining[0]["is_active"]


async def test_brand_validation(client: APIClient) -> None:
    await onboard(client)
    response = await client.post("/brands", json={"name": "", "tone_of_voice": "sarcastic"})
    assert response.status_code == 422
    fields = {e["field"] for e in response.json()["error"]["details"]["errors"]}
    assert {"name", "tone_of_voice"} <= fields


# --- Generation ----------------------------------------------------------------------


async def generate(client: APIClient, **overrides: object) -> dict:
    body = {"content_type": "reel", "topic": "Our pumpkin latte is back", "variations": 3} | overrides
    response = await client.post("/generations", json=body)
    assert response.status_code == 201, response.text
    return response.json()


async def test_generate_reel_uses_brand_and_persists_history(
    client: APIClient, provider_factory: FakeProviderFactory
) -> None:
    await onboard(client)
    generation = await generate(client)
    assert generation["content_type"] == "reel"
    assert generation["brand_name"] == "Bloom & Brew"
    assert len(generation["items"]) == 3
    assert len({item["angle"] for item in generation["items"]}) == 3
    reel = generation["items"][0]["data"]
    assert reel["hook"]
    assert len(reel["scenes"]) >= 2
    assert reel["hashtags"][0].startswith("#")
    assert generation["meta"]["quality_resolved"] == "professional"  # Auto: reels are complex
    assert generation["meta"]["provider"] == "openai"
    assert generation["meta"]["ai_source"] == "platform"

    sent = provider_factory.requests[-1]
    assert "Bloom & Brew" in sent.user
    assert "NEVER use these words or phrases: cheap" in sent.user
    assert sent.target.model == "gpt-5.4"

    history = (await client.get("/generations")).json()
    assert history["total"] == 1
    assert history["items"][0]["item_count"] == 3
    reopened = (await client.get(f"/generations/{generation['id']}")).json()
    assert reopened["items"] == generation["items"]


@pytest.mark.parametrize(
    ("content_type", "options", "count"),
    [
        ("caption", {"caption_length": "short", "caption_style": "promotional", "emoji_style": "none"}, 3),
        ("quote", {"quote_category": "motivational"}, 5),
        ("post_idea", {}, 2),
    ],
)
async def test_generate_other_content_types(client: APIClient, content_type: str, options: dict, count: int) -> None:
    await onboard(client)
    generation = await generate(client, content_type=content_type, options=options, variations=count, quality="fast")
    assert len(generation["items"]) == count
    assert generation["meta"]["quality_resolved"] == "fast"


async def test_generation_request_validation(client: APIClient) -> None:
    await onboard(client)
    cases = [
        {"content_type": "reel", "topic": "x"},
        {"content_type": "reel", "topic": "Valid topic", "variations": 9},
        {"content_type": "reel", "topic": "Valid topic", "options": {"reel_duration": 20}},
        {"content_type": "podcast", "topic": "Valid topic"},
        {"content_type": "reel", "topic": "Valid topic", "options": {"unknown": True}},
    ]
    for body in cases:
        response = await client.post("/generations", json=body)
        assert response.status_code == 422, body
    unavailable = await client.post(
        "/generations", json={"content_type": "reel", "topic": "Valid", "platform": "tiktok"}
    )
    assert unavailable.status_code == 422
    assert "coming soon" in unavailable.json()["error"]["message"]


async def test_ai_failure_is_friendly_and_recorded(client: APIClient, provider_factory: FakeProviderFactory) -> None:
    await onboard(client)
    provider_factory.error = AIAuthenticationError(details={"status": 401})
    response = await client.post("/generations", json={"content_type": "caption", "topic": "Autumn menu"})
    assert response.status_code == 502
    error = response.json()["error"]
    assert error["title"] == "We couldn't connect to your AI provider"
    assert error["message"] == "Check your API key and try again."
    history = (await client.get("/generations")).json()
    assert history["items"][0]["status"] == "failed"


async def test_outage_fails_over_then_reports_unavailable(
    client: APIClient, provider_factory: FakeProviderFactory
) -> None:
    await onboard(client)
    provider_factory.error = AIUnavailable()
    response = await client.post("/generations", json={"content_type": "caption", "topic": "Autumn menu"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "ai_unavailable"
    assert response.json()["error"]["retryable"] is True
    assert len(provider_factory.requests) == 2  # tried the fallback model too


async def test_invalid_ai_output_is_never_stored(client: APIClient, provider_factory: FakeProviderFactory) -> None:
    await onboard(client)
    provider_factory.handler = lambda request: {"variations": [{"angle": "x", "hook": ""}]}
    response = await client.post("/generations", json={"content_type": "caption", "topic": "Autumn menu"})
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_invalid_output"
    assert len(provider_factory.requests) == 4  # repair retry on each of two models
    history = (await client.get("/generations")).json()
    assert history["items"][0]["status"] == "failed"
    assert history["items"][0]["item_count"] == 0


async def test_generation_requires_a_brand(client: APIClient) -> None:
    await signup(client)
    response = await client.post("/generations", json={"content_type": "caption", "topic": "Autumn menu"})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "brand_required"


# --- Editing & component regeneration -----------------------------------------------


async def test_regenerate_single_component_preserves_the_rest(
    client: APIClient, provider_factory: FakeProviderFactory
) -> None:
    await onboard(client)
    item = (await generate(client))["items"][1]
    response = await client.post(f"/items/{item['id']}/regenerate", json={"field": "hook", "instruction": "Shorter"})
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["data"]["hook"] == "Fresh hook"
    assert {k: v for k, v in updated["data"].items() if k != "hook"} == {
        k: v for k, v in item["data"].items() if k != "hook"
    }
    assert updated["is_edited"] is True
    sent = provider_factory.requests[-1]
    assert "Shorter" in sent.user
    assert item["data"]["caption"] in sent.user
    assert sent.target.model == "gpt-5.4-mini"  # Auto → Fast for a hook

    bad = await client.post(f"/items/{item['id']}/regenerate", json={"field": "estimated_duration_seconds"})
    assert bad.status_code == 422


async def test_manual_edit_is_validated(client: APIClient) -> None:
    await onboard(client)
    item = (await generate(client, content_type="caption"))["items"][0]
    ok = await client.patch(f"/items/{item['id']}", json={"data": {"body": "Edited body", "hashtags": ["new tag"]}})
    assert ok.status_code == 200
    assert ok.json()["data"]["body"] == "Edited body"
    assert ok.json()["data"]["hashtags"] == ["#new", "#tag"]
    bad = await client.patch(f"/items/{item['id']}", json={"data": {"hook": "  "}})
    assert bad.status_code == 422


# --- Library -------------------------------------------------------------------------


async def test_save_search_favourite_and_delete(client: APIClient) -> None:
    await onboard(client)
    generation = await generate(client, content_type="quote", variations=2)
    item = generation["items"][0]
    saved = await client.post("/library", json={"item_id": item["id"], "tags": ["Autumn", "launch"]})
    assert saved.status_code == 201
    entry = saved.json()
    assert entry["generation_context"]["topic"] == "Our pumpkin latte is back"
    assert entry["brand_name"] == "Bloom & Brew"
    assert entry["tags"] == ["Autumn", "launch"]

    again = await client.post("/library", json={"item_id": item["id"]})
    assert again.json()["id"] == entry["id"]  # idempotent per item

    reopened = (await client.get(f"/generations/{generation['id']}")).json()
    assert reopened["items"][0]["saved_id"] == entry["id"]

    await client.patch(f"/library/{entry['id']}", json={"is_favourite": True, "title": "Best quote"})
    results = (await client.get("/library", params={"q": "best", "favourites": True})).json()
    assert results["total"] == 1
    assert results["items"][0]["title"] == "Best quote"
    assert (await client.get("/library", params={"content_type": "reel"})).json()["total"] == 0
    assert (await client.get("/library", params={"tag": "autumn"})).json()["total"] == 1
    assert (await client.get("/library/tags")).json() == ["Autumn", "launch"]

    # Library entries survive deleting the generation they came from.
    await client.delete(f"/generations/{generation['id']}")
    assert (await client.get(f"/library/{entry['id']}")).status_code == 200

    assert (await client.delete(f"/library/{entry['id']}")).status_code == 204
    assert (await client.get("/library")).json()["total"] == 0


async def test_dashboard_stats(client: APIClient) -> None:
    await onboard(client)
    generation = await generate(client, content_type="caption", variations=2)
    await client.post("/library", json={"item_id": generation["items"][0]["id"], "is_favourite": True})
    stats = (await client.get("/workspace/stats")).json()
    assert stats == {"generations": 1, "pieces_created": 2, "saved": 1, "favourites": 1}


# --- Tenancy -------------------------------------------------------------------------


async def test_workspaces_are_isolated(app, client: APIClient) -> None:
    await onboard(client)
    generation = await generate(client, content_type="caption")
    brand_id = (await client.get("/brands")).json()[0]["id"]

    import httpx

    async with APIClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as other:
        await signup(other, "intruder@example.com", "Other")
        assert (await other.get(f"/generations/{generation['id']}")).status_code == 404
        assert (await other.get(f"/brands/{brand_id}")).status_code == 404
        item_id = generation["items"][0]["id"]
        assert (await other.patch(f"/items/{item_id}", json={"data": {"body": "hacked"}})).status_code == 404
        assert (await other.post("/library", json={"item_id": item_id})).status_code == 404
        assert (await other.get("/generations")).json()["total"] == 0


# --- Bring your own AI -----------------------------------------------------------------


async def test_byo_ai_keys_are_never_returned(client: APIClient, provider_factory: FakeProviderFactory) -> None:
    await onboard(client)
    secret = "sk-ant-my-very-secret-key-123456"
    saved = await client.put(
        "/settings/ai/connections",
        json={"provider": "anthropic", "api_key": secret, "tier_models": {"fast": "claude-haiku-4-5"}},
    )
    assert saved.status_code == 200
    assert secret not in saved.text
    assert saved.json()["key_hint"].endswith("3456")
    overview = await client.get("/settings/ai")
    assert secret not in overview.text

    switched = await client.put("/settings/ai/source", json={"ai_source": "custom", "provider": "anthropic"})
    assert switched.json()["ai_source"] == "custom"
    await generate(client, content_type="caption", quality="fast")
    instance = provider_factory.instances[-1]
    assert instance.config.provider == "anthropic"
    assert instance.config.api_key == secret
    assert provider_factory.requests[-1].target.model == "claude-haiku-4-5"

    # Updating without a key keeps the stored one.
    await client.put("/settings/ai/connections", json={"provider": "anthropic", "tier_models": {}})
    await generate(client, content_type="caption")
    assert provider_factory.instances[-1].config.api_key == secret

    assert (await client.delete("/settings/ai/connections/anthropic")).status_code == 204
    assert (await client.get("/settings/ai")).json()["ai_source"] == "platform"


async def test_cannot_switch_to_unconfigured_provider(client: APIClient) -> None:
    await onboard(client)
    response = await client.put("/settings/ai/source", json={"ai_source": "custom", "provider": "gemini"})
    assert response.status_code == 422
    assert response.json()["error"]["title"] == "Connect a provider first"


async def test_connection_test_reports_friendly_results(client: APIClient, monkeypatch: pytest.MonkeyPatch) -> None:
    await onboard(client)
    from app.services import ai_settings
    from tests.fakes import FakeProvider

    class BadKeyProvider(FakeProvider):
        async def list_models(self):  # type: ignore[no-untyped-def]
            raise AIAuthenticationError(provider="openai", details={"status": 401})

    monkeypatch.setattr(ai_settings, "create_provider", lambda config: BadKeyProvider(config))
    result = (await client.post("/settings/ai/test", json={"provider": "openai", "api_key": "sk-wrong"})).json()
    assert result == {
        "ok": False,
        "title": "We couldn't connect to your AI provider",
        "message": "Check your API key and try again.",
        "models": [],
        "details": {"status": 401, "provider": "openai"},
    }

    monkeypatch.setattr(ai_settings, "create_provider", lambda config: FakeProvider(config, models=["gpt-a", "gpt-b"]))
    good = (await client.post("/settings/ai/test", json={"provider": "openai", "api_key": "sk-right"})).json()
    assert good["ok"] is True
    assert good["title"] == "Connected successfully"
    assert [m["id"] for m in good["models"]] == ["gpt-a", "gpt-b"]

    missing = (
        await client.post(
            "/settings/ai/test", json={"provider": "openai", "api_key": "sk-right", "tier_models": {"fast": "gpt-z"}}
        )
    ).json()
    assert missing["ok"] is False
    assert "gpt-z" in missing["message"]

    no_key = (await client.post("/settings/ai/test", json={"provider": "openai"})).json()
    assert no_key["ok"] is False
    assert no_key["title"] == "Add your API key"


async def test_custom_server_urls_are_validated(client: APIClient, settings) -> None:
    await onboard(client)
    bad = await client.put("/settings/ai/connections", json={"provider": "openai_compatible", "base_url": "ftp://x"})
    assert bad.status_code == 422
    missing = await client.put("/settings/ai/connections", json={"provider": "openai_compatible"})
    assert missing.status_code == 422

    settings.allow_private_ai_urls = False
    private = await client.put(
        "/settings/ai/connections", json={"provider": "openai_compatible", "base_url": "http://169.254.169.254/v1"}
    )
    assert private.status_code == 422
    assert private.json()["error"]["title"] == "That server address isn't allowed"


async def test_brand_defaults_flow_into_onboarding_payload(client: APIClient) -> None:
    await onboard(client)
    brand = (await client.get("/brands")).json()[0]
    for key, value in BRAND.items():
        assert brand[key] == value
