#!/bin/bash
# Start the LinerNotes ML Service API

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Warning: .env file not found. Using defaults."
    echo "Copy .env.example to .env and configure."
fi

# Default values
API_HOST=${API_HOST:-0.0.0.0}
API_PORT=${API_PORT:-8000}
API_WORKERS=${API_WORKERS:-4}
LOG_LEVEL=${LOG_LEVEL:-info}

echo "🚀 Starting LinerNotes ML Service API"
echo "  Host: $API_HOST"
echo "  Port: $API_PORT"
echo "  Workers: $API_WORKERS"
echo "  Log Level: $LOG_LEVEL"
echo ""

# Run with uvicorn
uvicorn api.main:app \
    --host "$API_HOST" \
    --port "$API_PORT" \
    --workers "$API_WORKERS" \
    --log-level "$LOG_LEVEL" \
    --reload
