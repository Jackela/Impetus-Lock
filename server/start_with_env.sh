#!/bin/bash
set -a
source .env
set +a
.venv/Scripts/python3 -m uvicorn server.api.main:app --host 0.0.0.0 --port 8000
