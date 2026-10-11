"""Run default-security Firefox in the matching official Playwright Linux image."""

import json
import subprocess
import sys
from pathlib import PurePosixPath

from runtime import CONTEXT, HERE, ROOT, SOURCE

NAME = "impetus-auth-safety-firefox"
PLAYWRIGHT_VERSION = json.loads((ROOT / "client/package-lock.json").read_text())[
    "packages"
]["node_modules/@playwright/test"]["version"]
IMAGE = f"mcr.microsoft.com/playwright:v{PLAYWRIGHT_VERSION}-noble"


def docker(*args, **kwargs):
    """Use only this round's context and container."""
    return subprocess.run(["docker", "--context", CONTEXT, *args], check=True, **kwargs)


def sync():
    """Copy the current candidate, excluding dependencies, build and private data."""
    docker("exec", "--workdir", "/", NAME, "mkdir", "-p", "/work/Impetus-Lock")
    archive = subprocess.Popen(
        [
            "tar",
            "-cf",
            "-",
            "--exclude=node_modules",
            "--exclude=dist",
            "--exclude=coverage",
            "--exclude=test-results",
            "--exclude=playwright-report",
            "--exclude=.env",
            "--exclude=.env.*",
            "client",
        ],
        cwd=ROOT,
        stdout=subprocess.PIPE,
    )
    docker(
        "exec",
        "-i",
        NAME,
        "tar",
        "-xf",
        "-",
        "-C",
        "/work/Impetus-Lock",
        stdin=archive.stdout,
    )
    archive.stdout.close()
    assert archive.wait() == 0
    docker("exec", NAME, "chown", "-R", "pwuser:pwuser", "/work")


if sys.argv[1] == "prepare":
    names = docker(
        "ps", "-a", "--format", "{{.Names}}", capture_output=True, text=True
    ).stdout.splitlines()
    if NAME not in names:
        docker(
            "run",
            "-d",
            "--name",
            NAME,
            "--init",
            "--label",
            "codex.task=authenticated-editor-safety-2026-10-11",
            "--add-host",
            "host.lima.internal:192.168.5.2",
            "-w",
            "/work/Impetus-Lock/client",
            IMAGE,
            "sleep",
            "infinity",
        )
    else:
        label = docker(
            "inspect",
            "--format",
            '{{index .Config.Labels "codex.task"}}',
            NAME,
            capture_output=True,
            text=True,
        ).stdout.strip()
        if label != "authenticated-editor-safety-2026-10-11":
            raise RuntimeError("Refusing to reuse a foreign Firefox container")
        image = docker(
            "inspect",
            "--format",
            "{{.Config.Image}}",
            NAME,
            capture_output=True,
            text=True,
        ).stdout.strip()
        if image != IMAGE:
            raise RuntimeError(
                "Preserve existing evidence and recreate the owned container with the locked Playwright image"
            )
        docker("start", NAME)
    sync()
    docker("cp", str(SOURCE / "linux-relay.mjs"), f"{NAME}:/work/linux-relay.mjs")
    docker("exec", "--user", "pwuser", NAME, "npm", "ci", "--ignore-scripts")
    docker("exec", "-d", "--user", "pwuser", NAME, "node", "/work/linux-relay.mjs")
    probe = docker(
        "exec",
        "--user",
        "pwuser",
        NAME,
        "node",
        "--input-type=module",
        "-e",
        'import {firefox} from "@playwright/test";const b=await firefox.launch();'
        'const page=await b.newPage();await page.goto("http://127.0.0.1:8101/health");'
        'console.log(JSON.stringify({os:process.platform,node:process.version,browser:"firefox",'
        "version:b.version(),webLocks:await page.evaluate(()=>!!navigator.locks),"
        'security:"default",http:await page.textContent("body")}));await b.close()',
        capture_output=True,
        text=True,
    )
    (HERE / "linux-firefox-launch.json").write_text(probe.stdout)
    print(probe.stdout)
elif sys.argv[1] in {"run", "run-webkit-focus", "run-firefox-stock"}:
    firefox_stock = sys.argv[1] == "run-firefox-stock"
    if firefox_stock:
        if len(sys.argv) != 4 or not PurePosixPath(sys.argv[3]).is_absolute():
            raise SystemExit(
                "Use run-firefox-stock <unique run label> <absolute official binary path>"
            )
        docker("exec", NAME, "test", "-x", sys.argv[3])
    sync()
    run = sys.argv[2]
    webkit_focus = sys.argv[1] == "run-webkit-focus"
    browser_args = (
        ["xvfb-run", "-a", "npx"] if webkit_focus or firefox_stock else ["npx"]
    )
    stock_env = (
        ["-e", f"AUTH_E2E_FIREFOX_STOCK_EXECUTABLE={sys.argv[3]}"]
        if firefox_stock
        else []
    )
    test_args = (
        ["--project=safe-webkit-auth", "--grep=multi-tab focus"]
        if webkit_focus
        else ["--project=safe-firefox-auth"]
    )
    try:
        result = docker(
            "exec",
            "--user",
            "pwuser",
            "-e",
            "AUTH_E2E_EXTERNAL=1",
            "-e",
            f"AUTH_E2E_RUN={run}",
            "-e",
            f"AUTH_E2E_WEBKIT_XVFB={int(webkit_focus)}",
            *stock_env,
            NAME,
            *browser_args,
            "playwright",
            "test",
            "-c",
            "playwright.safety.config.ts",
            *test_args,
            "--retries=0",
            "--max-failures=1",
        )
    finally:
        docker(
            "cp",
            f"{NAME}:/work/Impetus-Lock/.scratch/authenticated-editor-safety-2026-10-11/.",
            str(HERE.parent),
        )
else:
    raise SystemExit(
        "Use prepare, run <unique run label>, run-webkit-focus <unique run label>, "
        "or run-firefox-stock <unique run label> <absolute official binary path>"
    )
