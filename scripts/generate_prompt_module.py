#!/usr/bin/env python3
"""Utility to export TOML prompts into a generated Python module.

Run this script after editing files under ``server/prompts`` to create
`server/server/infrastructure/llm/prompts/generated_templates.py`.
The generated module is optional and primarily helps static analysis
or packaging scenarios that prefer plain Python constants.
"""

from __future__ import annotations

from pathlib import Path
import tomllib

OUTPUT_PATH = Path("server/server/infrastructure/llm/prompts/generated_templates.py")
TEMPLATE_DIR = Path("server/server/prompts")
HEADER = '"""Auto-generated prompt constants.\n\nThis file is created by scripts/generate_prompt_module.py.\n"""'


def _load_template(name: str) -> dict[str, str]:
    path = TEMPLATE_DIR / f"{name}.toml"
    data = tomllib.loads(path.read_text(encoding="utf-8"))
    return {
        "version": data["version"],
        "system": data["system"],
        "user_template": data["user_template"],
    }


def main() -> None:
    muse = _load_template("muse")
    loki = _load_template("loki")

    content = f"""{HEADER}
MUSE_VERSION = {muse['version']!r}
MUSE_SYSTEM_PROMPT = {muse['system']!r}
MUSE_USER_TEMPLATE = {muse['user_template']!r}

LOKI_VERSION = {loki['version']!r}
LOKI_SYSTEM_PROMPT = {loki['system']!r}
LOKI_USER_TEMPLATE = {loki['user_template']!r}
"""

    OUTPUT_PATH.write_text(content, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
