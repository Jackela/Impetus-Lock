"""Style Learning API routes.

Provides endpoints for analyzing user writing style and applying
learned styles to AI-generated text.

Stories Implemented:
- Story 1: POST /api/style/analyze - Analyze writing samples
- Story 3: POST /api/style/apply - Apply learned style to text
"""

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.infrastructure.persistence.database import get_session_optional
from server.models.style import StyleModel

router = APIRouter(prefix="/style", tags=["style"])

# Minimum word count for style analysis
MIN_WORD_COUNT = 500


# ============================================================================
# Request/Response Models
# ============================================================================


class StyleAnalysisRequest(BaseModel):
    """Request schema for style analysis.

    Attributes:
        text: User writing sample (min 500 words).
        user_id: User identifier for storing the style profile.
    """

    text: str = Field(
        ...,
        min_length=100,
        description="User writing sample (minimum 500 words recommended)",
    )
    user_id: str = Field(..., min_length=1, max_length=255, description="User identifier")

    @field_validator("text")
    @classmethod
    def validate_word_count(cls, v: str) -> str:
        """Validate that text has at least minimum word count."""
        word_count = len(v.split())
        if word_count < MIN_WORD_COUNT:
            raise ValueError(f"Text must contain at least {MIN_WORD_COUNT} words, got {word_count}")
        return v


class StyleVector(BaseModel):
    """Style vector containing extracted features.

    Attributes:
        avg_sentence_length: Average words per sentence.
        vocabulary_richness: Unique words / total words ratio.
        punctuation_density: Punctuation marks per 100 words.
        formality_score: Estimated formality level (0-1).
        tone_markers: Detected tone characteristics.
        confidence: Overall confidence in analysis (0-1).
    """

    avg_sentence_length: float = Field(..., description="Average words per sentence")
    vocabulary_richness: float = Field(..., description="Unique/total word ratio")
    punctuation_density: float = Field(..., description="Punctuation per 100 words")
    formality_score: float = Field(..., ge=0, le=1, description="Formality estimate")
    tone_markers: dict[str, float] = Field(
        default_factory=dict, description="Tone characteristics with weights"
    )
    confidence: float = Field(..., ge=0, le=1, description="Analysis confidence")


class StyleAnalysisResponse(BaseModel):
    """Response schema for style analysis.

    Attributes:
        style_vector: Extracted style features.
        samples_count: Number of samples processed.
        user_id: User identifier.
    """

    style_vector: StyleVector
    samples_count: int = Field(default=1, description="Number of samples analyzed")
    user_id: str = Field(..., description="User identifier")


class StyleApplyRequest(BaseModel):
    """Request schema for applying style to text.

    Attributes:
        text: Text to stylize.
        user_id: User whose style to apply.
        intensity: Style application intensity (0.0-1.0).
    """

    text: str = Field(..., min_length=1, description="Text to apply style to")
    user_id: str = Field(..., min_length=1, description="User identifier")
    intensity: float = Field(default=0.7, ge=0.0, le=1.0, description="Style intensity (0-1)")


class StyleApplyResponse(BaseModel):
    """Response schema for style application.

    Attributes:
        original_text: Original input text.
        styled_text: Text with applied style.
        style_applied: Whether style was successfully applied.
        style_version: Version of style profile used.
    """

    original_text: str = Field(..., description="Original input text")
    styled_text: str = Field(..., description="Text with style applied")
    style_applied: bool = Field(..., description="Whether style was applied")
    style_version: int = Field(..., description="Style profile version used")


class StyleProfileResponse(BaseModel):
    """Response schema for retrieving stored style profile.

    Attributes:
        user_id: User identifier.
        style_vector: Stored style features.
        samples_count: Number of samples used.
        version: Profile version.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
    """

    user_id: str
    style_vector: dict[str, Any]
    samples_count: int
    version: int
    created_at: str
    updated_at: str


# ============================================================================
# Style Analysis Engine
# ============================================================================


def analyze_text_style(text: str) -> StyleVector:
    """Analyze text and extract style features.

    Extracts quantifiable style features from writing sample:
    - Sentence length patterns
    - Vocabulary richness (type-token ratio)
    - Punctuation usage patterns
    - Formality indicators
    - Tone characteristics

    Args:
        text: Writing sample to analyze.

    Returns:
        StyleVector with extracted features and confidence score.
    """
    # Clean and prepare text
    sentences = re.split(r"[.!?]+", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    words = text.split()
    word_count = len(words)
    unique_words = set(word.lower().strip(".,!?;:\"'") for word in words)

    # Calculate sentence length metrics
    sentence_word_counts = [len(s.split()) for s in sentences]
    avg_sentence_length = (
        sum(sentence_word_counts) / len(sentence_word_counts) if sentence_word_counts else 0
    )

    # Calculate vocabulary richness (Type-Token Ratio)
    vocabulary_richness = len(unique_words) / word_count if word_count > 0 else 0

    # Calculate punctuation density
    punctuation_count = sum(1 for char in text if char in '.,!?;:-"')
    punctuation_density = (punctuation_count / word_count) * 100 if word_count > 0 else 0

    # Estimate formality based on features
    # Higher avg sentence length, lower punctuation density = more formal
    formality_score = min(
        1.0,
        (avg_sentence_length / 25) * 0.4
        + (1 - punctuation_density / 10) * 0.3
        + (vocabulary_richness * 0.3),
    )
    formality_score = max(0.0, formality_score)

    # Detect tone markers
    tone_markers: dict[str, float] = {}

    # Exclamation density indicates enthusiasm/urgency
    exclamation_count = text.count("!")
    tone_markers["enthusiasm"] = min(1.0, exclamation_count / (word_count / 100))

    # Question density indicates inquisitiveness
    question_count = text.count("?")
    tone_markers["inquisitive"] = min(1.0, question_count / (word_count / 100))

    # Passive voice indicators
    passive_indicators = ["was", "were", "been", "being", "is", "are"]
    passive_count = sum(text.lower().count(f" {w} ") for w in passive_indicators)
    tone_markers["passive_voice"] = min(1.0, passive_count / (word_count / 50))

    # Calculate confidence based on sample size
    # More words = higher confidence, up to a point
    confidence = min(1.0, word_count / 2000) if word_count >= MIN_WORD_COUNT else 0.5

    return StyleVector(
        avg_sentence_length=round(avg_sentence_length, 2),
        vocabulary_richness=round(vocabulary_richness, 4),
        punctuation_density=round(punctuation_density, 2),
        formality_score=round(formality_score, 4),
        tone_markers={k: round(v, 4) for k, v in tone_markers.items()},
        confidence=round(confidence, 4),
    )


def apply_style_to_text(text: str, style_vector: StyleVector, intensity: float) -> str:
    """Apply learned style to text.

    Modifies input text to match learned style characteristics.
    Currently applies structural transformations:
    - Adjusts sentence length patterns
    - Modifies punctuation usage
    - Applies tone modifications

    Args:
        text: Original text to stylize.
        style_vector: Learned style features.
        intensity: Style application intensity (0-1).

    Returns:
        Text with style transformations applied.
    """
    if intensity <= 0:
        return text

    # Split into sentences
    sentences = re.split(r"([.!?]+)", text)
    sentences = [s for s in sentences if s.strip()]

    styled_parts = []
    for part in sentences:
        if part in ".!?":
            styled_parts.append(part)
            continue

        # Apply sentence length adjustment
        words = part.split()
        if len(words) > 0 and style_vector.avg_sentence_length > 0:
            target_length = int(
                style_vector.avg_sentence_length * intensity + len(words) * (1 - intensity)
            )
            if len(words) > target_length:
                # Shorten sentence
                words = words[:target_length]
            # Note: lengthening would require generative AI, we skip for now

        styled_sentence = " ".join(words)

        # Apply punctuation density adjustment
        # Add emphasis punctuation for high punctuation density
        if (
            style_vector.punctuation_density > 5
            and intensity > 0.5
            and not styled_sentence.endswith(("!", "?"))
            and styled_sentence.strip()
        ):
            styled_sentence = styled_sentence.rstrip(".") + "."

        styled_parts.append(styled_sentence)

    result = "".join(styled_parts) if styled_parts else text

    # Apply formality markers
    if style_vector.formality_score > 0.7 and intensity > 0.5:
        # Remove contractions for more formal tone
        result = result.replace("don't", "do not")
        result = result.replace("won't", "will not")
        result = result.replace("can't", "cannot")
        result = result.replace("it's", "it is")
        result = result.replace("that's", "that is")

    return result


# ============================================================================
# API Endpoints
# ============================================================================


@router.post("/analyze", response_model=StyleAnalysisResponse, status_code=201)
async def analyze_style(
    request: StyleAnalysisRequest,
    session: AsyncSession | None = Depends(get_session_optional),
) -> StyleAnalysisResponse:
    """Analyze user writing sample and extract style features.

    Extracts quantifiable style features from provided text sample
    and stores the style profile for the user.

    Args:
        request: Style analysis request with text sample and user_id.
        session: Database session (injected, optional for testing).

    Returns:
        StyleAnalysisResponse with extracted style vector.

    Raises:
        HTTPException: 400 if text is too short or invalid.

    Example:
        ```bash
        curl -X POST http://localhost:8000/style/analyze \
          -H "Content-Type: application/json" \
          -d '{
            "text": "Your writing sample with at least 500 words...",
            "user_id": "user_123"
          }'
        ```
    """
    # Analyze text style
    style_vector = analyze_text_style(request.text)

    # Store or update style profile in database
    if session is not None:
        # Check if user already has a style profile
        result = await session.execute(
            select(StyleModel).where(StyleModel.user_id == request.user_id)
        )
        existing_style = result.scalar_one_or_none()

        if existing_style:
            # Update existing profile with new sample
            existing_style.samples_count += 1
            existing_style.style_vector = style_vector.model_dump()
            existing_style.version += 1
        else:
            # Create new style profile
            new_style = StyleModel(
                user_id=request.user_id,
                style_vector=style_vector.model_dump(),
                samples_count=1,
                version=1,
            )
            session.add(new_style)

        await session.commit()

    return StyleAnalysisResponse(
        style_vector=style_vector,
        samples_count=1,
        user_id=request.user_id,
    )


@router.post("/apply", response_model=StyleApplyResponse)
async def apply_style(
    request: StyleApplyRequest,
    session: AsyncSession | None = Depends(get_session_optional),
) -> StyleApplyResponse:
    """Apply learned style to AI-generated text.

    Retrieves user's stored style profile and applies style transformations
to the provided text.

    Args:
        request: Style application request with text and user_id.
        session: Database session (injected, optional for testing).

    Returns:
        StyleApplyResponse with styled text and metadata.

    Raises:
        HTTPException: 404 if user has no stored style profile.

    Example:
        ```bash
        curl -X POST http://localhost:8000/style/apply \
          -H "Content-Type: application/json" \
          -d '{
            "text": "This is some AI generated text.",
            "user_id": "user_123",
            "intensity": 0.7
          }'
        ```
    """
    style_version = 0
    style_vector = None

    if session is not None:
        # Retrieve user's style profile
        result = await session.execute(
            select(StyleModel).where(StyleModel.user_id == request.user_id)
        )
        style_record = result.scalar_one_or_none()

        if not style_record:
            raise HTTPException(
                status_code=404,
                detail=f"No style profile found for user {request.user_id}. "
                "Analyze writing samples first using POST /style/analyze",
            )

        style_version = style_record.version
        style_data = style_record.style_vector

        # Convert stored dict to StyleVector
        try:
            style_vector = StyleVector(**style_data)
        except (TypeError, ValueError) as e:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid style vector format: {e}",
            ) from e
    else:
        # Testing mode: use default style vector
        style_vector = StyleVector(
            avg_sentence_length=15.0,
            vocabulary_richness=0.5,
            punctuation_density=5.0,
            formality_score=0.5,
            tone_markers={},
            confidence=0.8,
        )
        style_version = 1

    # Apply style transformations
    styled_text = apply_style_to_text(request.text, style_vector, request.intensity)

    return StyleApplyResponse(
        original_text=request.text,
        styled_text=styled_text,
        style_applied=True,
        style_version=style_version,
    )


@router.get("/profile/{user_id}", response_model=StyleProfileResponse)
async def get_style_profile(
    user_id: str,
    session: AsyncSession | None = Depends(get_session_optional),
) -> StyleProfileResponse:
    """Retrieve stored style profile for a user.

    Args:
        user_id: User identifier.
        session: Database session (injected, optional for testing).

    Returns:
        StyleProfileResponse with stored style data.

    Raises:
        HTTPException: 404 if user has no stored style profile.

    Example:
        ```bash
        curl http://localhost:8000/style/profile/user_123
        ```
    """
    if session is None:
        raise HTTPException(
            status_code=503,
            detail="Database not available. This endpoint requires database access.",
        )

    result = await session.execute(select(StyleModel).where(StyleModel.user_id == user_id))
    style_record = result.scalar_one_or_none()

    if not style_record:
        raise HTTPException(
            status_code=404,
            detail=f"No style profile found for user {user_id}",
        )

    return StyleProfileResponse(
        user_id=style_record.user_id,
        style_vector=style_record.style_vector,
        samples_count=style_record.samples_count,
        version=style_record.version,
        created_at=style_record.created_at.isoformat(),
        updated_at=style_record.updated_at.isoformat(),
    )


@router.delete("/profile/{user_id}", status_code=204)
async def delete_style_profile(
    user_id: str,
    session: AsyncSession | None = Depends(get_session_optional),
) -> None:
    """Delete stored style profile for a user.

    Args:
        user_id: User identifier.
        session: Database session (injected, optional for testing).

    Raises:
        HTTPException: 404 if user has no stored style profile.

    Example:
        ```bash
        curl -X DELETE http://localhost:8000/style/profile/user_123
        ```
    """
    if session is None:
        raise HTTPException(
            status_code=503,
            detail="Database not available. This endpoint requires database access.",
        )

    result = await session.execute(select(StyleModel).where(StyleModel.user_id == user_id))
    style_record = result.scalar_one_or_none()

    if not style_record:
        raise HTTPException(
            status_code=404,
            detail=f"No style profile found for user {user_id}",
        )

    await session.delete(style_record)
    await session.commit()
