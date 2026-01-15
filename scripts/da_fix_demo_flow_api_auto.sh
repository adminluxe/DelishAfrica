#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SEARCH="$ROOT/services"
ts="$(date +%Y%m%d_%H%M%S)"

cd "$ROOT"

# 1) locate orders.module.ts (first match)
MOD="$(find "$SEARCH" -type f -name "orders.module.ts" 2>/dev/null | head -n 1 || true)"

# fallback: ripgrep if find didn't hit (sometimes file named differently)
if [[ -z "${MOD:-}" ]] && command -v rg >/dev/null 2>&1; then
  MOD="$(rg -n "export class OrdersModule" "$SEARCH" -S --files-with-matches | head -n 1 || true)"
fi

if [[ -z "${MOD:-}" ]]; then
  echo "❌ Impossible de trouver orders.module.ts sous: $SEARCH"
  echo "   Essaie:"
  echo "   find $SEARCH -type f -name 'orders.module.ts'"
  echo "   rg -n 'export class OrdersModule' $SEARCH -S"
  exit 1
fi

DIR="$(dirname "$MOD")"
CTRL="$DIR/orders.demo.flow.controller.ts"

echo "✅ OrdersModule détecté:"
echo "   $MOD"
echo "✅ Controller cible:"
echo "   $CTRL"

cp -a "$MOD" "$MOD.bak.$ts"

# 2) write controller (dual paths => couvre /api/v1/... et /api/v1/api/... selon ton setup)
cat > "$CTRL" <<'TS'
import { Body, Controller, Post } from "@nestjs/common";

type DemoOrderStatus = "pending" | "accepted" | "ready" | "picked_up" | "delivered" | "cancelled";
type DemoOrderItem = { id: string; name: string; qty: number; price: number };

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
  return raw.map((x) => ({
    id: String(x?.id ?? "item"),
    name: String(x?.name ?? "Item"),
    qty: Math.max(1, Math.floor(toNum(x?.qty, 1))),
    price: Math.max(0, toNum(x?.price, 0)),
  })).slice(0, 50);
}

function computeTotals(items: DemoOrderItem[]) {
  const itemsCount = items.reduce((a, i) => a + toNum(i.qty, 0), 0);
  const amount = items.reduce((a, i) => a + toNum(i.qty, 0) * toNum(i.price, 0), 0);
  return { itemsCount, amount: Math.round(amount * 100) / 100, currency: "EUR" };
}

function createOrder(body: any) {
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

function listOrders(body: any) {
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

function getOrder(body: any) {
  const id = String(body?.id ?? "").trim();
  const order = DEMO_ORDERS.get(id);
  if (!order) return { ok: false, error: "not_found" };
  return { ok: true, order };
}

function setStatus(body: any) {
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

/**
 * Dual paths to match your current messy prefixes:
 * - /api/v1/orders/demo/*  (if global prefix already adds /api/v1)
 * - /api/v1/api/orders/demo/* (if your app already has /api in controllers)
 */
@Controller("orders/demo")
export class OrdersDemoFlowController {
  @Post("create") create(@Body() body: any) { return createOrder(body); }
  @Post("list") list(@Body() body: any) { return listOrders(body); }
  @Post("get") get(@Body() body: any) { return getOrder(body); }
  @Post("status") status(@Body() body: any) { return setStatus(body); }
}

@Controller("api/orders/demo")
export class OrdersDemoFlowApiController {
  @Post("create") create(@Body() body: any) { return createOrder(body); }
  @Post("list") list(@Body() body: any) { return listOrders(body); }
  @Post("get") get(@Body() body: any) { return getOrder(body); }
  @Post("status") status(@Body() body: any) { return setStatus(body); }
}
TS

# 3) patch OrdersModule (python, safe)
python3 - <<PY
import re, pathlib
p = pathlib.Path("$MOD")
s = p.read_text(encoding="utf-8")

imp = 'import { OrdersDemoFlowController, OrdersDemoFlowApiController } from "./orders.demo.flow.controller";\\n'
if "orders.demo.flow.controller" not in s:
    imports = list(re.finditer(r"^import .*?;\\s*$", s, flags=re.M))
    if not imports:
        raise SystemExit("No import section found to inject controller import.")
    i = imports[-1].end()
    s = s[:i] + "\\n" + imp + s[i:]

m = re.search(r"(controllers\\s*:\\s*\\[)([\\s\\S]*?)(\\])", s)
if not m:
    raise SystemExit("Could not find controllers: [...] in OrdersModule")

before, inside, after = m.group(1), m.group(2), m.group(3)
need = ["OrdersDemoFlowController", "OrdersDemoFlowApiController"]
for n in need:
    if n not in inside:
        inside = inside.rstrip()
        if inside and not inside.strip().endswith(","):
            inside += ","
        inside += (" " if inside else "") + n

s = s[:m.start()] + before + inside + after + s[m.end():]
p.write_text(s, encoding="utf-8")

print("✅ Patched OrdersModule:", p)
PY

echo
echo "✅ Controller écrit + module patché."
echo "➡️ Maintenant, RESTART le process API (ou attends la recompil si watch)."
