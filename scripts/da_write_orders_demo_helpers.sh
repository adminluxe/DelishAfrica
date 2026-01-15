#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
ts="$(date +%Y%m%d_%H%M%S)"

for a in client courier merchant; do
  f="$ROOT/apps/$a/app/orders-demo.ts"
  test -f "$f" || { echo "Missing $f"; exit 1; }
  cp -a "$f" "$f.bak.$ts"

  cat > "$f" <<'TS'
type DemoOrderStatus = "pending" | "accepted" | "ready" | "picked_up" | "delivered" | "cancelled";

export type DemoOrderItem = {
  id: string;
  name: string;
  qty: number;
  price: number;
};

function joinUrl(base: string, path: string) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

async function call<T>(method: string, url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = text;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text?.slice?.(0, 250) ?? ""}`);
  }
  return json as T;
}

export async function demoReset(base: string) {
  return call("POST", joinUrl(base, "/api/v1/orders/demo/reset"), {});
}

export async function demoCreate(base: string, payload: { partnerSlug: string; items: DemoOrderItem[] }) {
  return call("POST", joinUrl(base, "/api/v1/orders/demo/create"), payload);
}

export async function demoList(base: string, payload: { role?: string; partnerSlug?: string; statuses?: DemoOrderStatus[] }) {
  return call("POST", joinUrl(base, "/api/v1/orders/demo/list"), payload);
}

export async function demoGet(base: string, payload: { id: string }) {
  return call("POST", joinUrl(base, "/api/v1/orders/demo/get"), payload);
}

export async function demoSetStatus(base: string, payload: { id: string; status: DemoOrderStatus; note?: string }) {
  return call("POST", joinUrl(base, "/api/v1/orders/demo/status"), payload);
}
TS

  echo "✅ wrote $f"
done
