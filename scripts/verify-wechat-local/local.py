"""Local external-provider fixtures for the production ASGI application."""

import json
import logging
import os
import re
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import uvicorn

from server.infrastructure.security import wechat_identity

os.environ["TESTING"] = ""
os.environ["PYTHON_DOTENV_DISABLED"] = "1"
os.environ["WECHAT_APP_ID"] = "wechat-wire-fixture-app"
os.environ["WECHAT_APP_SECRET"] = "sample-for-local-exchange-only"
os.environ["WECHAT_SESSION_SECRET"] = secrets.token_urlsafe(48)
os.environ["REDIS_URL"] = (
    f"redis://127.0.0.1:{os.getenv('WECHAT_WIRE_REDIS_PORT', '1')}/0?socket_connect_timeout=0.1"
)
os.environ["WECHAT_STORY_MODEL"] = "fixture-story"
os.environ["WECHAT_STORY_API_KEY"] = "loopback-only"
os.environ["NO_PROXY"] = "127.0.0.1,localhost"

wire_code = re.compile(r"((?:author-a|reader-b)-[a-f0-9]{32})-[a-f0-9]{32}")
used_codes: set[str] = set()
devtools = os.getenv("WECHAT_WIRE_DEVTOOLS") == "1"
logger = logging.getLogger("uvicorn.error")


async def fixture_wechat(path, *, query=None, body=None):
    """Simulate the external WeChat responses consumed by production security code."""
    logger.info("FIXTURE_WECHAT %s", path)
    if path == "/sns/jscode2session":
        assert query["appid"] == os.environ["WECHAT_APP_ID"]
        code = query["js_code"]
        match = wire_code.fullmatch(code)
        if code in used_codes or (not match and not devtools):
            return {"errcode": 40029}
        used_codes.add(code)
        openid = match[1] if match else "devtools-author"
        return {"openid": openid, "session_key": "unused-provider-fixture"}
    if path == "/cgi-bin/stable_token":
        assert body["appid"] == os.environ["WECHAT_APP_ID"]
        return {"access_token": "fixture-moderation-token", "expires_in": 7200}
    if path == "/wxa/msg_sec_check":
        assert query["access_token"] == "fixture-moderation-token"
        assert body["scene"] == 3 and body["version"] == 2 and body["content"]
        assert body["openid"].startswith("author-a-") or (
            devtools and body["openid"] == "devtools-author"
        )
        return {"errcode": 0, "result": {"suggest": "pass"}}
    raise AssertionError(path)


def story_candidate(context):
    """Return checked Chinese candidates for each wire scenario."""
    if "style" in context:
        assert context["text"] == "我 我走到院子里"
        return {"text": "我走到院子里。"}
    opening, text = context["opening"], context["text"]
    if "source" not in context:
        assert text == "再等一会儿"
        return {"paragraph": "我在院中又站了一会儿，风也渐渐歇了。"}
    candidate = {
        "paragraph": "",
        "choices": ["去买早饭", "不查信了，陪她放风筝"],
        "lock_sentence": None,
        "facts": [],
        "consequence": None,
        "eligible": [],
    }
    if text == "把信封翻过来，找寄件地址":
        assert opening == "昨夜停电后，门缝下多了一封我自己寄来的信。"
        candidate.update(
            paragraph="我翻过信封，借着刚亮的灯找到一行模糊的寄件地址。",
            choices=["把信烧掉", "把信留下"],
            lock_sentence="寄件日期比今天晚了十年。",
            facts=["信封背面有寄件地址"],
        )
    elif text == "把信烧掉":
        assert context["waiting_response"] and context["letter_state"] == "unopened"
        candidate.update(
            paragraph="我把没拆的信点燃，信封和信纸烧成了灰。",
            facts=["信已经烧成灰"],
            eligible=["returning", "interpret"],
            letter_action="burn",
            letter_action_evidence="信封和信纸烧成了灰",
            choice_context=[
                {"requires_original": False, "follows_letter": False},
                {"requires_original": False, "follows_letter": False},
            ],
        )
    elif text == "我敲了敲桌子。":
        assert opening == "十年后，你收到一封自己寄出的信"
        candidate.update(
            paragraph="窗外传来一声轻响。",
            choices=["走到窗边", "继续等"],
            lock_sentence="玻璃上有个湿淋淋的指印。",
        )
    elif text == "我走到院子里。":
        assert context["waiting_response"]
        candidate.update(choices=["回屋看看", "再等一会儿"], eligible=["returning"])
    elif text == "再等一会儿":
        time.sleep(0.8)
        candidate.update(
            paragraph="窗上出现一片迟到的影子。",
            lock_sentence="高处落下一只手套。",
        )
    else:
        raise AssertionError(context)
    return candidate


def devtools_candidate(context):
    """Supply enough offline sample text to try the local DevTools interface."""
    if "style" in context:
        return {"text": context["text"].replace("我 我", "我").rstrip("。") + "。"}
    if "anchor" in context:
        return {"text": "我停了一会儿，窗外传来脚步声。"}
    if "target" in context:
        return {"text": "我重新看了一遍，发现边沿还留着一行小字。"}

    text = context["text"]
    passages = {
        "把信烧掉": ("burn", "信封和信纸烧成了灰"),
        "把信留下": ("keep", "我把信放进抽屉"),
        "拆开原信": ("read", "我拆开了那封信"),
        "核对原信的邮戳": ("check", "我看清了信上的邮戳"),
    }
    action, evidence = passages.get(text, (None, None))
    selected_passage = {
        "把信封翻过来，找寄件地址": "我翻过信封，灯光下露出一行模糊的地址。",
        "把信封递给女儿，问她认不认得这个笔迹": "我把信封给女儿，她盯着那行字摇了摇头。",
        "请书吏当众念出来": "书吏展开结案书，念到落款时，旁听的人住了声。",
        "先把两名证人分开问话": "我请两人先去不同的厢房等候，再让书吏记录口供。",
    }.get(text, f"我照着「{text}」的念头做了，屋里静了下来。")
    paragraph = evidence + "。" if evidence else selected_passage
    if "source" not in context:
        return {"paragraph": paragraph}
    turns = context["turns"]
    thread = "leave" if text == "不查信了，陪她放风筝" else None
    if context["theme"] == "detective":
        choices = ["去档房核对文书", "追问书吏最后见到谁"]
        detail = "结案书落款的日子是明天。"
    else:
        choices = ["把信烧掉", "把信留下"] if not turns else ["去买早饭", "不查信了，陪她放风筝"]
        detail = "寄件日期比今天晚了十年。"
    if turns:
        detail = f"门外的人敲了{turns + 1}下门。"
    consequence = None
    if (
        context["mode"] == "high"
        and context["letter_state"] == "burned"
        and not context["consequence_presented"]
        and not context["letter_thread_closed"]
        and not thread
    ):
        consequence = "那天来取信的人因此再也没有出现。"
    return {
        "paragraph": (paragraph if context["source"] == "choice" else "") + (consequence or ""),
        "choices": choices,
        "lock_sentence": None if context["waiting_response"] else detail,
        "facts": [],
        "consequence": consequence,
        "eligible": ["returning", "interpret"],
        "letter_action": action,
        "letter_action_evidence": evidence,
        "letter_thread": thread,
        "choice_context": [
            {"requires_original": False, "follows_letter": choice in passages} for choice in choices
        ],
    }


class ModelHandler(BaseHTTPRequestHandler):
    """Accept OpenAI-compatible requests only on the loopback socket."""

    def do_POST(self):
        """Return an externally shaped response after checking generated context."""
        try:
            assert self.path == "/v1/chat/completions"
            assert self.headers["Authorization"] == "Bearer loopback-only"
            payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            assert payload["model"] == "fixture-story"
            assert payload["response_format"] == {"type": "json_object"}
            context = json.loads(payload["messages"][1]["content"])
            logger.info("FIXTURE_MODEL %s", context.get("source", "text-candidate"))
            candidate = devtools_candidate(context) if devtools else story_candidate(context)
            self.send_response(200)
            response = {
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {
                            "role": "assistant",
                            "content": json.dumps(candidate, ensure_ascii=False),
                        },
                    }
                ],
            }
        except (AssertionError, KeyError, TypeError, ValueError) as error:
            self.send_response(500)
            response = {"fixture_error": type(error).__name__}
            if not devtools:
                logger.error("Local model fixture rejected a verification case: %r", error)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())


if __name__ == "__main__":
    database = os.environ.get("DATABASE_URL", "")
    if not re.fullmatch(r"postgresql\+asyncpg://[^/]+@127\.0\.0\.1:\d+/[^/?#]+", database):
        raise SystemExit("Use a dedicated loopback PostgreSQL database for the WeChat fixture.")
    model = ThreadingHTTPServer(("127.0.0.1", 0), ModelHandler)
    os.environ["WECHAT_STORY_BASE_URL"] = f"http://127.0.0.1:{model.server_port}/v1"
    worker = threading.Thread(target=model.serve_forever, daemon=True)
    worker.start()
    wechat_identity._request_wx = fixture_wechat
    try:
        port = int(os.environ.get("WECHAT_WIRE_PORT", "58474"))
        uvicorn.run("server.api.main:app", host="127.0.0.1", port=port)
    finally:
        model.shutdown()
        model.server_close()
