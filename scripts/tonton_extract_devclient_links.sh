#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SESSION="${1:-DA_REL}"

grab() {
  local win="$1"
  tmux capture-pane -t "${SESSION}:${win}" -pS -3000 \
    | grep -Eo 'exp\+client://[^ ]+|exp\+merchant://[^ ]+|exp\+courier://[^ ]+' \
    | head -n 1 || true
}

echo "=== DEV CLIENT LINKS (session: $SESSION) ==="
echo

echo "CLIENT  (win 5): $(grab 5)"
echo "MERCHANT(win 6): $(grab 6)"
echo "COURIER (win 7): $(grab 7)"
echo
echo "Astuce iOS: colle le lien dans Safari (pas besoin de QR)."
