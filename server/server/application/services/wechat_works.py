"""Policies for collecting a WeChat manuscript and saving a personal mode."""

from typing import Any

from server.domain.errors import AuthorizationError, ValidationError

_TRIGGER_LABELS = {
    "manual": "由作者手动触发",
    "response": "回应后触发",
    "automatic": "满足条件时自动触发",
}


def deliverable_manuscript(state: dict[str, Any]) -> tuple[str, bool]:
    """Collect the visible manuscript and whether it includes generated text."""
    paragraphs = []
    generated = False
    for segment in state.get("segments", []):
        text = segment.get("text", "")
        if not text.strip():
            continue
        paragraphs.append(text)
        if segment.get("ai_generated"):
            generated = True
    return "\n\n".join(paragraphs), generated


def personal_mode(payload: dict[str, Any], progress: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """Validate discovery requirements and canonicalize the saved configuration."""
    if not progress.get("rewrite"):
        raise AuthorizationError("发现改写规则后可保存个人模式。")
    action = payload["action"]
    if action == "delete" and not progress.get("delete"):
        raise AuthorizationError("发现删除规则后可在个人模式中使用。")
    name = payload["name"].strip()
    if not name or len(name) > 80:
        raise ValidationError("个人模式名称需要 1 到 80 个字符。")
    trigger = payload["trigger"]
    if trigger not in _TRIGGER_LABELS or action not in {"insert", "rewrite", "delete"}:
        raise ValidationError("请选择有效的触发条件和动作。")
    return name, {
        "trigger": trigger,
        "action": action,
        "lock": payload["lock"] if action != "delete" else False,
        "recoverable": payload["recoverable"],
    }


def versioned_initial(initial: dict[str, Any]) -> dict[str, Any]:
    """Supply the original version for snapshots written before versions were explicit."""
    return {"challenge_id": f"{initial['theme']}/v1", "rules_version": 1, **initial}


def describe_rules(initial: dict[str, Any]) -> str:
    """Explain a published challenge's starting rules without revealing its history."""
    if initial["rules_version"] != 1 or initial["challenge_id"] != f"{initial['theme']}/v1":
        return "该规则版本暂不能用于开局。"

    mode = initial["mode"]
    if mode == "normal":
        return "续写后会出现锁句。锁句和原文受到保护。"
    if mode == "high":
        return (
            "续写后会出现锁句。进化并启用「换个解释」后，本局可主动解锁或替换一次。"
            "高强度模式权限仅限本局。"
        )

    rules = initial["rules"]
    trigger = _TRIGGER_LABELS[rules["trigger"]]
    action = rules["action"]
    description = {
        "insert": "可插入新文字",
        "rewrite": "可改写未锁正文",
        "delete": "可删除未锁正文",
    }[action]
    lock = "新文字会锁定。" if rules["lock"] and action != "delete" else ""
    recovery = ""
    if action != "insert":
        recovery = "原文可在本局恢复。" if rules["recoverable"] else "原文不可恢复。"
    return f"{trigger}，{description}。{lock}{recovery}锁句继续受保护，个人模式权限仅限本局。"
