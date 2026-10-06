"""Customer-facing choices (platforms, content types, objectives, tones, quality tiers…).

Each option carries a plain-language label and description so the UI never needs to
hard-code them; the frontend reads them from ``GET /api/v1/catalog``.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel


class Platform(StrEnum):
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    FACEBOOK = "facebook"
    LINKEDIN = "linkedin"
    YOUTUBE = "youtube"


class ContentType(StrEnum):
    REEL = "reel"
    CAPTION = "caption"
    QUOTE = "quote"
    POST_IDEA = "post_idea"


class Objective(StrEnum):
    AWARENESS = "awareness"
    ENGAGEMENT = "engagement"
    EDUCATION = "education"
    PROMOTION = "promotion"
    LEAD_GENERATION = "lead_generation"
    SALES = "sales"
    STORYTELLING = "storytelling"
    COMMUNITY = "community"


class Tone(StrEnum):
    PROFESSIONAL = "professional"
    CONVERSATIONAL = "conversational"
    BOLD = "bold"
    LUXURY = "luxury"
    PLAYFUL = "playful"
    EDUCATIONAL = "educational"
    INSPIRATIONAL = "inspirational"
    DIRECT = "direct"


class Quality(StrEnum):
    AUTO = "auto"
    FAST = "fast"
    PROFESSIONAL = "professional"
    PREMIUM = "premium"


class CaptionLength(StrEnum):
    SHORT = "short"
    MEDIUM = "medium"
    LONG = "long"


class CaptionStyle(StrEnum):
    GENERAL = "general"
    PROMOTIONAL = "promotional"
    EDUCATIONAL = "educational"
    STORYTELLING = "storytelling"
    ENGAGEMENT = "engagement"
    PRODUCT = "product"
    SERVICE = "service"
    ANNOUNCEMENT = "announcement"


class QuoteCategory(StrEnum):
    MOTIVATIONAL = "motivational"
    EDUCATIONAL = "educational"
    INDUSTRY = "industry"
    BUSINESS = "business"
    INSPIRATIONAL = "inspirational"
    THOUGHT_LEADERSHIP = "thought_leadership"
    BRAND_STATEMENT = "brand_statement"
    SHORT_SOCIAL = "short_social"
    QUOTE_CARD = "quote_card"


class EmojiStyle(StrEnum):
    NONE = "none"
    LIGHT = "light"
    EXPRESSIVE = "expressive"


class Option(BaseModel):
    value: str
    label: str
    description: str = ""
    available: bool = True


class PlatformSpec(BaseModel):
    value: Platform
    label: str
    available: bool
    caption_max_chars: int
    max_hashtags: int
    video_label: str
    guidance: str


PLATFORMS: dict[Platform, PlatformSpec] = {
    Platform.INSTAGRAM: PlatformSpec(
        value=Platform.INSTAGRAM,
        label="Instagram",
        available=True,
        caption_max_chars=2200,
        max_hashtags=30,
        video_label="Reel",
        guidance=(
            "Instagram rewards a strong first line (only ~125 characters show before 'more'), "
            "vertical 9:16 video, native-feeling visuals, saves and shares. "
            "Line breaks improve readability."
        ),
    ),
    Platform.TIKTOK: PlatformSpec(
        value=Platform.TIKTOK,
        label="TikTok",
        available=False,
        caption_max_chars=4000,
        max_hashtags=8,
        video_label="TikTok video",
        guidance="Fast hooks within 1 second, trend-aware, casual native tone.",
    ),
    Platform.FACEBOOK: PlatformSpec(
        value=Platform.FACEBOOK,
        label="Facebook",
        available=False,
        caption_max_chars=63206,
        max_hashtags=3,
        video_label="Facebook Reel",
        guidance="Community-oriented, conversational, fewer hashtags.",
    ),
    Platform.LINKEDIN: PlatformSpec(
        value=Platform.LINKEDIN,
        label="LinkedIn",
        available=False,
        caption_max_chars=3000,
        max_hashtags=5,
        video_label="LinkedIn video",
        guidance="Professional insight, first-person expertise, clear takeaways.",
    ),
    Platform.YOUTUBE: PlatformSpec(
        value=Platform.YOUTUBE,
        label="YouTube",
        available=False,
        caption_max_chars=5000,
        max_hashtags=15,
        video_label="YouTube Short",
        guidance="Searchable titles, strong retention hooks, clear payoff.",
    ),
}

CONTENT_TYPE_LABELS: dict[ContentType, tuple[str, str]] = {
    ContentType.REEL: ("Reel", "A complete short-video plan: hook, shots, script, on-screen text and caption."),
    ContentType.CAPTION: ("Caption", "Ready-to-post captions with a strong opening line and call to action."),
    ContentType.QUOTE: ("Quote", "Shareable quotes for posts, stories and quote cards."),
    ContentType.POST_IDEA: ("Post idea", "A fully-formed post concept with format, outline and caption."),
}

OBJECTIVE_LABELS: dict[Objective, tuple[str, str]] = {
    Objective.AWARENESS: ("Awareness", "Get discovered by new people."),
    Objective.ENGAGEMENT: ("Engagement", "Spark comments, saves and shares."),
    Objective.EDUCATION: ("Education", "Teach something useful."),
    Objective.PROMOTION: ("Promotion", "Showcase an offer, product or event."),
    Objective.LEAD_GENERATION: ("Lead generation", "Encourage enquiries, sign-ups or DMs."),
    Objective.SALES: ("Sales", "Drive purchases or bookings."),
    Objective.STORYTELLING: ("Storytelling", "Share a story that builds connection."),
    Objective.COMMUNITY: ("Community building", "Make followers feel part of something."),
}

TONE_LABELS: dict[Tone, tuple[str, str]] = {
    Tone.PROFESSIONAL: ("Professional", "Polished, credible and clear."),
    Tone.CONVERSATIONAL: ("Conversational", "Friendly, like talking to a customer."),
    Tone.BOLD: ("Bold", "Confident, punchy, a little provocative."),
    Tone.LUXURY: ("Luxury", "Refined, elegant and understated."),
    Tone.PLAYFUL: ("Playful", "Light-hearted, witty and fun."),
    Tone.EDUCATIONAL: ("Educational", "Clear, helpful and explanatory."),
    Tone.INSPIRATIONAL: ("Inspirational", "Uplifting and motivating."),
    Tone.DIRECT: ("Direct", "Straight to the point, no fluff."),
}

QUALITY_LABELS: dict[Quality, tuple[str, str]] = {
    Quality.AUTO: ("Auto", "Recommended. We pick the right AI for each request."),
    Quality.FAST: ("Fast", "Quick, everyday content."),
    Quality.PROFESSIONAL: ("Professional", "Higher quality for important business content."),
    Quality.PREMIUM: ("Premium", "Our best quality for campaigns, scripts and client work."),
}

CAPTION_STYLE_LABELS: dict[CaptionStyle, str] = {
    CaptionStyle.GENERAL: "General",
    CaptionStyle.PROMOTIONAL: "Promotional",
    CaptionStyle.EDUCATIONAL: "Educational",
    CaptionStyle.STORYTELLING: "Storytelling",
    CaptionStyle.ENGAGEMENT: "Engagement",
    CaptionStyle.PRODUCT: "Product",
    CaptionStyle.SERVICE: "Service",
    CaptionStyle.ANNOUNCEMENT: "Announcement",
}

QUOTE_CATEGORY_LABELS: dict[QuoteCategory, str] = {
    QuoteCategory.MOTIVATIONAL: "Motivational",
    QuoteCategory.EDUCATIONAL: "Educational",
    QuoteCategory.INDUSTRY: "Industry insight",
    QuoteCategory.BUSINESS: "Business",
    QuoteCategory.INSPIRATIONAL: "Inspirational",
    QuoteCategory.THOUGHT_LEADERSHIP: "Thought leadership",
    QuoteCategory.BRAND_STATEMENT: "Brand statement",
    QuoteCategory.SHORT_SOCIAL: "Short social quote",
    QuoteCategory.QUOTE_CARD: "Quote-card text",
}

REEL_DURATIONS = (15, 30, 45, 60)
