#!/usr/bin/env bash
# DelishAfrica Dev Environment Restart Script
# This script cleans up any existing processes and relaunches the development environment (API + 3 Expo apps) in a tmux session.

# Exit immediately if any command fails, and treat unset variables as errors
set -euo pipefail

# Optionally, ensure the script is run with root privileges for port and docker management
if [[ "$EUID" -ne 0 ]]; then
  echo "⚠️  Please run this script as root (or via sudo) to ensure all operations can succeed."
  echo "   (Root is required for killing processes on privileged ports and managing Docker.)"
  # We don't exit here to allow running as a normal user for development, but root is recommended for full cleanup.
fi

# Configuration
SESSION="delish"                            # tmux session name
PROJECT_ROOT="/opt/delishafrica/monorepo"   # project root directory
APPS_DIR="$PROJECT_ROOT/apps"               # directory containing Expo apps
EXPO_APPS=(client merchant courier)         # list of Expo app subdirectories in $APPS_DIR
NEST_CMD="npm run start:dev"                # command to start NestJS API in dev mode (adjust if different)
API_PORT=3010                               # NestJS API dev port
OLD_API_PORT=4001                           # Old API port (Luxeevents) to avoid
EXPO_BASE_PORT=8081                         # Base Metro bundler port for first Expo app (others use 8082, 8083)
EXPO_BASE_URL_PORT=19000                    # Base Expo dev URL port for first app (others use 19001, 19002)

echo ">>> [1/5] Cleaning up old processes and freeing ports..."

# Kill any process that might be using the key ports (Node/Expo/Metro or old API).
# Using fuser to kill processes listening on specific ports:contentReference[oaicite:7]{index=7}.
PORTS_TO_KILL=( "$API_PORT" "$OLD_API_PORT" 8081 8082 8083 19000 19001 19002 )
for PORT in "${PORTS_TO_KILL[@]}"; do
  # If a process is listening on $PORT, this will kill it (both IPv4 and IPv6 if applicable).
  fuser -k "${PORT}"/tcp 2>/dev/null || true
done

# Also attempt to kill any lingering Expo or Metro processes by name, as a fallback.
pkill -f "expo-cli" 2>/dev/null || true      # Expo CLI processes (if any)
pkill -f "node .*metro" 2>/dev/null || true  # Metro bundler processes (if any)
pkill -f "luxeevents" 2>/dev/null || true    # Old Luxeevents API processes (if any)

# Give some time for processes to terminate
sleep 2

# Clear Metro bundler caches to avoid stale files:contentReference[oaicite:8]{index=8}.
echo ">>> Clearing Metro bundler caches..."
if command -v watchman >/dev/null 2>&1; then
  watchman watch-del-all || true   # Reset watchman watches (if watchman is installed)
fi
# Remove Metro caches from temporary directories (these env vars default to /tmp if not set).
rm -rf "${TMPDIR:-/tmp}"/metro-cache || true
rm -rf "${TMPDIR:-/tmp}"/haste-map-* || true

# (Optional) Clear any project-specific caches (if applicable, e.g., .expo or node_modules caches).
# rm -rf $PROJECT_ROOT/.expo # (Uncomment if needed to clear Expo project cache directory)

echo ">>> [2/5] Restarting Docker services (database, redis, etc.)..."
# Check for docker-compose file and bring up services if present.
cd "$PROJECT_ROOT"
if [[ -f "docker-compose.yml" || -f "docker-compose.yaml" ]]; then
  # Ensure Docker daemon is running (if not, try to start it)
  if ! pgrep -x dockerd >/dev/null 2>&1; then
    echo "Docker daemon not running. Starting Docker..."
    systemctl start docker 2>/dev/null || sudo systemctl start docker 2>/dev/null || true
  fi
  # Launch (or reattach to) Docker containers in the background
  docker-compose up -d
fi

echo ">>> [3/5] Setting up tmux session '$SESSION' with windows..."
# If a previous tmux session exists, kill it to start fresh (to avoid zombie processes)
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Existing tmux session '$SESSION' found. Killing it to restart..."
  tmux kill-session -t "$SESSION"
fi

# Create a new tmux session, detached, with window 0 named "shell"
tmux new-session -d -s "$SESSION" -n "shell" -c "$PROJECT_ROOT"

# Window 0: Shell (already created above, in project root). We can send a command to set context if needed.
tmux send-keys -t "$SESSION":0 "echo '*** DelishAfrica Dev Environment ***'" C-m

# Window 1: API (NestJS) logs -> start the NestJS API server
tmux new-window -t "$SESSION":1 -n "API" -c "$PROJECT_ROOT" \
    "echo 'Starting NestJS API on port $API_PORT...' && export PORT=$API_PORT && $NEST_CMD"
# The above command will keep running (showing API logs). `export PORT=3010` ensures it runs on 3010 (if the app uses PORT env).

# Window 2: Health Check -> continuously ping the API health endpoint
tmux new-window -t "$SESSION":2 -n "Health" -c "$PROJECT_ROOT" \
    "bash -c 'echo \"Waiting for API to respond...\"; \
    while true; do \
      date_str=\$(date +\"%T\"); \
      if curl -sf http://localhost:$API_PORT/health >/dev/null; then \
        echo \"\$date_str API OK\"; \
      else \
        echo \"\$date_str API not responding\"; \
      fi; \
      sleep 5; \
    done'"

# Window 3: Ports/Netstat -> monitor ports usage
tmux new-window -t "$SESSION":3 -n "Ports" -c "$PROJECT_ROOT" \
    "watch -n 2 'ss -tulpn | grep -E \"($API_PORT|$OLD_API_PORT|8081|8082|8083|19000|19001|19002)\"'"

# Windows 4-6: Expo apps (Client, Merchant, Courier)
index=4
for app in "${EXPO_APPS[@]}"; do
  # Determine the working directory for the app
  APP_DIR="$APPS_DIR/$app"
  if [[ ! -d "$APP_DIR" ]]; then
    echo "Warning: Directory $APP_DIR not found! Skipping $app."
    continue
  fi
  # Choose a unique starting port offset for each expo instance to avoid conflicts (if needed)
  # Expo will auto-increment ports if defaults are busy, but we ensure difference by offsetting by index-4 (0,1,2).
  BUNDLER_PORT=$((EXPO_BASE_PORT + index - 4))
  TUNNEL_PORT=$((EXPO_BASE_URL_PORT + index - 4))
  # Launch Expo start in tunnel mode for the app
  tmux new-window -t "$SESSION":$index -n "$app" -c "$APP_DIR" \
      "echo 'Starting Expo for $app on ports $BUNDLER_PORT/$TUNNEL_PORT...' && npx expo start --tunnel --clear --port $BUNDLER_PORT"
  # Note: Expo CLI will automatically use $TUNNEL_PORT for the tunnel URL corresponding to the bundler port.
  ((index++))
done

# Window 7: Platform (placeholder)
tmux new-window -t "$SESSION":7 -n "Platform" -c "$PROJECT_ROOT" \
    "echo 'No platform service defined. (This window is reserved for future use.)'; bash"

# Window 8: Free shell
tmux new-window -t "$SESSION":8 -n "shell2" -c "$PROJECT_ROOT"

# Window 9: Final logs (placeholder or combined logs)
tmux new-window -t "$SESSION":9 -n "logs" -c "$PROJECT_ROOT" \
    "echo 'Combine or tail logs here (e.g., tail -f combined.log)'; bash"

# Optional: Prevent accidental Ctrl-C from terminating critical processes by disabling Ctrl-C in those windows.
# (In practice, users should avoid sending Ctrl-C to running processes; tmux detach should be used instead.)
# tmux send-keys -t "$SESSION":1 C-c  # (Example of sending Ctrl-C if needed to stop something, not used here)

echo ">>> [4/5] Launching all services in tmux session. Attaching in a moment..."
# Give a few seconds for processes to start up (API and Metro bundlers)
sleep 5

# Quick health check for API
API_STATUS="KO"
if curl -sf "http://localhost:$API_PORT" >/dev/null; then
  API_STATUS="OK"
fi

# Quick check for Expo ports (to see if at least one Expo tunnel is up)
QR_STATUS="OK"
for port in 19000 19001 19002; do
  # If any of these ports is listening, we assume the corresponding Expo is running.
  ss -tulpn | grep -q ":$port " && { QR_STATUS="OK"; break; }
done
# If none of the ports were found, mark QR status as not ready
if [[ "$QR_STATUS" != "OK" ]]; then
  QR_STATUS="Not ready"
fi

echo ">>> [5/5] Done."
echo "====================== STATUS ======================"
echo "NestJS API on port $API_PORT: $API_STATUS"
echo "Expo development servers (QR codes): $QR_STATUS"
echo "====================================================="

echo ""
echo "Quick verification tips:"
echo " - API: Try 'curl http://localhost:$API_PORT/health' (or relevant health URL) to check API response."
echo " - Ports: Run 'ss -tulpn | grep -E \"$API_PORT|8081|8082|8083|19000|19001|19002\"' to see open ports."
echo " - tmux: Attach to the tmux session with 'tmux a -t $SESSION' to view logs and QR codes."
echo ""
echo "To detach from tmux, press Ctrl-B then D. The dev environment will continue running in the background."
echo "====================================================="
# (Note: We are not auto-attaching tmux session in this script; user can attach manually as needed.)
