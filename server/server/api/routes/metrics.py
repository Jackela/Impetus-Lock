"""Prometheus-compatible metrics endpoint."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from server.infrastructure.observability import metrics as metrics_module

router = APIRouter()


@router.get("/metrics", include_in_schema=False)
def metrics() -> Response:
    """Return Prometheus metrics if enabled."""

    if not metrics_module.ENABLE_PROM_METRICS:
        raise HTTPException(status_code=404, detail="Metrics disabled")

    payload, content_type = metrics_module.prometheus_latest()
    return Response(content=payload, media_type=content_type)
