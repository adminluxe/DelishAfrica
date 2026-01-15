#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SRC="$ROOT/services/api-rest/src"
ts="$(date +%Y%m%d_%H%M%S)"

cd "$ROOT"

# 1) Find the controller file that already contains demo/reset
FILE="$(rg -n "demo/reset" "$SRC" -S --files-with-matches | head -n 1 || true)"
if [[ -z "${FILE:-}" ]]; then
  echo "❌ Impossible de trouver 'demo/reset' dans $SRC"
  echo "   Lance: rg -n \"demo/reset\" $SRC -S"
  exit 1
fi

echo "✅ Controller détecté: $FILE"
cp -a "$FILE" "$FILE.bak.$ts"

# 2) Ensure Body/Post are imported from @nestjs/common (patch import line if needed)
perl -i -pe '
  if (/from\x20\x27\@nestjs\/common\x27;/) {
    if (/import\s+\{/) {
      my $line = $_;
      $line =~ s/\{\s*([^}]*)\s*\}/{
        my $inside = $1;
        my %seen = map { s/^\s+|\s+$//gr => 1 } split(/\s*,\s*/, $inside);
        $seen{"Post"} = 1;
        $seen{"Body"} = 1;
        my @out = sort keys %seen;
        "{ " . join(", ", @out) . " }"
      }/e;
      $_ = $line;
    }
  }
' "$FILE"

# 3) Inject demo store + endpoints (once)
if ! rg -q "const\s+DEMO_ORDERS\s*=\s*new\s+Map" "$FILE"; then
  perl -0777 -i -pe 's/^((?:import[^\n]*\n)+\n)/$1\/\/ DEMO ORDERS (in-memory)\n\ntype DemoOrderStatus = "pending" | "accepted" | "ready" | "picked_up" | "delivered" | "cancelled";\n\ntype DemoOrderItem = {\n  id: string;\n  name: string;\n  qty: number;\n  price: number;\n};\n\ntype DemoOrder = {\n  id: string;\n  partnerSlug: string;\n  status: DemoOrderStatus;\n  items: DemoOrderItem[];\n  totals: { itemsCount: number; amount: number; currency: string };\n  createdAt: string;\n  updatedAt: string;\n  timeline: { at: string; status: DemoOrderStatus; note?: string }[];\n};\n\nconst DEMO_ORDERS = new Map<string, DemoOrder>();\n\nfunction nowIso(): string { return new Date().toISOString(); }\nfunction makeId(): string { return `demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }\nfunction slugify(v: any): string { return String(v ?? \"\").trim().toLowerCase(); }\nfunction toNum(v: any, d = 0): number { const n = Number(v); return Number.isFinite(n) ? n : d; }\nfunction safeItems(raw: any): DemoOrderItem[] {\n  if (!Array.isArray(raw)) return [];\n  return raw.map((x) => ({\n    id: String(x?.id ?? \"item\"),\n    name: String(x?.name ?? \"Item\"),\n    qty: Math.max(1, Math.floor(toNum(x?.qty, 1))),\n    price: Math.max(0, toNum(x?.price, 0)),\n  })).slice(0, 50);\n}\nfunction computeTotals(items: DemoOrderItem[]) {\n  const itemsCount = items.reduce((a, i) => a + toNum(i.qty, 0), 0);\n  const amount = items.reduce((a, i) => a + toNum(i.qty, 0) * toNum(i.price, 0), 0);\n  return { itemsCount, amount: Math.round(amount * 100) / 100, currency: \"EUR\" };\n}\n\n/s' "$FILE"
  echo "✅ Store DEMO_ORDERS injecté"
else
  echo "ℹ️ Store déjà présent"
fi

# 4) Ensure demo/reset clears the store (best-effort)
if rg -q "demo/reset" "$FILE" && ! rg -q "DEMO_ORDERS\.clear\(\)" "$FILE"; then
  perl -0777 -i -pe 's/(\x27demo\/reset\x27[\s\S]*?\{)/$1\n    DEMO_ORDERS.clear();/s' "$FILE"
  echo "✅ demo/reset -> DEMO_ORDERS.clear()"
fi

# 5) Append endpoints inside the controller class (once)
if ! rg -q "demo/create" "$FILE"; then
  perl -0777 -i -pe 's/(\n}\s*$)/\n  \@Post(\x27demo\/create\x27)\n  demoCreate(\@Body() body: any) {\n    const partnerSlug = slugify(body?.partnerSlug ?? body?.partner ?? \"thieyp\");\n    const items = safeItems(body?.items);\n    const id = makeId();\n    const at = nowIso();\n    const order: DemoOrder = {\n      id,\n      partnerSlug,\n      status: \"pending\",\n      items,\n      totals: computeTotals(items),\n      createdAt: at,\n      updatedAt: at,\n      timeline: [{ at, status: \"pending\", note: \"created\" }],\n    };\n    DEMO_ORDERS.set(id, order);\n    return { ok: true, order };\n  }\n\n  \@Post(\x27demo\/list\x27)\n  demoList(\@Body() body: any) {\n    const role = slugify(body?.role ?? \"\");\n    const partnerSlug = slugify(body?.partnerSlug ?? body?.partner ?? \"\");\n    const statuses = Array.isArray(body?.statuses) ? body.statuses.map((s: any) => slugify(s)) : [];\n\n    let list = Array.from(DEMO_ORDERS.values());\n    if (partnerSlug) list = list.filter((o) => o.partnerSlug === partnerSlug);\n\n    if (statuses.length) {\n      list = list.filter((o) => statuses.includes(o.status));\n    } else {\n      if (role === \"merchant\") list = list.filter((o) => [\"pending\", \"accepted\", \"ready\"].includes(o.status));\n      if (role === \"courier\") list = list.filter((o) => [\"ready\", \"picked_up\"].includes(o.status));\n    }\n\n    list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));\n    return { ok: true, orders: list };\n  }\n\n  \@Post(\x27demo\/get\x27)\n  demoGet(\@Body() body: any) {\n    const id = String(body?.id ?? \"\").trim();\n    const order = DEMO_ORDERS.get(id);\n    if (!order) return { ok: false, error: \"not_found\" };\n    return { ok: true, order };\n  }\n\n  \@Post(\x27demo\/status\x27)\n  demoStatus(\@Body() body: any) {\n    const id = String(body?.id ?? \"\").trim();\n    const status = slugify(body?.status ?? \"\");\n    const note = body?.note ? String(body.note) : undefined;\n\n    const order = DEMO_ORDERS.get(id);\n    if (!order) return { ok: false, error: \"not_found\" };\n\n    const allowed: DemoOrderStatus[] = [\"pending\", \"accepted\", \"ready\", \"picked_up\", \"delivered\", \"cancelled\"];\n    if (!allowed.includes(status as any)) return { ok: false, error: \"bad_status\" };\n\n    const at = nowIso();\n    const next: DemoOrder = {\n      ...order,\n      status: status as DemoOrderStatus,\n      updatedAt: at,\n      timeline: [...order.timeline, { at, status: status as DemoOrderStatus, note }],\n    };\n    DEMO_ORDERS.set(id, next);\n    return { ok: true, order: next };\n  }\n$1/s' "$FILE"
  echo "✅ Endpoints demo ajoutés"
else
  echo "ℹ️ Endpoints demo déjà présents"
fi

echo
echo "== Grep endpoints =="
rg -n "demo/(reset|create|list|get|status)" "$FILE" || true

echo
echo "⚠️ Il faut RESTART le process api-rest pour que ces routes prennent effet."
