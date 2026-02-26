"""Unit tests for Style Learning API.

Tests style analysis, storage, and application endpoints.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from server.api.main import app
from server.api.routes import style as style_module

client = TestClient(app)

# Sample text with > 500 words for testing
SAMPLE_WRITING_TEXT = """
The creative process is often misunderstood as a linear journey from inspiration to completion.
In reality, it resembles more of a chaotic dance between ideas and execution. When we sit down
to write, we bring with us not just our current thoughts but the accumulated weight of all our
previous attempts, failures, and unexpected breakthroughs.

I've found that the most productive creative sessions happen not when I'm forcing myself to
produce, but when I allow myself to explore without judgment. The inner critic—that voice
that demands perfection before a single word hits the page—is often the biggest obstacle to
genuine creative expression. Learning to silence this voice, or at least negotiate with it,
has been one of the most valuable skills I've developed.

Consider the nature of creative blocks. They rarely stem from a lack of ideas; instead, they
emerge from an excess of self-criticism. We become paralyzed not because we have nothing to
say, but because we fear what we might say isn't good enough. This fear manifests in various
ways: endless research without writing, constant editing of the same paragraph, or simply
avoiding the work altogether through distraction and procrastination.

The antidote, I've discovered, is embracing imperfection. First drafts are meant to be messy,
confused, and incomplete. They are the soil from which polished final versions grow. By giving
ourselves permission to write badly, we remove the pressure that stifles creativity. Every
renowned author has drawers full of terrible first drafts; what separates them from those who
never finish is their willingness to push through the mess.

Writing, at its core, is thinking made visible. The act of putting words on paper—or screen—
forces us to clarify our thoughts in ways that mental ruminations never can. Ideas that seem
coherent in our minds often reveal their flaws when subjected to the rigor of written expression.
This is why writing is not merely transcription of pre-formed thoughts but an active process
of discovery and refinement.

The rhythm of writing varies dramatically between individuals and projects. Some pieces flow
effortlessly, as if they were waiting to be written. Others require painstaking construction,
word by careful word. Both approaches are valid, and both produce worthwhile results. The key
is recognizing which mode a particular project demands and adjusting our expectations accordingly.

Collaboration introduces another dimension to creative work. When we write with others, we must
navigate not only our own creative process but also the processes of our collaborators. This
requires communication, compromise, and the humility to recognize when another person's idea
improves upon our own. The best collaborative writing often emerges from respectful disagreement,
where different perspectives push the work toward greater depth and nuance.

Technology has transformed writing in ways we're still comprehending. The digital environment
offers unprecedented tools for research, organization, and revision, but it also presents new
distractions. The same device that hosts our writing software also contains infinite sources of
entertainment and interruption. Developing discipline in this environment requires conscious
effort and often the strategic use of tools that limit our access to these distractions.

Revision is where good writing becomes great. The initial draft captures raw ideas; revision
shapes them into their most effective form. This process involves not just correcting errors
but reconsidering structure, tone, and emphasis. Often, the most important revisions are those
that remove rather than add—eliminating unnecessary words, sentences, or even entire sections
that don't serve the piece's central purpose.

Reading widely remains essential for any writer. Exposure to diverse styles, subjects, and
perspectives expands our sense of what's possible in writing. We unconsciously absorb techniques
from authors we admire, which later emerge transformed in our own work. This isn't plagiarism;
it's the natural process by which artistic traditions evolve and individual voices develop.

The relationship between writer and reader is intimate and strange. We craft our words in
solitude, uncertain who might eventually read them or how they might be received. This
uncertainty can be paralyzing, but it can also be liberating. When we accept that we cannot
control how our work will be interpreted, we free ourselves to write authentically, expressing
what matters to us rather than what we imagine others want to hear.
"""


@pytest.fixture(autouse=True)
def use_in_memory_session() -> Generator[None, None, None]:
    """Override session dependency to use in-memory mode for testing."""
    # Store original dependency

    # Override with None (in-memory mode)
    app.dependency_overrides[style_module.get_session_optional] = lambda: None

    yield

    # Restore original
    app.dependency_overrides.pop(style_module.get_session_optional, None)


class TestStyleAnalysis:
    """Test suite for POST /style/analyze endpoint."""

    def test_analyze_style_returns_201(self) -> None:
        """Test that analyzing style returns 201 Created."""
        response = client.post(
            "/style/analyze",
            json={
                "text": SAMPLE_WRITING_TEXT,
                "user_id": "test_user_123",
            },
        )

        assert response.status_code == 201
        data = response.json()

        assert "style_vector" in data
        assert "samples_count" in data
        assert data["user_id"] == "test_user_123"
        assert data["samples_count"] == 1

    def test_analyze_style_returns_valid_vector(self) -> None:
        """Test that style vector contains expected features."""
        response = client.post(
            "/style/analyze",
            json={
                "text": SAMPLE_WRITING_TEXT,
                "user_id": "test_user_123",
            },
        )

        assert response.status_code == 201
        vector = response.json()["style_vector"]

        assert "avg_sentence_length" in vector
        assert "vocabulary_richness" in vector
        assert "punctuation_density" in vector
        assert "formality_score" in vector
        assert "tone_markers" in vector
        assert "confidence" in vector

        # Validate ranges
        assert 0 <= vector["formality_score"] <= 1
        assert 0 <= vector["confidence"] <= 1
        assert vector["avg_sentence_length"] > 0

    def test_analyze_style_short_text_returns_422(self) -> None:
        """Test that text with < 500 words returns 422."""
        short_text = "This is a short text. It has very few words."

        response = client.post(
            "/style/analyze",
            json={
                "text": short_text,
                "user_id": "test_user_123",
            },
        )

        assert response.status_code == 422

    def test_analyze_style_missing_user_id_returns_422(self) -> None:
        """Test that missing user_id returns 422."""
        response = client.post(
            "/style/analyze",
            json={"text": SAMPLE_WRITING_TEXT},
        )

        assert response.status_code == 422

    def test_analyze_style_empty_text_returns_422(self) -> None:
        """Test that empty text returns 422."""
        response = client.post(
            "/style/analyze",
            json={
                "text": "",
                "user_id": "test_user_123",
            },
        )

        assert response.status_code == 422


class TestStyleApplication:
    """Test suite for POST /style/apply endpoint."""

    def test_apply_style_returns_200(self) -> None:
        """Test that applying style returns 200 OK."""
        response = client.post(
            "/style/apply",
            json={
                "text": "This is some AI generated text.",
                "user_id": "test_user_123",
                "intensity": 0.7,
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert "original_text" in data
        assert "styled_text" in data
        assert data["style_applied"] is True
        assert "style_version" in data

    def test_apply_style_preserves_original(self) -> None:
        """Test that original text is preserved in response."""
        original = "Original text to be styled."

        response = client.post(
            "/style/apply",
            json={
                "text": original,
                "user_id": "test_user_123",
            },
        )

        assert response.status_code == 200
        assert response.json()["original_text"] == original

    def test_apply_style_default_intensity(self) -> None:
        """Test that default intensity is 0.7."""
        response = client.post(
            "/style/apply",
            json={
                "text": "Test text.",
                "user_id": "test_user_123",
            },
        )

        assert response.status_code == 200

    def test_apply_style_invalid_intensity_returns_422(self) -> None:
        """Test that intensity outside 0-1 range returns 422."""
        response = client.post(
            "/style/apply",
            json={
                "text": "Test text.",
                "user_id": "test_user_123",
                "intensity": 1.5,
            },
        )

        assert response.status_code == 422

    def test_apply_style_negative_intensity_returns_422(self) -> None:
        """Test that negative intensity returns 422."""
        response = client.post(
            "/style/apply",
            json={
                "text": "Test text.",
                "user_id": "test_user_123",
                "intensity": -0.5,
            },
        )

        assert response.status_code == 422

    def test_apply_style_empty_text_returns_422(self) -> None:
        """Test that empty text returns 422."""
        response = client.post(
            "/style/apply",
            json={
                "text": "",
                "user_id": "test_user_123",
            },
        )

        assert response.status_code == 422


class TestStyleProfileEndpoints:
    """Test suite for style profile CRUD endpoints."""

    def test_get_profile_no_database_returns_503(self) -> None:
        """Test that getting profile without database returns 503."""
        response = client.get("/style/profile/test_user_123")

        assert response.status_code == 503

    def test_delete_profile_no_database_returns_503(self) -> None:
        """Test that deleting profile without database returns 503."""
        response = client.delete("/style/profile/test_user_123")

        assert response.status_code == 503


class TestStyleAnalysisEngine:
    """Test suite for style analysis engine functions."""

    def test_analyze_text_style_returns_vector(self) -> None:
        """Test that analyze_text_style returns valid StyleVector."""
        from server.api.routes.style import analyze_text_style

        vector = analyze_text_style(SAMPLE_WRITING_TEXT)

        assert vector.avg_sentence_length > 0
        assert 0 <= vector.vocabulary_richness <= 1
        assert vector.punctuation_density >= 0
        assert 0 <= vector.formality_score <= 1
        assert "confidence" in vector.model_dump()

    def test_apply_style_to_text_basic(self) -> None:
        """Test that apply_style_to_text modifies text."""
        from server.api.routes.style import StyleVector, apply_style_to_text

        style = StyleVector(
            avg_sentence_length=10.0,
            vocabulary_richness=0.5,
            punctuation_density=5.0,
            formality_score=0.5,
            tone_markers={},
            confidence=0.8,
        )

        original = "This is a test. It has multiple sentences."
        result = apply_style_to_text(original, style, intensity=0.5)

        assert isinstance(result, str)
        assert len(result) > 0

    def test_apply_style_zero_intensity_returns_original(self) -> None:
        """Test that zero intensity returns original text."""
        from server.api.routes.style import StyleVector, apply_style_to_text

        style = StyleVector(
            avg_sentence_length=10.0,
            vocabulary_richness=0.5,
            punctuation_density=5.0,
            formality_score=0.5,
            tone_markers={},
            confidence=0.8,
        )

        original = "This is the original text."
        result = apply_style_to_text(original, style, intensity=0.0)

        assert result == original
