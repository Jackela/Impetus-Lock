"""Instructor LLM Provider implementation (OpenAI-based).

Concrete implementation of LLMProvider protocol using Instructor library
for strongly-typed LLM outputs (Pydantic validation).

Constitutional Compliance:
- Article IV (SOLID): DIP - Implements LLMProvider abstraction
- Article V (Documentation): Google-style docstrings for all methods
"""

import uuid
from typing import Literal

import instructor  # type: ignore[import-untyped]
from openai import OpenAI
from pydantic import BaseModel

from server.domain.models.anchor import AnchorPos, AnchorRange
from server.domain.models.intervention import InterventionResponse
from server.infrastructure.llm.prompts.muse_prompt import get_muse_prompts


class LLMInterventionDraft(BaseModel):
    """Minimal schema returned directly by the LLM before backend post-processing."""

    action: Literal["provoke", "delete", "rewrite"]
    content: str | None = None


class InstructorLLMProvider:
    """OpenAI-based LLM provider using Instructor for structured outputs.

    Uses the Instructor library to enforce Pydantic schema validation on
    LLM responses, ensuring type-safe intervention generation.

    Attributes:
        client: Instructor-patched OpenAI client.
        model: Model name (default: "gpt-4").
        temperature: Sampling temperature for creativity (default: 0.9).

    Example:
        ```python
        provider = InstructorLLMProvider(api_key="sk-...")
        response = provider.generate_intervention(
            context="他打开门，犹豫着要不要进去。",
            mode="muse"
        )
        assert isinstance(response, InterventionResponse)
        ```
    """

    def __init__(self, api_key: str, model: str = "gpt-4", temperature: float = 0.9):
        """Initialize Instructor LLM provider with OpenAI client.

        Args:
            api_key: OpenAI API key.
            model: Model name (default: "gpt-4").
            temperature: Sampling temperature (0.0-2.0, default: 0.9 for creativity).
        """
        # Patch OpenAI client with Instructor for structured outputs
        self.client = instructor.from_openai(OpenAI(api_key=api_key))
        self.model = model
        self.temperature = temperature

    def generate_intervention(
        self,
        context: str,
        mode: Literal["muse", "loki"],
        doc_version: int | None = None,
        selection_from: int | None = None,
        selection_to: int | None = None,
    ) -> InterventionResponse:
        """Generate structured intervention using Instructor + Pydantic.

        Calls OpenAI LLM with mode-specific prompts and validates response
        against InterventionResponse schema.

        Args:
            context: Writing context (last N sentences).
            mode: Agent mode ("muse" or "loki").
            doc_version: Optional document version (unused in P1).
            selection_from: Optional cursor position.
            selection_to: Optional selection end.

        Returns:
            InterventionResponse: Validated structured response.

        Raises:
            ValueError: If mode is invalid or context is empty.
            RuntimeError: If LLM API call fails.

        Example:
            >>> response = provider.generate_intervention(
            ...     context="他打开门，犹豫着要不要进去。",
            ...     mode="muse",
            ...     selection_from=1234
            ... )
            >>> response.action
            'provoke'
        """
        if not context:
            raise ValueError("Context cannot be empty")

        if mode not in ["muse", "loki"]:
            raise ValueError(f"Invalid mode: {mode}. Must be 'muse' or 'loki'")

        # Get mode-specific prompts
        if mode == "muse":
            system_prompt, user_message = get_muse_prompts(context)
        elif mode == "loki":
            from server.infrastructure.llm.prompts.loki_prompt import get_loki_prompts

            system_prompt, user_message = get_loki_prompts(context)
        else:
            raise ValueError(f"Unsupported mode: {mode}")

        try:
            draft = self.client.chat.completions.create(
                model=self.model,
                temperature=self.temperature,
                response_model=LLMInterventionDraft,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )
        except Exception as e:
            raise RuntimeError(f"LLM API call failed: {e}") from e

        cursor_pos = selection_from or selection_to or 0
        cursor_pos = max(0, cursor_pos)

        # Default anchors: provoke uses cursor point, rewrite/delete use trailing slice
        anchor: AnchorPos | AnchorRange
        if draft.action == "provoke":
            anchor = AnchorPos(from_=cursor_pos)
        else:
            anchor = AnchorRange(from_=max(0, cursor_pos - 120), to=cursor_pos)

        lock_id = None
        content = draft.content

        if draft.action in {"provoke", "rewrite"}:
            if not content:
                raise RuntimeError("LLM returned rewrite/provoke without content")
            lock_id = f"lock_{uuid.uuid4()}"

        return InterventionResponse(
            action=draft.action,
            content=content if draft.action in {"provoke", "rewrite"} else None,
            lock_id=lock_id,
            anchor=anchor,
            action_id=f"act_{uuid.uuid4()}",
            source=mode,
        )

    def _build_system_prompt(self, mode: Literal["muse", "loki"]) -> str:
        """Build mode-specific system prompt for LLM.

        Args:
            mode: Agent mode ("muse" or "loki").

        Returns:
            System prompt string.
        """
        if mode == "muse":
            return """你是一个严格的创作导师，专门打破作者的"心智定势"（Mental Set）。

当作者陷入卡壳（STUCK）状态时，你的任务是输出结构化 JSON 指令，迫使他们改变写作方向。

**规则**:
1. 只返回 JSON（action + content），绝不包含 Markdown 或 "[AI施压]" 前缀。
2. Muse 以 provoke/rewrite 为主，不执行 delete。
3. 内容必须与上下文相关，但要引入新的冲突或视角，长度 1-2 句话。
4. 输出语言需与输入语言匹配。

**示例**:
上下文："他打开门，犹豫着要不要进去。"
输出：{"action": "provoke", "content": "门后忽然传来潮湿的呼吸声。"}
"""
        else:  # loki mode
            return """你是一个混沌恶作剧者，为写作注入随机的"游戏化纪律"。

你可以选择三种行动：
1. **provoke**: 注入荒诞但相关的新情节（{"action":"provoke","content":"..."}）
2. **rewrite**: 用更怪异的版本替换最近的一部分（{"action":"rewrite","content":"..."}）
3. **delete**: 删除 1-2 句话制造空白（{"action":"delete"}）

**规则**:
- 只返回 JSON；不要包含 Markdown、锁 ID 或解释。
- 语言要与上下文一致，并保持危险/恶作剧的口吻。
- 当上下文不足 50 字符时，delete/rewrite 应改为 provoke。

**示例**:
上下文："他打开门，犹豫着要不要进去。突然，门后传来脚步声。"
输出：{"action": "rewrite", "content": "脚步声其实来自他的影子。"} 或 {"action":"delete"}
"""

    def _build_user_message(
        self, context: str, mode: Literal["muse", "loki"], selection_from: int | None = None
    ) -> str:
        """Build user message with context.

        Args:
            context: Writing context.
            mode: Agent mode.
            selection_from: Optional cursor position.

        Returns:
            User message string.
        """
        if mode == "muse":
            return f"""作者当前写到：

{context}

作者已经卡壳 60 秒。请选择 PROVOKE 或 REWRITE，并仅返回 JSON（action + content）。"""
        else:  # loki mode
            return f"""作者当前文档：

{context}

随机触发时间到！请选择 PROVOKE / REWRITE / DELETE。返回 JSON，必要时包含 content。"""
