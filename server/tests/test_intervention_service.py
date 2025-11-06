"""Unit tests for InterventionService.

Tests business logic layer with mocked LLM provider.
Ensures proper delegation, validation, and safety guards.

Constitutional Compliance:
- Article III (TDD): Critical service layer tests
- Article V (Documentation): Complete test documentation
"""

from datetime import UTC, datetime
from unittest.mock import Mock

import pytest

from server.application.services.intervention_service import InterventionService
from server.domain.llm_provider import LLMProvider
from server.domain.models.anchor import AnchorPos
from server.domain.models.intervention import ClientMeta, InterventionRequest, InterventionResponse


class TestInterventionService:
    """Test suite for InterventionService business logic."""

    @pytest.fixture
    def mock_llm_provider(self) -> Mock:
        """Create mock LLM provider."""
        mock = Mock(spec=LLMProvider)
        return mock

    @pytest.fixture
    def service(self, mock_llm_provider: Mock) -> InterventionService:
        """Create InterventionService with mocked dependencies."""
        return InterventionService(llm_provider=mock_llm_provider)

    @pytest.fixture
    def valid_muse_request(self) -> InterventionRequest:
        """Create valid Muse mode request."""
        return InterventionRequest(
            context="他打开门，犹豫着要不要进去。",
            mode="muse",
            client_meta=ClientMeta(
                doc_version=42,
                selection_from=1234,
                selection_to=1234,
            ),
        )

    def test_delegates_to_llm_provider(
        self,
        service: InterventionService,
        mock_llm_provider: Mock,
        valid_muse_request: InterventionRequest,
    ) -> None:
        """Test that service delegates to LLM provider with correct parameters."""
        # Arrange
        expected_response = InterventionResponse(
            action="provoke",
            content="> [AI施压 - Muse]: Test content",
            lock_id="lock_test_001",
            anchor=AnchorPos(from_=1234),
            action_id="act_test_001",
            issued_at=datetime.now(UTC),
        )
        mock_llm_provider.generate_intervention.return_value = expected_response

        # Act
        response = service.generate_intervention(valid_muse_request)

        # Assert
        mock_llm_provider.generate_intervention.assert_called_once_with(
            context="他打开门，犹豫着要不要进去。",
            mode="muse",
            doc_version=42,
            selection_from=1234,
            selection_to=1234,
        )
        assert response == expected_response

    def test_safety_guard_prevents_delete_on_short_context(
        self, service: InterventionService, mock_llm_provider: Mock
    ) -> None:
        """Test safety guard forces provoke when context <50 chars and LLM returns delete."""
        # Arrange - Short context (30 chars)
        short_request = InterventionRequest(
            context="Too short for delete action.",  # 30 chars
            mode="loki",
            client_meta=ClientMeta(doc_version=1, selection_from=0, selection_to=0),
        )

        # LLM wants to delete
        llm_delete_response = InterventionResponse(
            action="delete",
            content=None,
            lock_id=None,
            anchor=AnchorPos(from_=0),
            action_id="act_delete_001",
            issued_at=datetime.now(UTC),
        )
        mock_llm_provider.generate_intervention.return_value = llm_delete_response

        # Act
        response = service.generate_intervention(short_request)

        # Assert - Service overrides to provoke
        assert response.action == "provoke"
        assert response.content is not None
        assert "> [AI施压 - 保护]" in response.content or "文档内容太少" in response.content
        assert response.lock_id is not None
        assert response.lock_id.startswith("lock_")

    def test_allows_delete_on_sufficient_context(
        self, service: InterventionService, mock_llm_provider: Mock
    ) -> None:
        """Test delete action is allowed when context >= 50 chars."""
        # Arrange - Sufficient context (100 chars)
        long_request = InterventionRequest(
            context=(
                "This is a sufficiently long context that has more than "
                "fifty characters in total for deletion." * 2
            ),
            mode="loki",
            client_meta=ClientMeta(doc_version=1, selection_from=0, selection_to=100),
        )

        llm_delete_response = InterventionResponse(
            action="delete",
            content=None,
            lock_id=None,
            anchor=AnchorPos(from_=50),
            action_id="act_delete_002",
            issued_at=datetime.now(UTC),
        )
        mock_llm_provider.generate_intervention.return_value = llm_delete_response

        # Act
        response = service.generate_intervention(long_request)

        # Assert - Delete is preserved
        assert response.action == "delete"
        assert response.content is None
        assert response.lock_id is None

    def test_preserves_provoke_action_unchanged(
        self,
        service: InterventionService,
        mock_llm_provider: Mock,
        valid_muse_request: InterventionRequest,
    ) -> None:
        """Test provoke actions pass through without modification."""
        # Arrange
        llm_provoke_response = InterventionResponse(
            action="provoke",
            content="> [AI施压 - Muse]: Original content",
            lock_id="lock_original_001",
            anchor=AnchorPos(from_=1234),
            action_id="act_provoke_001",
            issued_at=datetime.now(UTC),
        )
        mock_llm_provider.generate_intervention.return_value = llm_provoke_response

        # Act
        response = service.generate_intervention(valid_muse_request)

        # Assert - No modifications
        assert response == llm_provoke_response
        assert response.action == "provoke"
        assert response.content == "> [AI施压 - Muse]: Original content"
        assert response.lock_id == "lock_original_001"

    def test_handles_loki_mode(self, service: InterventionService, mock_llm_provider: Mock) -> None:
        """Test Loki mode requests are handled correctly."""
        # Arrange
        loki_request = InterventionRequest(
            context="Long enough context for Loki mode with sufficient characters.",
            mode="loki",
            client_meta=ClientMeta(doc_version=10, selection_from=500, selection_to=550),
        )

        loki_response = InterventionResponse(
            action="provoke",
            content="> [AI施压 - Loki]: Chaos content",
            lock_id="lock_loki_001",
            anchor=AnchorPos(from_=500),
            action_id="act_loki_001",
            issued_at=datetime.now(UTC),
        )
        mock_llm_provider.generate_intervention.return_value = loki_response

        # Act
        response = service.generate_intervention(loki_request)

        # Assert
        mock_llm_provider.generate_intervention.assert_called_once_with(
            context=loki_request.context,
            mode="loki",
            doc_version=10,
            selection_from=500,
            selection_to=550,
        )
        assert response.action == "provoke"

    def test_handles_zero_values_in_client_meta(
        self, service: InterventionService, mock_llm_provider: Mock
    ) -> None:
        """Test handling of zero/boundary values in client_meta fields."""
        # Arrange - Zero values for edge case testing
        zero_meta_request = InterventionRequest(
            context="Test context with zero metadata values.",
            mode="muse",
            client_meta=ClientMeta(
                doc_version=0,
                selection_from=0,
                selection_to=0,
            ),
        )

        mock_response = InterventionResponse(
            action="provoke",
            content="> [AI施压]: Content",
            lock_id="lock_001",
            anchor=AnchorPos(from_=0),
            action_id="act_001",
            issued_at=datetime.now(UTC),
        )
        mock_llm_provider.generate_intervention.return_value = mock_response

        # Act
        response = service.generate_intervention(zero_meta_request)

        # Assert
        mock_llm_provider.generate_intervention.assert_called_once_with(
            context=zero_meta_request.context,
            mode="muse",
            doc_version=0,
            selection_from=0,
            selection_to=0,
        )
        assert response.action == "provoke"

    def test_safety_guard_boundary_exactly_50_chars(
        self, service: InterventionService, mock_llm_provider: Mock
    ) -> None:
        """Test safety guard boundary: exactly 50 characters should allow delete."""
        # Arrange - Exactly 50 chars
        exact_request = InterventionRequest(
            context="1234567890" * 5,  # Exactly 50 characters
            mode="loki",
            client_meta=ClientMeta(doc_version=1, selection_from=0, selection_to=50),
        )

        llm_delete_response = InterventionResponse(
            action="delete",
            content=None,
            lock_id=None,
            anchor=AnchorPos(from_=25),
            action_id="act_boundary_001",
            issued_at=datetime.now(UTC),
        )
        mock_llm_provider.generate_intervention.return_value = llm_delete_response

        # Act
        response = service.generate_intervention(exact_request)

        # Assert - 50 chars is NOT < 50, so delete is allowed
        assert response.action == "delete"

    def test_safety_guard_boundary_49_chars(
        self, service: InterventionService, mock_llm_provider: Mock
    ) -> None:
        """Test safety guard boundary: 49 characters should force provoke."""
        # Arrange - 49 chars (just under threshold)
        short_request = InterventionRequest(
            context="1234567890" * 4 + "123456789",  # 49 characters
            mode="loki",
            client_meta=ClientMeta(doc_version=1, selection_from=0, selection_to=49),
        )

        llm_delete_response = InterventionResponse(
            action="delete",
            content=None,
            lock_id=None,
            anchor=AnchorPos(from_=25),
            action_id="act_boundary_002",
            issued_at=datetime.now(UTC),
        )
        mock_llm_provider.generate_intervention.return_value = llm_delete_response

        # Act
        response = service.generate_intervention(short_request)

        # Assert - 49 chars < 50, so forced to provoke
        assert response.action == "provoke"
        assert response.lock_id is not None
