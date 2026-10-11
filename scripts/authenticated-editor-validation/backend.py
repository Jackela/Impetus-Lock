"""Run the real backend with a fail-closed guard against external provider I/O."""

import asyncio
import ipaddress
import json
import os
import socket
import sys

from runtime import HERE, ROOT, environment

validation_environment = environment()
os.environ.clear()
os.environ.update(validation_environment)
os.chdir(ROOT / "server")
sys.path.insert(0, str(ROOT / "server"))
original_connect = socket.socket.connect


def loopback_connect(sock, address):
    """Allow only local database/cache sockets; never reach paid model APIs."""
    if isinstance(address, tuple):
        try:
            allowed = ipaddress.ip_address(address[0]).is_loopback
        except ValueError:
            allowed = address[0] == "localhost"
        if not allowed:
            with (HERE / "blocked-network.log").open("a") as handle:
                handle.write(f"blocked:{address[0]}:{address[1]}\n")
            raise ConnectionError("Validation backend forbids external network")
    return original_connect(sock, address)


socket.socket.connect = loopback_connect
assert "TESTING" not in os.environ
import uvicorn
from server.api.main import app


class ResponseGate:
    """Delay real HTTP headers only; never replace auth, CSRF or business results."""

    async def __call__(self, scope, receive, send):
        gate = HERE / "response-gate.json"
        config = (
            json.loads(gate.read_text())
            if gate.exists() and scope["type"] == "http"
            else {}
        )
        selected = scope.get("method") == config.get("method") and scope.get(
            "path"
        ) == config.get("path")
        disconnected = False

        async def gated_receive():
            nonlocal disconnected
            message = await receive()
            if selected and message["type"] == "http.disconnect":
                disconnected = True
                (HERE / "response-gate-disconnected.json").write_text(
                    json.dumps(
                        {
                            "id": config["id"],
                            "client_disconnect_observed": True,
                        },
                        indent=2,
                    )
                )
            return message

        async def gated_send(message):
            transport_observation = None
            if selected and message["type"] == "http.response.start":
                observed = {
                    "id": config["id"],
                    "method": scope["method"],
                    "path": scope["path"],
                    "status": message["status"],
                    "set_cookie_headers_present": any(
                        name.lower() == b"set-cookie"
                        for name, value in message.get("headers", [])
                    ),
                    "phase": "business_complete_headers_not_delivered",
                }
                (HERE / "response-gate-observed.json").write_text(
                    json.dumps(observed, indent=2)
                )
                for attempt in range(2400):
                    if not gate.exists():
                        break
                    await asyncio.sleep(0.05)
                else:
                    raise RuntimeError("Validation response gate timed out")
                cycle = getattr(send, "__self__", None)
                transport = getattr(cycle, "transport", None)
                transport_observation = {
                    "uvicorn_cycle_observed": cycle is not None,
                    "server_cycle_disconnected_before_send": getattr(
                        cycle, "disconnected", None
                    ),
                    "transport_closing_before_send": (
                        transport.is_closing() if transport is not None else None
                    ),
                    "transport_write_observed": False,
                    "transport_write_calls": 0,
                    "transport_bytes": 0,
                    "set_cookie_transport_write_observed": False,
                }
                original_write = getattr(transport, "write", None)

                def observed_write(data):
                    transport_observation["transport_write_calls"] += 1
                    transport_observation["transport_bytes"] += len(data)
                    transport_observation["set_cookie_transport_write_observed"] |= (
                        b"set-cookie:" in data.lower()
                    )
                    return original_write(data)

                if original_write is not None:
                    try:
                        transport.write = observed_write
                        transport_observation["transport_write_observed"] = True
                    except (AttributeError, TypeError):
                        pass
                try:
                    await send(message)
                finally:
                    if transport_observation["transport_write_observed"]:
                        transport.write = original_write
                transport_observation["response_started_after_send"] = getattr(
                    cycle, "response_started", None
                )
            else:
                await send(message)
            if selected and message["type"] == "http.response.start":
                (HERE / "response-gate-released.json").write_text(
                    json.dumps(
                        {
                            "id": config["id"],
                            "header_send_attempted": True,
                            "asgi_send_returned": True,
                            "client_disconnect_observed": disconnected,
                            "transport": transport_observation,
                            "browser_delivery": "not inferred from ASGI send",
                        },
                        indent=2,
                    )
                )

        await app(scope, gated_receive, gated_send)


uvicorn.run(
    ResponseGate(), host="127.0.0.1", port=8101, log_level="warning", loop="asyncio"
)
