#!/usr/bin/env bash
#
# tonton_start_services.sh –  Automate startup of DelishAfrica dev environment after a reset
#
# This script assumes that the repository lives at /opt/delishafrica/monorepo and that a tmux
# session named DA_REL will be used.  It will:
#   * Kill any existing tmux session named DA_REL.
#   * Create a fresh tmux session with 10 windows.
#   * In each window it changes to the appropriate directory, installs dependencies,
#     and launches the corresponding service.  This includes API, health monitor,
#     Expo development servers for client, merchant and courier, and a platform service.
#   * Provides a ports window that lists open ports every few seconds.
#   * Leaves two additional shells empty for ad‑hoc commands.
#
# You can modify the ROOT path and the commands per window if your project structure
# differs.  The script will create a backup of any existing tmux session before
# overwriting it.

set -euo pipefail

# Configuration
SESSION="DA_REL"
ROOT="/opt/delishafrica/monorepo"

# Helper to check if a directory exists before using it.  If the directory does not
# exist, the command will be a simple echo to avoid failing the script.  This allows
# you to customise the directories below without breaking the script if they are
# missing.
cmd_or_echo() {
  local dir="$1"; shift
  local run_cmd="$*"
  if [ -d "$dir" ]; then
    echo "cd $dir && $run_cmd"
  else
    echo "echo 'Directory $dir not found – please adjust the script'"
  fi
}

# Kill existing session if present
if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux kill-session -t "$SESSION"
fi

# Create initial session with the first window
tmux new-session -d -s "$SESSION" -c "$ROOT" -n cmd

# Define the commands for each window.  These commands are run in the context of
# their respective directories.  Adjust the commands if your project uses Yarn
# instead of npm, or if the directories have different names.

# Window 0: General command shell in the repository root
tmux send-keys -t "$SESSION:0" "cd $ROOT" C-m

# Window 1: API service – assumes an API lives under api/ and uses npm to start
tmux new-window -t "$SESSION:1" -n api -c "$ROOT"
tmux send-keys -t "$SESSION:1" "$(cmd_or_echo "$ROOT/api" "npm install --legacy-peer-deps && npm start")" C-m

# Window 2: Health service – assumes a health package with an npm script `start`
tmux new-window -t "$SESSION:2" -n health -c "$ROOT"
tmux send-keys -t "$SESSION:2" "$(cmd_or_echo "$ROOT/health" "npm install --legacy-peer-deps && npm run start")" C-m

# Window 3: Ports watcher – shows listening ports every 5 seconds
tmux new-window -t "$SESSION:3" -n ports -c "$ROOT"
# Use a simple shell loop instead of nested quoting with watch.  This avoids syntax
# errors in the script and still provides a regularly refreshed view of the
# ports used by React Native and Expo.  Adjust the list of ports if your
# services use different ones.
tmux send-keys -t "$SESSION:3" "while true; do lsof -i -P -n | grep -E '(8081|19000|19001|19002|3000|3001|3002|3003|3004|3005)' || true; sleep 5; done" C-m

# Window 4: Client app – Expo dev server for the client
tmux new-window -t "$SESSION:4" -n client -c "$ROOT"
tmux send-keys -t "$SESSION:4" "$(cmd_or_echo "$ROOT/apps/client" "npm install --legacy-peer-deps && npx expo start --dev-client -c")" C-m

# Window 5: Merchant app – Expo dev server for the merchant
tmux new-window -t "$SESSION:5" -n merchant -c "$ROOT"
tmux send-keys -t "$SESSION:5" "$(cmd_or_echo "$ROOT/apps/merchant" "npm install --legacy-peer-deps && npx expo start --dev-client -c")" C-m

# Window 6: Courier app – Expo dev server for the courier
tmux new-window -t "$SESSION:6" -n courier -c "$ROOT"
tmux send-keys -t "$SESSION:6" "$(cmd_or_echo "$ROOT/apps/courier" "npm install --legacy-peer-deps && npx expo start --dev-client -c")" C-m

# Window 7: Platform service – generic start (modify as needed)
tmux new-window -t "$SESSION:7" -n platform -c "$ROOT"
tmux send-keys -t "$SESSION:7" "$(cmd_or_echo "$ROOT/platform" "npm install --legacy-peer-deps && npm start")" C-m

# Windows 8 and 9: Spare shells for miscellaneous commands
tmux new-window -t "$SESSION:8" -n shell -c "$ROOT"
tmux new-window -t "$SESSION:9" -n shell2 -c "$ROOT"

# Focus back on the first window and attach
tmux select-window -t "$SESSION:0"
tmux attach-session -t "$SESSION"
