"""Instructor LLM Provider implementation (OpenAI-based).

Concrete implementation of LLMProvider protocol using Instructor library
for strongly-typed LLM outputs (Pydantic validation).

Constitutional Compliance:
- Article IV (SOLID): DIP - Implements LLMProvider abstraction
- Article V (Documentation): Google-style docstrings for all methods
"""

import uuid
from typing import Literal

import instructor
from openai import OpenAI

from server.domain.models.intervention import InterventionResponse
from server.infrastructure.llm.prompts.muse_prompt import get_muse_prompts


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
            # Call LLM with Instructor for structured output
            response = self.client.chat.completions.create(
                model=self.model,
                temperature=self.temperature,
                response_model=InterventionResponse,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )

            # Generate unique action_id if LLM didn't provide one
            if not response.action_id:
                response.action_id = f"act_{uuid.uuid4()}"

            # Generate lock_id for provoke actions if not provided
            if response.action == "provoke" and not response.lock_id:
                response.lock_id = f"lock_{uuid.uuid4()}"

            # Instructor guarantees InterventionResponse structure
            return response

        except Exception as e:
            raise RuntimeError(f"LLM API call failed: {e}") from e

    def _build_system_prompt(self, mode: Literal["muse", "loki"]) -> str:
        """Build mode-specific system prompt for LLM.

        Args:
            mode: Agent mode ("muse" or "loki").

        Returns:
            System prompt string.
        """
        if mode == "muse":
            return """你是一个严格的创作导师，专门打破作者的"心智定势"（Mental Set）。

当作者陷入卡壳（STUCK）状态时，你的任务是注入"创意施压"内容，强制打破他们对"完美"的执着。

**规则**:
1. 注入内容必须是 Markdown blockquote 格式，以 "> [AI施压 - Muse]: " 开头
2. 内容必须基于上下文，但应该引入意外的转折或冲突
3. 不要提供解决方案，而是制造新的创作压力
4. 保持中文输出
5. 内容长度：1-2 句话（20-50 字）

**示例**:
上下文："他打开门，犹豫着要不要进去。"
输出："> [AI施压 - Muse]: 门后传来低沉的呼吸声。"
"""
        else:  # loki mode
            return """你是一个混沌恶作剧者，为写作注入随机的"游戏化纪律"。

你有两种行动：
1. **Provoke（注入）**: 注入意外内容，破坏作者的计划
2. **Delete（删除）**: 删除作者最后一句话，强制重写

**规则**:
- 在 Loki 模式下，你应该随机选择 Provoke 或 Delete（大约 60% Provoke, 40% Delete）
- Provoke 内容格式："> [AI施压 - Loki]: <意外内容>"
- Delete 行动应返回 {"action": "delete", "anchor": {"type": "range", ...}}
- 保持中文输出
- Provoke 内容：1-2 句话（20-50 字）

**示例（Provoke）**:
上下文："他打开门，犹豫着要不要进去。突然，门后传来脚步声。"
输出："> [AI施压 - Loki]: 脚步声突然停止，一张白纸从门缝塞进来。"

**示例（Delete）**:
上下文："他打开门，犹豫着要不要进去。突然，门后传来脚步声。"
输出：{"action": "delete", "anchor": {"type": "range", "from": <start>, "to": <end>}}
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

作者已经卡壳 60 秒。请注入一个创意施压内容，打破他的心智定势。"""
        else:  # loki mode
            return f"""作者当前文档：

{context}

随机触发时间到！请决定行动：Provoke（注入混沌）或 Delete（删除最后一句）。"""
