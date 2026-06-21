#!/usr/bin/env bash
# Start the NZEB decision engine (FastAPI + pymoo)
set -e
cd "$(dirname "$0")"
exec .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 "$@"
