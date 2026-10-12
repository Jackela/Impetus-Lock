"""Real local HTTP/SDK/PG/shutdown evidence without calling paid OpenAI services."""

import asyncio
import importlib
import ipaddress
import json
import os
import signal
import socket
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Event, Thread
from uuid import uuid4

from runtime import CONTEXT, DATABASE, HERE, ROOT, environment

PROBE_DATABASE = "impetus_sol_safety_20261011"
API = "http://127.0.0.1:8102"
STUB = "http://127.0.0.1:8103"
OUTPUT = HERE / "sol-real-http"
OUTPUT.mkdir(exist_ok=True)


def record(event, **fields):
    """Append observable events without cookies, keys or credentials."""
    with (OUTPUT / "backend-events.jsonl").open("a") as handle:
        handle.write(json.dumps({"event": event, "time": time.time(), **fields}) + "\n")


def probe_environment():
    """Use a dedicated database and a synthetic key in an allowlisted environment."""
    env = environment()
    env["DATABASE_URL"] = env["DATABASE_URL"].replace(
        f"/{DATABASE}", f"/{PROBE_DATABASE}"
    )
    env.update(
        {
            "LLM_DEFAULT_PROVIDER": "openai",
            "OPENAI_MODEL": "gpt-6.1-sol",
            "OPENAI_API_KEY": "local-controlled-http-dummy",
        }
    )
    return env


def port_open(port):
    """Probe a loopback listener without inferring process ownership."""
    with socket.socket() as connection:
        connection.settimeout(0.2)
        return connection.connect_ex(("127.0.0.1", port)) == 0


def backend():
    """Run the actual app; substitute only the SDK's network transport."""
    env = probe_environment()
    os.environ.clear()
    os.environ.update(env)
    sys.path.insert(0, str(ROOT / "server"))
    os.chdir(ROOT / "server")
    original_connect = socket.socket.connect

    def loopback_connect(sock, address):
        if (
            isinstance(address, tuple)
            and not ipaddress.ip_address(address[0]).is_loopback
        ):
            raise ConnectionError("Sol probe forbids external network")
        return original_connect(sock, address)

    socket.socket.connect = loopback_connect
    import httpx2
    import uvicorn
    from openai import OpenAI
    from server.infrastructure.llm import instructor_provider

    class LocalTransport(httpx2.HTTPTransport):
        def handle_request(self, request):
            if request.url.host != "api.openai.com" or request.url.scheme != "https":
                raise AssertionError("Unexpected SDK destination")
            payload = json.loads(request.content)
            record(
                "sdk_wire",
                official_url=str(request.url),
                model=payload.get("model"),
                has_temperature="temperature" in payload,
                response_format=payload.get("response_format", {}).get("type"),
            )
            headers = dict(request.headers)
            headers["host"] = "127.0.0.1:8103"
            redirected = httpx2.Request(
                request.method,
                STUB + request.url.raw_path.decode(),
                headers=headers,
                content=request.content,
            )
            return super().handle_request(redirected)

        def close(self):
            record("sdk_transport_close_started")
            super().close()
            record("sdk_transport_closed")

    def factory(**kwargs):
        raw = OpenAI(
            **kwargs,
            http_client=httpx2.Client(transport=LocalTransport(), trust_env=False),
        )
        record("sdk_client_created", official_base_url=str(raw.base_url))
        return raw

    instructor_provider.OpenAI = factory
    assert "TESTING" not in os.environ
    from server.api.main import app
    from server.api.routes.collaboration import collab_service
    from server.infrastructure.persistence.database import DatabaseManager

    actual_database_close = DatabaseManager.close
    actual_collaboration_shutdown = collab_service.shutdown

    async def observed_database_close(manager):
        await actual_database_close(manager)
        record("actual_database_pool_closed")

    async def observed_collaboration_shutdown():
        await actual_collaboration_shutdown()
        record("actual_collaboration_shutdown_complete")

    DatabaseManager.close = observed_database_close
    collab_service.shutdown = observed_collaboration_shutdown

    record("server_started", pid=os.getpid(), testing="unset", database=PROBE_DATABASE)
    uvicorn.run(app, host="127.0.0.1", port=8102, log_level="warning", loop="asyncio")
    record("server_returned_after_lifespan", pid=os.getpid())


async def database_rows(task_id=None, initialize=False):
    """Read exact committed history from the dedicated actual PostgreSQL database."""
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(probe_environment()["DATABASE_URL"])
    async with engine.begin() as connection:
        assert (
            await connection.execute(text("SELECT current_database()"))
        ).scalar_one() == PROBE_DATABASE
        if initialize:
            sys.path.insert(0, str(ROOT / "server"))
            from server.infrastructure.persistence.models import Base

            for name in (
                "user",
                "style",
                "style_history",
                "user_stats",
                "achievement",
                "streak",
                "template",
            ):
                importlib.import_module(f"server.models.{name}")
            await connection.run_sync(Base.metadata.create_all)
            result = []
        else:
            rows = await connection.execute(
                text(
                    "SELECT task_id,action_id,action_type,content,lock_id,anchor,mode,context "
                    "FROM intervention_actions WHERE task_id=:id ORDER BY created_at"
                ),
                {"id": task_id},
            )
            result = [dict(row) for row in rows.mappings()]
    await engine.dispose()
    return result


def main():
    """Observe a real API request, PG commit, cached retry and draining SIGTERM."""
    import httpx

    if port_open(8102) or port_open(8103):
        raise RuntimeError("Probe ports occupied; refusing existing services")
    label = subprocess.run(
        [
            "docker",
            "--context",
            CONTEXT,
            "inspect",
            "--format",
            '{{index .Config.Labels "codex.task"}}',
            "impetus-auth-safety-postgres",
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    assert label == "authenticated-editor-safety-2026-10-11"
    exists = subprocess.run(
        [
            "docker",
            "--context",
            CONTEXT,
            "exec",
            "impetus-auth-safety-postgres",
            "psql",
            "-U",
            "postgres",
            "-At",
            "-c",
            f"SELECT 1 FROM pg_database WHERE datname='{PROBE_DATABASE}'",
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    if exists != "1":
        subprocess.run(
            [
                "docker",
                "--context",
                CONTEXT,
                "exec",
                "impetus-auth-safety-postgres",
                "createdb",
                "-U",
                "postgres",
                PROBE_DATABASE,
            ],
            check=True,
        )
    asyncio.run(database_rows(initialize=True))
    (OUTPUT / "backend-events.jsonl").write_text("")
    entered, release = Event(), Event()
    wire = []

    class Stub(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_POST(self):
            payload = json.loads(self.rfile.read(int(self.headers["content-length"])))
            gate = "drain-marker" in json.dumps(payload["messages"])
            wire.append(
                {
                    "path": self.path,
                    "model": payload["model"],
                    "gate": gate,
                    "response_format": payload["response_format"]["type"],
                    "has_temperature": "temperature" in payload,
                }
            )
            if gate:
                entered.set()
                assert release.wait(30)
            content = json.dumps(
                {"action": "provoke", "content": "Controlled actual HTTP Sol result"}
            )
            response = {
                "id": f"local-{uuid4()}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": "gpt-6.1-sol",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {
                            "role": "assistant",
                            "content": content,
                            "refusal": None,
                        },
                    }
                ],
            }
            body = json.dumps(response).encode()
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    stub = ThreadingHTTPServer(("127.0.0.1", 8103), Stub)
    stub.daemon_threads = True
    Thread(target=stub.serve_forever, daemon=True).start()
    child = None
    try:
        with (OUTPUT / "backend.log").open("a") as log:
            child = subprocess.Popen(
                [str(ROOT / "server/.venv/bin/python"), str(__file__), "backend"],
                stdout=log,
                stderr=log,
                start_new_session=True,
            )
        with httpx.Client(
            base_url=API, follow_redirects=True, timeout=35, trust_env=False
        ) as client:
            for _attempt in range(60):
                assert child.poll() is None, "Probe backend exited during startup"
                try:
                    if client.get("/health/db").status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(0.2)
            else:
                raise RuntimeError("Probe backend did not become ready")
            registered = client.post(
                "/auth/register",
                json={
                    "email": f"sol-http-{uuid4()}@example.com",
                    "password": "localAuthPass!2026",
                },
            )
            assert registered.status_code == 201
            user = registered.json()["user"]
            client.headers.update(
                {
                    "X-CSRF-Token": client.cookies["csrf_token"],
                    "X-Expected-User-ID": user["id"],
                }
            )
            context = "A long actual controlled local HTTP passage about an unfamiliar street. The door opened."
            created = client.post("/tasks/", json={"content": context, "lock_ids": []})
            assert created.status_code == 201
            task = created.json()
            headers = {
                "X-Task-Id": task["id"],
                "X-Contract-Version": "2.0.0",
                "Idempotency-Key": str(uuid4()),
            }
            payload = {
                "context": context,
                "mode": "muse",
                "client_meta": {
                    "doc_version": 1,
                    "selection_from": 1,
                    "selection_to": 1,
                },
            }
            response = client.post(
                "/impetus/generate-intervention", headers=headers, json=payload
            )
            assert response.status_code == 200, response.text
            original = response.json()
            assert original["content"] == "Controlled actual HTTP Sol result"
            retry = client.post(
                "/impetus/generate-intervention", headers=headers, json=payload
            )
            assert (
                retry.status_code == 200 and retry.json() == original and len(wire) == 1
            )
            rows = asyncio.run(database_rows(task["id"]))
            assert len(rows) == 1 and rows[0]["action_id"] == original["action_id"]
            assert (
                rows[0]["content"] == original["content"]
                and rows[0]["lock_id"] == original["lock_id"]
            )
            # The real repository stores model_dump() field names, while HTTP
            # serializes the AnchorPos alias. Preserve both exact forms.
            assert rows[0]["anchor"] == {
                "type": original["anchor"]["type"],
                "from_": original["anchor"]["from"],
            }
            assert rows[0]["context"] == context
            active_headers = {**headers, "Idempotency-Key": str(uuid4())}
            active_payload = {**payload, "context": context + " drain-marker"}
            with ThreadPoolExecutor(max_workers=1) as workers:
                pending = workers.submit(
                    client.post,
                    "/impetus/generate-intervention",
                    headers=active_headers,
                    json=active_payload,
                )
                assert entered.wait(5), "Real SDK HTTP did not reach the local gate"
                child.send_signal(signal.SIGTERM)
                time.sleep(0.2)
                alive_while_active = child.poll() is None
                assert alive_while_active
                release.set()
                drained = pending.result(timeout=10)
                assert drained.status_code == 200, drained.text
            exit_code = child.wait(timeout=10)
            # Uvicorn restores and re-raises the received SIGTERM after its
            # lifespan completes; that expected signal exit is recorded.
            assert exit_code in {0, -signal.SIGTERM} and not port_open(8102)
            final_rows = asyncio.run(database_rows(task["id"]))
            assert (
                len(final_rows) == 2
                and final_rows[1]["action_id"] == drained.json()["action_id"]
            )
            events = [
                json.loads(line)
                for line in (OUTPUT / "backend-events.jsonl").read_text().splitlines()
            ]
            closes = [
                item for item in events if item["event"] == "sdk_transport_closed"
            ]
            assert len(closes) == 1
            assert any(
                item["event"] == "actual_database_pool_closed" for item in events
            )
            assert any(
                item["event"] == "actual_collaboration_shutdown_complete"
                for item in events
            )
            evidence = {
                "scope": "controlled real local HTTP through official SDK parse; no paid OpenAI request",
                "testing": "unset",
                "database": PROBE_DATABASE,
                "server_pid": child.pid,
                "http_status": response.status_code,
                "cached_retry_equal": retry.json() == original,
                "sdk_network_count": len(wire),
                "sdk_http": wire,
                "action": original,
                "committed_history": final_rows,
                "alive_while_active": alive_while_active,
                "active_request_http_status": drained.status_code,
                "sdk_transport_closes": len(closes),
                "exit_code": exit_code,
                "listener_closed": not port_open(8102),
            }
            (OUTPUT / "result.json").write_text(
                json.dumps(evidence, default=str, indent=2)
            )
            print(
                json.dumps(
                    {
                        key: evidence[key]
                        for key in (
                            "scope",
                            "http_status",
                            "cached_retry_equal",
                            "sdk_network_count",
                            "sdk_transport_closes",
                            "exit_code",
                            "listener_closed",
                        )
                    },
                    indent=2,
                )
            )
    finally:
        release.set()
        if child is not None and child.poll() is None:
            child.send_signal(signal.SIGTERM)
            child.wait(timeout=10)
        stub.shutdown()
        stub.server_close()
        assert not port_open(8103)


if __name__ == "__main__":
    backend() if len(sys.argv) > 1 and sys.argv[1] == "backend" else main()
