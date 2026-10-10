#!/usr/bin/env bash
# DelishAfrica P5-G -- safe, repeatable ONE-SHOT read-only preflight.
# Runs ONLY on the isolated laboratory, never repeats Stripe CREATE/CANCEL.
set -Eeuo pipefail
umask 077

ROOT="/home/afripayadmin/worktrees/guest-p5g-stripe-capture-lab-20261010"
BRANCH="feature/client-guest-p5g-stripe-capture-lab-20261010"
LAB_BASE="/home/afripayadmin/guest-checkout-evidence-20261010"
PGDATA="$LAB_BASE/pg-lab-p5g"
PGSOCKET="$LAB_BASE/pg-p5g-socket"
PORT=55443
STARTED_LAB=0

stop_started_lab() {
  if [[ "$STARTED_LAB" == 1 ]]; then
    /usr/lib/postgresql/16/bin/pg_ctl -D "$PGDATA" -m fast stop >/dev/null || true
    echo "P5G_LAB_RETURNED_TO_STOPPED_STATE"
  fi
}
trap stop_started_lab EXIT

[[ -d "$ROOT" && -f "$PGDATA/PG_VERSION" ]] || {
  echo "REFUSE_MISSING_ISOLATED_LAB_OR_BRANCH" >&2; exit 3;
}
[[ "$(git -C "$ROOT" branch --show-current)" == "$BRANCH" ]] || {
  echo "REFUSE_WRONG_BRANCH" >&2; exit 3;
}
[[ "$(/usr/lib/postgresql/16/bin/pg_config --version)" == PostgreSQL* ]] || {
  echo "REFUSE_POSTGRES_RUNTIME" >&2; exit 3;
}
if ! pg_isready -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1; then
  mkdir -p "$PGSOCKET"
  /usr/lib/postgresql/16/bin/pg_ctl -D "$PGDATA" -l "$LAB_BASE/pg-p5g.log" \
     -o "-h 127.0.0.1 -p $PORT -k $PGSOCKET" start
  STARTED_LAB=1
fi

[[ "$(psql -h 127.0.0.1 -p "$PORT" -U afripayadmin -d postgres -Atqc \
   "SELECT inet_server_port()")" == "$PORT" ]] || {
  echo "REFUSE_UNEXPECTED_DB_TARGET" >&2; exit 5;
}

echo "P5G_SAFE_GATE=READ_ONLY"
echo "STRIPE_LIVE=FORBIDDEN"
echo "NEW_PAYMENT_INTENTS=NONE"
sudo -n python3 "$ROOT/scripts/da_guest_p5g_capture_real_gate.py"
git -C "$ROOT" diff --check
echo "P5G_SAFE_ONE_SHOT_RESULT=PASS"
