"""Unit tests for Loki mode intervention logic.

Test Coverage:
- Random action selection (Provoke/Delete/Rewrite)
- Safety guard: doc length <50 chars → force Provoke
- Delete action includes valid anchor range
- Rewrite action carries lock_id + range

Constitutional Compliance:
- Article III (TDD): Tests written FIRST, implementation follows
- Article V (Documentation): Complete docstrings

Success Criteria:
- SC-006: Safety guard prevents deletion on short documents (100% enforcement)
- SC-007: Action distribution stays within defined proportions.
"""

from datetime import UTC, datetime
from unittest.mock import Mock

import pytest

from server.application.services.intervention_service import InterventionService
from server.domain.llm_provider import LLMProvider
from server.domain.models.anchor import AnchorPos, AnchorRange
from server.domain.models.intervention import ClientMeta, InterventionRequest, InterventionResponse


class TestLokiModeLogic:
    """Test suite for Loki mode decision logic and safety guards."""

    @pytest.fixture
    def mock_llm_provider(self) -> Mock:
        """Create mock LLM provider for testing."""
        return Mock(spec=LLMProvider)

    @pytest.fixture
    def intervention_service(self, mock_llm_provider: Mock) -> InterventionService:
        """Create InterventionService with mocked LLM provider."""
        return InterventionService(llm_provider=mock_llm_provider)

    def test_loki_mode_randomly_selects_provoke_or_delete(
        self, intervention_service: InterventionService, mock_llm_provider: Mock
    ) -> None:
        """Test that Loki mode can return either Provoke or Delete action.

        This test verifies that the LLM provider is called with Loki mode
        and can return either action type based on LLM decision.
        """
        # Mock LLM to return Provoke
        mock_llm_provider.generate_intervention.return_value = InterventionResponse(
            action="provoke",
            content="混乱开始了。",
            lock_id="lock_test123",
            anchor=AnchorPos(from_=100),
            action_id="act_test123",
            issued_at=datetime.now(UTC),
            source="loki",
        )

        # Need 50+ chars to pass safety guard - use longer Chinese text
        request = InterventionRequest(
            context=(
                "足够长的测试上下文内容，确保不会触发安全防护。"
                "需要超过五十个字符的长度来测试正常的Loki模式逻辑和功能。"
                "这里添加更多文本确保安全。"
            ),  # 65 chars
            mode="loki",
            client_meta=ClientMeta(
                doc_version=1,
                selection_from=100,
                selection_to=100,
            ),
        )

        response = intervention_service.generate_intervention(request)

        # Verify Provoke action
        assert response.action == "provoke"
        assert response.lock_id is not None
        assert response.content is not None
        assert response.source == "loki"

        # Now mock LLM to return Delete (should work with long context)
        mock_llm_provider.generate_intervention.return_value = InterventionResponse(
            action="delete",
            content=None,
            lock_id=None,
            anchor=AnchorRange(from_=50, to=100),
            action_id="act_test456",
            issued_at=datetime.now(UTC),
            source="loki",
        )

        response = intervention_service.generate_intervention(request)

        # Verify Delete action (safety guard should NOT trigger)
        assert response.action == "delete"
        assert response.anchor.type == "range"
        assert isinstance(response.anchor, AnchorRange)
        assert response.anchor.from_ < response.anchor.to
        assert response.source == "loki"

        # Finally mock rewrite
        mock_llm_provider.generate_intervention.return_value = InterventionResponse(
            action="rewrite",
            content="混沌改写句子",
            lock_id="lock_rewrite",
            anchor=AnchorRange(from_=80, to=120),
            action_id="act_test777",
            issued_at=datetime.now(UTC),
            source="loki",
        )

        rewrite_response = intervention_service.generate_intervention(request)
        assert rewrite_response.action == "rewrite"
        assert rewrite_response.lock_id is not None
        assert rewrite_response.anchor.type == "range"
        assert rewrite_response.source == "loki"

    def test_safety_guard_prevents_delete_on_short_context(
        self, intervention_service: InterventionService, mock_llm_provider: Mock
    ) -> None:
        """Test that documents <50 chars force Provoke action (reject Delete).

        Per data-model.md safety guard:
        "If context length <50 chars, backend MUST override Delete → Provoke"
        """
        # Mock LLM to return Delete (should be overridden by safety guard)
        mock_llm_provider.generate_intervention.return_value = InterventionResponse(
            action="delete",
            content=None,
            lock_id=None,
            anchor=AnchorRange(from_=0, to=10),
            action_id="act_test789",
            issued_at=datetime.now(UTC),
            source="loki",
        )

        # Short context (less than 50 chars)
        request = InterventionRequest(
            context="短文本",  # Only 3 characters
            mode="loki",
            client_meta=ClientMeta(
                doc_version=1,
                selection_from=0,
                selection_to=0,
            ),
        )

        response = intervention_service.generate_intervention(request)

        # Safety guard should OVERRIDE Delete → Provoke
        assert response.action == "provoke"
        assert response.lock_id is not None
        assert response.content is not None
        assert response.source == "loki"

    def test_allows_delete_on_sufficient_context(
        self, intervention_service: InterventionService, mock_llm_provider: Mock
    ) -> None:
        """Test that documents ≥50 chars allow Delete action."""
        # Mock LLM to return Delete
        mock_llm_provider.generate_intervention.return_value = InterventionResponse(
            action="delete",
            content=None,
            lock_id=None,
            anchor=AnchorRange(from_=20, to=40),
            action_id="act_test999",
            issued_at=datetime.now(UTC),
            source="loki",
        )

        # Long enough context (≥50 chars) - need 50+ Chinese characters
        request = InterventionRequest(
            context=(
                "这是一段足够长的测试文本，用于验证删除功能的安全防护机制是否正常工作。"
                "这段文本需要至少五十个中文字符才能通过安全检查，"
                "所以我们继续添加更多的内容来确保达到要求。"
            ),  # 76 chars
            mode="loki",
            client_meta=ClientMeta(
                doc_version=1,
                selection_from=20,
                selection_to=20,
            ),
        )

        response = intervention_service.generate_intervention(request)

        # Should allow Delete action (no safety guard override)
        assert response.action == "delete"
        assert response.anchor.type == "range"
        assert isinstance(response.anchor, AnchorRange)
        assert response.anchor.from_ < response.anchor.to
        assert response.source == "loki"

    def test_safety_guard_boundary_exactly_50_chars(
        self, intervention_service: InterventionService, mock_llm_provider: Mock
    ) -> None:
        """Test boundary condition: exactly 50 chars should allow Delete."""
        # Mock LLM to return Delete
        mock_llm_provider.generate_intervention.return_value = InterventionResponse(
            action="delete",
            content=None,
            lock_id=None,
            anchor=AnchorRange(from_=10, to=30),
            action_id="act_boundary",
            issued_at=datetime.now(UTC),
            source="loki",
        )

        # Exactly 50 characters
        request = InterventionRequest(
            context="12345678901234567890123456789012345678901234567890",  # 50 chars
            mode="loki",
            client_meta=ClientMeta(
                doc_version=1,
                selection_from=10,
                selection_to=10,
            ),
        )

        response = intervention_service.generate_intervention(request)

        # At boundary (50 chars), should allow Delete
        assert response.action == "delete"
        assert response.source == "loki"

    def test_safety_guard_boundary_49_chars(
        self, intervention_service: InterventionService, mock_llm_provider: Mock
    ) -> None:
        """Test boundary condition: 49 chars should force Provoke."""
        # Mock LLM to return Delete
        mock_llm_provider.generate_intervention.return_value = InterventionResponse(
            action="delete",
            content=None,
            lock_id=None,
            anchor=AnchorRange(from_=10, to=30),
            action_id="act_boundary2",
            issued_at=datetime.now(UTC),
            source="loki",
        )

        # 49 characters (just below boundary)
        request = InterventionRequest(
            context="1234567890123456789012345678901234567890123456789",  # 49 chars
            mode="loki",
            client_meta=ClientMeta(
                doc_version=1,
                selection_from=10,
                selection_to=10,
            ),
        )

        response = intervention_service.generate_intervention(request)

        # Below boundary, should force Provoke
        assert response.action == "provoke"
        assert response.lock_id is not None
        assert response.source == "loki"
        assert response.source == "loki"

    def test_delete_action_includes_valid_anchor(
        self, intervention_service: InterventionService, mock_llm_provider: Mock
    ) -> None:
        """Test that Delete action always has valid anchor range (from < to)."""
        # Mock LLM to return Delete
        mock_llm_provider.generate_intervention.return_value = InterventionResponse(
            action="delete",
            content=None,
            lock_id=None,
            anchor=AnchorRange(from_=50, to=100),
            action_id="act_anchor",
            issued_at=datetime.now(UTC),
            source="loki",
        )

        # Need 50+ chars to pass safety guard
        request = InterventionRequest(
            context=(
                "足够长的测试内容，用于验证删除锚点的有效性。"
                "需要确保文本长度超过五十个字符来通过安全检查和验证功能的正确性。"
            ),  # 59 chars
            mode="loki",
            client_meta=ClientMeta(
                doc_version=1,
                selection_from=50,
                selection_to=50,
            ),
        )

        response = intervention_service.generate_intervention(request)

        # Verify anchor is valid
        assert response.anchor.type == "range"
        assert isinstance(response.anchor, AnchorRange)
        assert response.anchor.from_ < response.anchor.to
        assert response.anchor.from_ >= 0
        assert response.anchor.to > 0
        assert response.source == "loki"

    def test_provoke_action_includes_lock_id_and_content(
        self, intervention_service: InterventionService, mock_llm_provider: Mock
    ) -> None:
        """Test that Provoke action always has lock_id and content."""
        # Mock LLM to return Provoke
        mock_llm_provider.generate_intervention.return_value = InterventionResponse(
            action="provoke",
            content="测试内容。",
            lock_id="lock_provoke_test",
            anchor=AnchorPos(from_=50),
            action_id="act_provoke",
            issued_at=datetime.now(UTC),
            source="loki",
        )

        request = InterventionRequest(
            context="测试Provoke动作的锁定内容和标识符。需要足够长的文本来避免触发安全防护机制。",
            mode="loki",
            client_meta=ClientMeta(
                doc_version=1,
                selection_from=50,
                selection_to=50,
            ),
        )

        response = intervention_service.generate_intervention(request)

        # Verify Provoke has required fields
        assert response.action == "provoke"
        assert response.lock_id is not None
        assert response.lock_id.startswith("lock_")
        assert response.content is not None
        assert len(response.content) > 0
        assert response.source == "loki"

    def test_handles_loki_mode_string(
        self, intervention_service: InterventionService, mock_llm_provider: Mock
    ) -> None:
        """Test that mode='loki' string is handled correctly."""
        mock_llm_provider.generate_intervention.return_value = InterventionResponse(
            action="provoke",
            content="模式测试。",
            lock_id="lock_mode_test",
            anchor=AnchorPos(from_=0),
            action_id="act_mode",
            issued_at=datetime.now(UTC),
            source="loki",
        )

        request = InterventionRequest(
            context="测试Loki模式字符串处理。需要足够长的文本来确保通过安全检查并正常工作。",
            mode="loki",
            client_meta=ClientMeta(
                doc_version=1,
                selection_from=0,
                selection_to=0,
            ),
        )

        response = intervention_service.generate_intervention(request)

        # Verify mode is processed correctly
        assert response.action in ["provoke", "delete"]
        assert response.source == "loki"
        mock_llm_provider.generate_intervention.assert_called_once()
        call_args = mock_llm_provider.generate_intervention.call_args
        assert call_args[1]["mode"] == "loki"
