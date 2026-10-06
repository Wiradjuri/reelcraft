"""Creative angles used to make variations genuinely different from one another."""

from __future__ import annotations

from dataclasses import dataclass

from app.content.options import ContentType, Objective


@dataclass(frozen=True)
class Angle:
    key: str
    label: str
    direction: str


ANGLES: dict[str, Angle] = {
    a.key: a
    for a in (
        Angle("direct", "Direct", "Lead with the single most valuable point. Short sentences. No warm-up."),
        Angle(
            "story",
            "Story-driven",
            "Open in the middle of a specific moment (a customer, a day, a mistake). Build tension, then pay it off.",
        ),
        Angle(
            "conversational",
            "Conversational",
            "Sound like a real person talking to one follower. Use 'you' and 'we', ask a genuine question.",
        ),
        Angle("bold", "Bold", "Take a confident, slightly contrarian stance or myth-bust. Punchy and memorable."),
        Angle(
            "educational",
            "Educational",
            "Teach something concrete: steps, a framework, a quick tip, or a before/after. Make it save-worthy.",
        ),
        Angle(
            "curiosity",
            "Curiosity",
            "Open a loop the audience needs closed — a surprising fact, question or reveal they must stay for.",
        ),
        Angle(
            "social_proof",
            "Social proof",
            "Anchor in results, testimonials, numbers or recognisable customer situations (never invent statistics).",
        ),
        Angle(
            "behind_the_scenes",
            "Behind the scenes",
            "Show the people, process or craft behind the brand. Authentic, unpolished, human.",
        ),
    )
}

# Preferred angle order per objective — the first N are used for N variations.
_OBJECTIVE_ORDER: dict[Objective, tuple[str, ...]] = {
    Objective.AWARENESS: ("bold", "story", "curiosity", "conversational", "educational", "behind_the_scenes"),
    Objective.ENGAGEMENT: ("conversational", "curiosity", "bold", "story", "educational", "behind_the_scenes"),
    Objective.EDUCATION: ("educational", "direct", "curiosity", "story", "bold", "conversational"),
    Objective.PROMOTION: ("direct", "social_proof", "story", "bold", "curiosity", "conversational"),
    Objective.LEAD_GENERATION: ("educational", "direct", "social_proof", "curiosity", "story", "bold"),
    Objective.SALES: ("direct", "social_proof", "story", "bold", "curiosity", "educational"),
    Objective.STORYTELLING: ("story", "behind_the_scenes", "conversational", "bold", "curiosity", "educational"),
    Objective.COMMUNITY: ("conversational", "behind_the_scenes", "story", "curiosity", "educational", "bold"),
}

# Quotes read better with tonal rather than structural differences.
_QUOTE_ORDER = (
    "direct",
    "bold",
    "conversational",
    "story",
    "educational",
    "curiosity",
    "social_proof",
    "behind_the_scenes",
)


def angles_for(content_type: ContentType, objective: Objective, count: int) -> list[Angle]:
    order = _QUOTE_ORDER if content_type == ContentType.QUOTE else _OBJECTIVE_ORDER[objective]
    keys = list(dict.fromkeys([*order, *ANGLES.keys()]))
    return [ANGLES[key] for key in keys[:count]]
