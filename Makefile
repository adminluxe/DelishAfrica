SHELL := /bin/bash

API_DIR := services/api
PORT ?= 4001

.PHONY: dev-up dev-stop health stripe-listen stripe-trigger mkver

dev-up:
	- docker compose up -d db redis 2>/dev/null || true
	- pm2 delete delish-api 2>/dev/null || true
	pm2 start "bash -lc '\
	  cd $(API_DIR) && \
	  set -a; [ -f ../.env.local ] && . ../.env.local || true; set +a; \
	  export PORT=$(PORT); \
	  pnpm exec ts-node --transpile-only src/main.ts \
	'" --name delish-api
	pm2 save
	- $(MAKE) stripe-listen || true

dev-stop:
	- pm2 delete delish-api 2>/dev/null || true
	- docker compose stop db redis 2>/dev/null || true

health:
	@echo "PORT=$(PORT)"
	@curl -s http://localhost:$(PORT)/api/health | jq .

stripe-listen:
	@if ! command -v stripe >/dev/null 2>&1; then echo "ℹ️ Stripe CLI non installée, écoute désactivée (ok)."; exit 0; fi
	- pkill -f "stripe listen" 2>/dev/null || true
	STRIPE_WEBHOOK_SECRET_FILE=.stripe_webhook_secret \
	stripe listen --events payment_intent.succeeded,payment_intent.payment_failed,checkout.session.completed \
	  --forward-to http://localhost:$(PORT)/api/webhooks/stripe > .stripe_listen.log 2>&1 & disown || true
	@sleep 1; echo "➡️ Logs: .stripe_listen.log"

stripe-trigger:
	@if ! command -v stripe >/dev/null 2>&1; then echo "ℹ️ Stripe CLI non installée, trigger ignoré (ok)."; exit 0; fi
	stripe trigger payment_intent.succeeded || true

mkver:
	@echo "Makefile loaded OK"

.PHONY: api/build
api/build:
	pnpm -C services/api build

.PHONY: api/restart
api/restart:
	services/api/scripts/restart_api.sh

.PHONY: api/restartq
api/restartq:
	services/api/scripts/restart_api.sh --quiet

.PHONY: api/logs
api/logs:
	pm2 logs delish-api --lines 200

.PHONY: api/health
api/health:
	curl -sf http://localhost:4001/api/health && echo OK

.PHONY: api/import-menu
api/import-menu:
	MID?=cmfvw19lo00003hr34q91vls8
	curl -i -X POST "http://localhost:4001/api/merchants/$$MID/import-menu" -F "file=@/tmp/$$MID-menu.csv;type=text/csv"

.PHONY: api/tail
api/tail:
	pm2 logs delish-api --lines 200 --timestamp
