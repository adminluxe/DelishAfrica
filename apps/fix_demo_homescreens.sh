#!/usr/bin/env bash
set -euo pipefail

BASE="/opt/delishafrica/monorepo/apps"

echo "→ Injection app/index.tsx pour CLIENT, COURIER, MERCHANT"

# CLIENT
cat > "$BASE/client/app/index.tsx" <<'EOC'
[CLIENT_CODE]
EOC

# COURIER
cat > "$BASE/courier/app/index.tsx" <<'EOC'
[COURIER_CODE]
EOC

# MERCHANT
cat > "$BASE/merchant/app/index.tsx" <<'EOC'
[MERCHANT_CODE]
EOC

echo "✓ Fichiers index.tsx réécrits."
echo "Tu peux maintenant :"
echo "  tmux kill-session -t delish || true"
echo "  /usr/local/bin/da_mux"
