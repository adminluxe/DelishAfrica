#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SERV="$ROOT/services"
ts="$(date +%Y%m%d_%H%M%S)"

cd "$ROOT"

# 1) Trouver orders.module.ts (auto)
MOD="$(rg -n "export class OrdersModule" "$SERV" -S --files-with-matches | head -n 1 || true)"
if [[ -z "${MOD:-}" ]]; then
  MOD="$(find "$SERV" -type f -name "orders.module.ts" 2>/dev/null | head -n 1 || true)"
fi
if [[ -z "${MOD:-}" ]]; then
  echo "❌ Impossible de trouver OrdersModule (orders.module.ts) sous $SERV"
  echo "   Essaie: rg -n \"export class OrdersModule\" $SERV -S"
  exit 1
fi

DIR="$(dirname "$MOD")"
CTRL="$DIR/orders.demo.flow.controller.ts"

echo "✅ OrdersModule: $MOD"
echo "✅ Controller : $CTRL"

cp -a "$MOD" "$MOD.bak.$ts"

# 2) Écrire le controller (create/list/get/status uniquement)
cat > "$CTRL" <<'TS'
import { Body, Controller, Post } from "@nestjs/common";

type DemoOrderStatus = "pending" | "accepted" | "ready" | "picked_up" | "delivered" | "cancelled";

type DemoOrderItem = {
  id: string;
  name: string;
  qty: number;
  price: number;
};

type DemoOrder = {
  id: string;
  partnerSlug: string;
  status: DemoOrderStatus;
  items: DemoOrderItem[];
  totals: { itemsCount: number; amount: number; currency: string };
  createdAt: string;
  updatedAt: string;
  timeline: { at: string; status: DemoOrderStatus; note?: string }[];
};

const DEMO_ORDERS = new Map<string, DemoOrder>();

function nowIso(): string { return new Date().toISOString(); }
function makeId(): string { return `demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
function slugify(v: any): string { return String(v ?? "").trim().toLowerCase(); }
function toNum(v: any, d = 0): number { const n = Number(v); return Number.isFinite(n) ? n : d; }

function safeItems(raw: any): DemoOrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => ({
      id: String(x?.id ?? "item"),
      name: String(x?.name ?? "Item"),
      qty: Math.max(1, Math.floor(toNum(x?.qty, 1))),
      price: Math.max(0, toNum(x?.price, 0)),
    }))
    .slice(0, 50);
}

function computeTotals(items: DemoOrderItem[]) {
  const itemsCount = items.reduce((a, i) => a + toNum(i.qty, 0), 0);
  const amount = items.reduce((a, i) => a + toNum(i.qty, 0) * toNum(i.price, 0), 0);
  return { itemsCount, amount: Math.round(amount * 100) / 100, currency: "EUR" };
}

@Controller("/api/v1/orders/demo")
export class OrdersDemoFlowController {
  @Post("create")
  create(@Body() body: any) {
    const partnerSlug = slugify(body?.partnerSlug ?? body?.partner ?? "thieyp");
    const items = safeItems(body?.items);

    const id = makeId();
    const at = nowIso();

    const order: DemoOrder = {
      id,
      partnerSlug,
      status: "pending",
      items,
      totals: computeTotals(items),
      createdAt: at,
      updatedAt: at,
      timeline: [{ at, status: "pending", note: "created" }],
    };

    DEMO_ORDERS.set(id, order);
    return { ok: true, order };
  }

  @Post("list")
  list(@Body() body: any) {
    const role = slugify(body?.role ?? "");
    const partnerSlug = slugify(body?.partnerSlug ?? body?.partner ?? "");
    const statuses = Array.isArray(body?.statuses) ? body.statuses.map((s: any) => slugify(s)) : [];

    let list = Array.from(DEMO_ORDERS.values());
    if (partnerSlug) list = list.filter((o) => o.partnerSlug === partnerSlug);

    if (statuses.length) {
      list = list.filter((o) => statuses.includes(o.status));
    } else {
      if (role === "merchant") list = list.filter((o) => ["pending", "accepted", "ready"].includes(o.status));
      if (role === "courier") list = list.filter((o) => ["ready", "picked_up"].includes(o.status));
    }

    list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return { ok: true, orders: list };
  }

  @Post("get")
  get(@Body() body: any) {
    const id = String(body?.id ?? "").trim();
    const order = DEMO_ORDERS.get(id);
    if (!order) return { ok: false, error: "not_found" };
    return { ok: true, order };
  }

  @Post("status")
  status(@Body() body: any) {
    const id = String(body?.id ?? "").trim();
    const status = slugify(body?.status ?? "");
    const note = body?.note ? String(body.note) : undefined;

    const order = DEMO_ORDERS.get(id);
    if (!order) return { ok: false, error: "not_found" };

    const allowed: DemoOrderStatus[] = ["pending", "accepted", "ready", "picked_up", "delivered", "cancelled"];
    if (!allowed.includes(status as any)) return { ok: false, error: "bad_status" };

    const at = nowIso();
    const next: DemoOrder = {
      ...order,
      status: status as DemoOrderStatus,
      updatedAt: at,
      timeline: [...order.timeline, { at, status: status as DemoOrderStatus, note }],
    };

    DEMO_ORDERS.set(id, next);
    return { ok: true, order: next };
  }
}
TS

# 3) Patch OrdersModule: import + controllers array
if ! rg -q "OrdersDemoFlowController" "$MOD"; then
  # add import
  perl -0777 -i -pe 's/^((?:import[^\n]*\n)+)/$1import { OrdersDemoFlowController } from "\.\/orders\.demo\.flow\.controller";\n/s' "$MOD"

  # add into controllers: [...]
  perl -0777 -i -pe 's/controllers\s*:\s*\[([^\]]*)\]/"controllers: [" . $1 . ( $1 =~ /\S/ ? ", " : "" ) . "OrdersDemoFlowController]"/se' "$MOD"

  echo "✅ OrdersModule patché (import + controllers)"
else
  echo "ℹ️ OrdersDemoFlowController déjà présent dans le module"
fi

echo
echo "✅ Done. Surveille les logs: tu dois voir mapper /api/v1/orders/demo/create|list|get|status"
