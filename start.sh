#!/bin/bash

# Ontology Project Starter
# Kills existing processes on project ports, then starts dev servers

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔍 Checking for existing processes..."

# Backend ports
BACKEND_PORTS=(3001 3002 3003 8123)
# Frontend ports
FRONTEND_PORTS=(5172 5173 5174 5175 5176)
ALL_PORTS=("${BACKEND_PORTS[@]}" "${FRONTEND_PORTS[@]}")

KILLED=false
for port in "${ALL_PORTS[@]}"; do
  pid=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "  Killing PID on port $port: $pid"
    kill -9 "$pid" 2>/dev/null || true
    KILLED=true
  fi
done

if [ "$KILLED" = true ]; then
  echo "⏳ Waiting for ports to be released..."
  sleep 2
else
  echo "  No existing processes found."
fi

# Verify ports are free
for port in "${ALL_PORTS[@]}"; do
  pid=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "❌ Port $port is still in use by PID $pid"
    echo "   Please kill the process manually: kill -9 $pid"
    exit 1
  fi
done

echo ""
echo "🚀 Starting dev servers..."
echo "   Ontology server → :3001"
echo "   Ability server  → :3002"
echo "   Scene server    → :3003"
echo "   Scene layer     → :5176"
echo "   Portal          → :5172"
echo "   Ontology app    → :5173"
echo "   Ability app     → :5174"
echo "   Chat API        → :8123"
echo "   Chat UI         → :5175"
echo ""

cd "$SCRIPT_DIR"
npm run dev
