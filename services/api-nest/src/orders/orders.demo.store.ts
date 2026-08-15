import * as fs from 'fs';
import * as path from 'path';

export type DemoOrderStatus =
  | 'pending'
  | 'accepted'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'cancelled';

export type AnyOrder = Record<string, any>;
export type DemoOrder = AnyOrder;

const STORE_VERSION = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStoreFile(): string {
  const fromEnv = process.env.DA_DEMO_ORDERS_STORE_FILE;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  const cwd = process.cwd();
  return path.join(cwd, '.runtime', 'orders-demo-store.json');
}

const STORE_FILE = defaultStoreFile();

let orders: AnyOrder[] = [];

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeRead(): AnyOrder[] {
  try {
    if (!fs.existsSync(STORE_FILE)) return [];
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.orders)) return parsed.orders;

    return [];
  } catch {
    return [];
  }
}

function safeWrite(nextOrders: AnyOrder[]): void {
  try {
    ensureDir(STORE_FILE);
    const payload = {
      version: STORE_VERSION,
      updatedAt: nowIso(),
      count: nextOrders.length,
      orders: nextOrders,
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch {
    // Never break the API flow because persistence failed.
  }
}

function boot(): void {
  orders = safeRead();
}

boot();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalizeStatus(value: any): DemoOrderStatus {
  const s = String(value || '').toLowerCase();

  if (s === 'accepted') return 'accepted';
  if (s === 'ready') return 'ready';
  if (s === 'picked_up' || s === 'pickedup' || s === 'picked-up') return 'picked_up';
  if (s === 'delivered') return 'delivered';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';

  return 'pending';
}

function makePublicId(): string {
  const tail = String(Date.now()).slice(-7);
  const rnd = Math.floor(Math.random() * 90 + 10);
  return `DA-${tail}${rnd}`;
}

function pickId(input: any): string {
  const raw =
    input?.id ||
    input?.orderId ||
    input?.order_id ||
    input?.publicId ||
    input?.public_id ||
    input?.order?.id ||
    input?.body?.id;

  if (raw) return String(raw);

  return makePublicId();
}

function extractId(input: any): string {
  if (typeof input === 'string' || typeof input === 'number') {
    return String(input);
  }

  if (!input || typeof input !== 'object') {
    return '';
  }

  const raw =
    input?.id ||
    input?.orderId ||
    input?.order_id ||
    input?.publicId ||
    input?.public_id ||
    input?.order?.id ||
    input?.order?.orderId ||
    input?.order?.publicId ||
    input?.params?.id ||
    input?.params?.orderId ||
    input?.params?.publicId ||
    input?.body?.id ||
    input?.body?.orderId ||
    input?.body?.order_id ||
    input?.body?.publicId ||
    input?.body?.public_id ||
    input?.payload?.id ||
    input?.payload?.orderId ||
    input?.payload?.publicId;

  return raw ? String(raw) : '';
}

function extractStatus(input: any, fallback?: any): DemoOrderStatus {
  return normalizeStatus(
    fallback ||
      input?.status ||
      input?.nextStatus ||
      input?.next_status ||
      input?.body?.status ||
      input?.payload?.status,
  );
}

function addTimeline(order: AnyOrder, status: DemoOrderStatus, note?: string): AnyOrder {
  const at = nowIso();
  const previous = Array.isArray(order.timeline) ? order.timeline : [];

  order.timeline = [
    ...previous,
    {
      status,
      at,
      changedAt: at,
      label: status,
      note: note || undefined,
    },
  ];

  order.updatedAt = at;
  order.status = status;

  return order;
}

function normalizeOrder(input: any = {}): AnyOrder {
  const at = nowIso();
  const id = pickId(input);
  const status = normalizeStatus(input.status);

  const items =
    Array.isArray(input.items) && input.items.length
      ? input.items
      : [
          {
            name: input.itemName || 'Menu Thieyp Signature',
            quantity: 1,
            price: typeof input.amount === 'number' ? input.amount : 12.9,
          },
        ];

  const total =
    typeof input.total === 'number'
      ? input.total
      : typeof input.amount === 'number'
        ? input.amount
        : 12.9;

  const order: AnyOrder = {
    ...input,
    id,
    orderId: input.orderId || id,
    publicId: input.publicId || id,
    partnerSlug: input.partnerSlug || input.partner || 'thieyp',
    merchantSlug: input.merchantSlug || input.partnerSlug || 'thieyp',
    restaurantName: input.restaurantName || input.partnerName || 'Thieyp',
    customerName: input.customerName || input.clientName || 'Client DelishAfrica',
    customerPhone: input.customerPhone || input.phone || '',
    deliveryAddress:
      input.deliveryAddress ||
      input.address ||
      'Adresse client à confirmer',
    currency: input.currency || 'EUR',
    total,
    amount: typeof input.amount === 'number' ? input.amount : total,
    items,
    status,
    createdAt: input.createdAt || at,
    updatedAt: input.updatedAt || at,
  };

  if (!Array.isArray(order.timeline)) {
    order.timeline = [
      {
        status,
        at,
        changedAt: at,
        label: status,
        note: 'Commande créée',
      },
    ];
  }

  return order;
}

function matchesFilter(order: AnyOrder, filter: any = {}): boolean {
  const status = filter?.status || filter?.body?.status;
  const partnerSlug =
    filter?.partnerSlug ||
    filter?.partner ||
    filter?.merchantSlug ||
    filter?.body?.partnerSlug ||
    filter?.body?.partner ||
    filter?.body?.merchantSlug;

  if (status) {
    const wanted = normalizeStatus(status);
    if (normalizeStatus(order.status) !== wanted) return false;
  }

  if (partnerSlug) {
    const wanted = String(partnerSlug).toLowerCase();
    const current = String(order.partnerSlug || order.merchantSlug || '').toLowerCase();
    if (current && current !== wanted) return false;
  }

  return true;
}

export function getDemoOrdersStoreFile(): string {
  return STORE_FILE;
}

export function resetDemoOrders(seed?: any): AnyOrder[] {
  if (Array.isArray(seed)) {
    orders = seed.map((item) => normalizeOrder(item));
  } else if (seed && Array.isArray(seed.orders)) {
    orders = seed.orders.map((item: any) => normalizeOrder(item));
  } else {
    orders = [];
  }

  safeWrite(orders);
  return clone(orders);
}

export function listDemoOrders(filter?: any): AnyOrder[] {
  boot();
  return clone(orders.filter((order) => matchesFilter(order, filter || {})));
}

export function createDemoOrder(input: any = {}): AnyOrder {
  boot();

  const order = normalizeOrder(input);
  const existingIndex = orders.findIndex((item) => String(item.id) === String(order.id));

  if (existingIndex >= 0) {
    const immutableOwnership = orders[existingIndex]?.daOwnership || order.daOwnership;
    orders[existingIndex] = {
      ...orders[existingIndex],
      ...order,
      ...(immutableOwnership ? { daOwnership: immutableOwnership } : {}),
      updatedAt: nowIso(),
    };
  } else {
    orders.unshift(order);
  }

  safeWrite(orders);
  return clone(existingIndex >= 0 ? orders[existingIndex] : order);
}

export function getDemoOrder(input: any): AnyOrder | null {
  boot();

  const id = extractId(input);
  if (!id) return null;

  const found = orders.find((order) => {
    return (
      String(order.id) === id ||
      String(order.orderId || '') === id ||
      String(order.publicId || '') === id
    );
  });

  return found ? clone(found) : null;
}

export function updateDemoOrderStatus(input: any, maybeStatus?: any): AnyOrder | null {
  boot();

  const id = extractId(input);
  const status = extractStatus(input, maybeStatus);

  if (!id) return null;

  const idx = orders.findIndex((order) => {
    return (
      String(order.id) === id ||
      String(order.orderId || '') === id ||
      String(order.publicId || '') === id
    );
  });

  if (idx < 0) return null;

  orders[idx] = addTimeline(orders[idx], status, `Statut mis à jour : ${status}`);
  safeWrite(orders);

  return clone(orders[idx]);
}


export type DemoOrderCourierProposalInput = {
orderId?: string;
id?: string;
publicId?: string;
courierId?: string;
courierName?: string;
source?: string;
decisionMode?: string;
previewVersion?: string;
score?: number;
confidence?: number;
totalEtaMin?: number;
confirmed?: boolean;
auditId?: string;
expiresAt?: string;
territoryKey?: string;
offerAttempt?: number;
};

function makeProposalAuditId(): string {
const tail = String(Date.now());
const rnd = Math.floor(Math.random() * 9000 + 1000);
return `da-proposal-${tail}-${rnd}`;
}


export function acceptDemoOrderCourier(input: any = {}): AnyOrder | null {
boot();

const orderId = String(input.orderId || input.id || '').trim();
const courierId = String(input.courierId || '').trim();

if (!orderId || !courierId) return null;

const idx = orders.findIndex((order: any) => {
const ids = [order.id, order.orderId, order.publicId].filter(Boolean).map(String);
return ids.includes(orderId);
});

if (idx < 0) return null;

const current = orders[idx] as any;
const proposal = current.assignmentProposal || null;

if (!proposal || proposal.status !== 'proposed') return null;
if (String(proposal.courierId || '') !== courierId) return null;

const now = nowIso();
const auditId = input.auditId || `da-accept-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

const acceptedProposal = {
...proposal,
status: 'accepted',
acceptedAt: now,
acceptedSource: input.source || 'courier-proposal-card',
acceptDecisionMode: input.decisionMode || 'courier_confirmed',
acceptAuditId: auditId,
};

const timeline = Array.isArray(current.timeline) ? current.timeline : [];

orders[idx] = {
...current,
status: current.status,
updatedAt: now,
assignmentProposal: acceptedProposal,
timeline: [
...timeline,
{
status: current.status,
at: now,
changedAt: now,
label: 'courier_accepted',
note: `Proposition acceptée par ${proposal.courierName || courierId}`,
courierId,
auditId,
},
],
} as AnyOrder;

safeWrite(orders);

return clone(orders[idx]);
}

export function proposeDemoOrderCourier(input: DemoOrderCourierProposalInput = {}): AnyOrder | null {
boot();

const id = extractId(input);
if (!id) return null;

const idx = orders.findIndex((order) => {
return (
String(order.id) === id ||
String(order.orderId || '') === id ||
String(order.publicId || '') === id
);
});

if (idx < 0) return null;

const at = nowIso();
const auditId = input.auditId || makeProposalAuditId();
const courierId = String(input.courierId || '').trim();
const courierName = String(input.courierName || courierId || 'Coursier recommandé').trim();

const previousTimeline = Array.isArray(orders[idx].timeline) ? orders[idx].timeline : [];

orders[idx] = {
...orders[idx],
assignmentProposal: {
status: 'proposed',
courierId,
courierName,
proposedAt: at,
source: input.source || 'dispatch-intelligence',
decisionMode: input.decisionMode || 'human_confirmed',
previewVersion: input.previewVersion || 'v1a_readonly',
score: typeof input.score === 'number' ? input.score : undefined,
confidence: typeof input.confidence === 'number' ? input.confidence : undefined,
totalEtaMin: typeof input.totalEtaMin === 'number' ? input.totalEtaMin : undefined,
auditId,
expiresAt: input.expiresAt,
territoryKey: input.territoryKey,
offerAttempt: input.offerAttempt,
},
updatedAt: at,
timeline: [
...previousTimeline,
{
status: orders[idx].status,
at,
changedAt: at,
label: 'courier_proposed',
note: `Proposition envoyée à ${courierName}`,
courierId,
auditId,
},
],
};

safeWrite(orders);

return clone(orders[idx]);
}

export function rejectDemoOrderCourier(input: any = {}): AnyOrder | null {
  boot();
  const orderId = String(input.orderId || input.id || input.publicId || '').trim();
  const courierId = String(input.courierId || '').trim();
  if (!orderId || !courierId) return null;
  const idx = orders.findIndex((order: any) => [order.id, order.orderId, order.publicId].filter(Boolean).map(String).includes(orderId));
  if (idx < 0) return null;
  const current = orders[idx] as any;
  const proposal = current.assignmentProposal || null;
  if (!proposal || proposal.status !== 'proposed' || String(proposal.courierId || '') !== courierId) return null;
  const now = nowIso();
  const auditId = `da-reject-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  orders[idx] = {
    ...current,
    updatedAt: now,
    assignmentProposal: {
      ...proposal,
      status: 'rejected',
      rejectedAt: now,
      rejectedReason: input.reason || 'courier_declined',
      rejectAuditId: auditId,
    },
    timeline: [
      ...(Array.isArray(current.timeline) ? current.timeline : []),
      { status: current.status, at: now, changedAt: now, label: 'courier_rejected', note: 'Offre refusée par le coursier', courierId, auditId },
    ],
  } as AnyOrder;
  safeWrite(orders);
  return clone(orders[idx]);
}

export function releaseDemoOrderCourierAssignment(input: any = {}): AnyOrder | null {
  boot();
  const orderId = String(input.orderId || input.id || input.publicId || '').trim();
  const courierId = String(input.courierId || '').trim();
  if (!orderId) return null;
  const idx = orders.findIndex((order: any) => [order.id, order.orderId, order.publicId].filter(Boolean).map(String).includes(orderId));
  if (idx < 0) return null;
  const current = orders[idx] as any;
  const proposal = current.assignmentProposal || null;
  if (!proposal) return clone(current);
  if (courierId && String(proposal.courierId || '') !== courierId) return null;
  const now = nowIso();
  const auditId = `da-release-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  orders[idx] = {
    ...current,
    updatedAt: now,
    assignmentProposal: {
      ...proposal,
      status: 'released',
      releasedAt: now,
      releaseReason: input.reason || 'dispatch_reconcile',
      releaseAuditId: auditId,
    },
    timeline: [
      ...(Array.isArray(current.timeline) ? current.timeline : []),
      { status: current.status, at: now, changedAt: now, label: 'courier_assignment_released', note: input.reason || 'Assignation libérée', courierId: proposal.courierId, auditId },
    ],
  } as AnyOrder;
  safeWrite(orders);
  return clone(orders[idx]);
}

export function setDemoOrderStatus(input: any, maybeStatus?: any): AnyOrder | null {
  return updateDemoOrderStatus(input, maybeStatus);
}

export function updateDemoStatus(input: any, maybeStatus?: any): AnyOrder | null {
  return updateDemoOrderStatus(input, maybeStatus);
}

export function getDemoOrderById(input: any): AnyOrder | null {
  return getDemoOrder(input);
}

export function listOrders(filter?: any): AnyOrder[] {
  return listDemoOrders(filter);
}

export function createOrder(input: any = {}): AnyOrder {
  return createDemoOrder(input);
}

export function updateOrderStatus(input: any, maybeStatus?: any): AnyOrder | null {
  return updateDemoOrderStatus(input, maybeStatus);
}

export function reset(): AnyOrder[] {
  return resetDemoOrders();
}

export function list(filter?: any): AnyOrder[] {
  return listDemoOrders(filter);
}

export function create(input?: any): AnyOrder {
  return createDemoOrder(input);
}

export function get(input: any): AnyOrder | null {
  return getDemoOrder(input);
}

export function status(input: any, maybeStatus?: any): AnyOrder | null {
  return updateDemoOrderStatus(input, maybeStatus);
}
