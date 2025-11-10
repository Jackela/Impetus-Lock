#!/bin/bash
# Start the Impetus Lock backend server
# This script ensures the .env file is loaded via python-dotenv

cd "$(dirname "$0")"

# Start the server (dotenv is loaded in main.py)
.venv/Scripts/python3 -m uvicorn server.api.main:app --reload --host 127.0.0.1 --port 8000
