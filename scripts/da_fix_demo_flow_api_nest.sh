#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
DIR="$ROOT/services/api-nest/src/orders"
MOD="$DIR/orders.module.ts"
CTRL="$DIR/orders.demo.flow.controller.ts"
ts="$(date +%Y%m%d_%H%M%S)"

test -f "$MOD" || { echo "Missing $MOD"; exit 1; }
mkdir -p "$DIR"
cp -a "$MOD" "$MOD.bak.$ts"

# 1) Write controller (covers demo + _demo, and api/ prefix variants)
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

// ✅ routes sans /api/v1 dans le decorator (car ton serveur ajoute déjà /api/v1 en prefix)
function bindRoutes(cls: any) {
  cls.prototype.create = function(body: any){ return createOrder(body); }
  cls.prototype.list   = function(body: any){ return listOrders(body); }
  cls.prototype.get    = function(body: any){ return getOrder(body); }
  cls.prototype.status = function(body: any){ return setStatus(body); }
}

@Controller("orders/demo")
export class OrdersDemoFlowController {
  @Post("create") create(@Body() body: any) { return createOrder(body); }
  @Post("list")   list(@Body() body: any) { return listOrders(body); }
  @Post("get")    get(@Body() body: any) { return getOrder(body); }
  @Post("status") status(@Body() body: any) { return setStatus(body); }
}

@Controller("api/orders/demo")
export class OrdersDemoFlowApiController {
  @Post("create") create(@Body() body: any) { return createOrder(body); }
  @Post("list")   list(@Body() body: any) { return listOrders(body); }
  @Post("get")    get(@Body() body: any) { return getOrder(body); }
  @Post("status") status(@Body() body: any) { return setStatus(body); }
}

@Controller("orders/_demo")
export class OrdersDemoFlowUnderscoreController {
  @Post("create") create(@Body() body: any) { return createOrder(body); }
  @Post("list")   list(@Body() body: any) { return listOrders(body); }
  @Post("get")    get(@Body() body: any) { return getOrder(body); }
  @Post("status") status(@Body() body: any) { return setStatus(body); }
}

@Controller("api/orders/_demo")
export class OrdersDemoFlowUnderscoreApiController {
  @Post("create") create(@Body() body: any) { return createOrder(body); }
  @Post("list")   list(@Body() body: any) { return listOrders(body); }
  @Post("get")    get(@Body() body: any) { return getOrder(body); }
  @Post("status") status(@Body() body: any) { return setStatus(body); }
}
TS

# 2) Patch OrdersModule (Node: import + controllers array)
node - <<'NODE'
const fs = require("fs");

const modPath = "/opt/delishafrica/monorepo/services/api-nest/src/orders/orders.module.ts";
let s = fs.readFileSync(modPath, "utf8");

const importLine = `import { OrdersDemoFlowController, OrdersDemoFlowApiController, OrdersDemoFlowUnderscoreController, OrdersDemoFlowUnderscoreApiController } from "./orders.demo.flow.controller";\n`;

if (s.includes("orders.demo.flow.controller")) {
  s = s.replace(
    /^import\s*\{[^}]*\}\s*from\s*["']\.\/orders\.demo\.flow\.controller["'];\s*\n/m,
    importLine
  );
} else {
  // inject after last import
  const matches = [...s.matchAll(/^import .*?;\s*$/gm)];
  if (!matches.length) throw new Error("No imports found in orders.module.ts");
  const last = matches[matches.length - 1];
  const idx = last.index + last[0].length;
  s = s.slice(0, idx) + "\n" + importLine + s.slice(idx);
}

// controllers array patch
const m = s.match(/controllers\s*:\s*\[([\s\S]*?)\]/m);
if (!m) throw new Error("controllers: [...] not found in orders.module.ts");

const inside = m[1]
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);

const need = [
  "OrdersDemoFlowController",
  "OrdersDemoFlowApiController",
  "OrdersDemoFlowUnderscoreController",
  "OrdersDemoFlowUnderscoreApiController",
];

for (const n of need) if (!inside.includes(n)) inside.push(n);

const replaced = `controllers: [${inside.join(", ")}]`;
s = s.replace(/controllers\s*:\s*\[[\s\S]*?\]/m, replaced);

fs.writeFileSync(modPath, s, "utf8");
console.log("✅ Patched orders.module.ts");
NODE

echo "✅ Wrote $CTRL"
echo "✅ Patched $MOD"
echo "➡️ Redémarre/recompile api-nest (watch ou restart service)"
