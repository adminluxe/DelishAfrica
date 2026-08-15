import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DARestaurantCartContext } from "./daRestaurantCatalog";

export type DACartItem = {
id: string;
sku?: string;
name: string;
category?: string;
description?: string;
quantity: number;
unitPrice: number;
};

export type DACartState = {
restaurantId: string;
restaurantSlug: string;
restaurantName: string;
minimumOrderAmount: number;
serviceAreaLabel: string;
items: DACartItem[];
subtotal: number;
deliveryFee: number;
total: number;
};

type DAPersistedCartV1 = {
version: 1;
updatedAt: string;
cart: DACartState;
};

export const DEFAULT_CART_RESTAURANT: DARestaurantCartContext = {
restaurantId: "thieyp",
restaurantSlug: "thieyp",
restaurantName: "Thieyp",
minimumOrderAmount: 0,
serviceAreaLabel: "Bruxelles / Ixelles",
};

const CART_STORAGE_KEY = "@delishafrica/client/cart/v1";
const CART_STORAGE_VERSION = 1 as const;

let cartState: DACartState = createEmptyCart(DEFAULT_CART_RESTAURANT);
let hydrationPromise: Promise<DACartState> | null = null;
let persistenceQueue: Promise<void> = Promise.resolve();

function cloneItem(item: DACartItem): DACartItem {
return { ...item };
}

function normalizeRestaurant(input?: Partial<DARestaurantCartContext> | null): DARestaurantCartContext {
const restaurantSlug = String(input?.restaurantSlug || input?.restaurantId || DEFAULT_CART_RESTAURANT.restaurantSlug);
return {
restaurantId: String(input?.restaurantId || restaurantSlug),
restaurantSlug,
restaurantName: String(input?.restaurantName || DEFAULT_CART_RESTAURANT.restaurantName),
minimumOrderAmount: Number(input?.minimumOrderAmount || 0),
serviceAreaLabel: String(input?.serviceAreaLabel || DEFAULT_CART_RESTAURANT.serviceAreaLabel),
};
}

function createEmptyCart(restaurant?: Partial<DARestaurantCartContext> | null): DACartState {
const normalized = normalizeRestaurant(restaurant);
return {
restaurantId: normalized.restaurantId,
restaurantSlug: normalized.restaurantSlug,
restaurantName: normalized.restaurantName,
minimumOrderAmount: normalized.minimumOrderAmount,
serviceAreaLabel: normalized.serviceAreaLabel,
items: [],
subtotal: 0,
deliveryFee: 0,
total: 0,
};
}

function recalculate(cart: DACartState): DACartState {
const items = cart.items
.filter((item) => item.quantity > 0)
.map((item) => ({
...item,
quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
unitPrice: Math.max(0, Math.round(Number(item.unitPrice) || 0)),
}));

const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
const deliveryFee = cart.deliveryFee || 0;

return {
...cart,
items,
subtotal,
deliveryFee,
total: subtotal + deliveryFee,
};
}

function sameRestaurant(a: DACartState, b: DARestaurantCartContext): boolean {
return (a.restaurantSlug || a.restaurantId) === (b.restaurantSlug || b.restaurantId);
}

function ensureRestaurant(restaurant?: Partial<DARestaurantCartContext> | null): DARestaurantCartContext {
const next = normalizeRestaurant(restaurant);
if (cartState.items.length === 0) {
cartState = recalculate({
...cartState,
restaurantId: next.restaurantId,
restaurantSlug: next.restaurantSlug,
restaurantName: next.restaurantName,
minimumOrderAmount: next.minimumOrderAmount,
serviceAreaLabel: next.serviceAreaLabel,
});
return next;
}

if (!sameRestaurant(cartState, next)) {
const err = new Error(
`Votre panier contient déjà des plats de ${cartState.restaurantName}. Vider le panier et commencer chez ${next.restaurantName} ?`,
) as Error & { code?: string; currentRestaurantName?: string; nextRestaurantName?: string };
err.code = "DA_CART_RESTAURANT_MISMATCH";
err.currentRestaurantName = cartState.restaurantName;
err.nextRestaurantName = next.restaurantName;
throw err;
}

return next;
}

function sanitizePersistedItem(input: unknown): DACartItem | null {
if (!input || typeof input !== "object") return null;
const value = input as Record<string, unknown>;
const id = String(value.id || value.sku || value.name || "").trim();
const name = String(value.name || "").trim();
if (!id || !name) return null;
const quantity = Math.max(0, Math.round(Number(value.quantity) || 0));
if (quantity <= 0) return null;
return {
id,
sku: value.sku == null ? undefined : String(value.sku),
name,
category: value.category == null ? undefined : String(value.category),
description: value.description == null ? undefined : String(value.description),
quantity,
unitPrice: Math.max(0, Math.round(Number(value.unitPrice) || 0)),
};
}

function sanitizePersistedCart(input: unknown): DACartState | null {
if (!input || typeof input !== "object") return null;
const envelope = input as Partial<DAPersistedCartV1> & { cart?: unknown; version?: unknown };
if (Number(envelope.version) !== CART_STORAGE_VERSION || !envelope.cart || typeof envelope.cart !== "object") {
return null;
}

const raw = envelope.cart as Record<string, unknown>;
const restaurant = normalizeRestaurant({
restaurantId: String(raw.restaurantId || raw.restaurantSlug || DEFAULT_CART_RESTAURANT.restaurantId),
restaurantSlug: String(raw.restaurantSlug || raw.restaurantId || DEFAULT_CART_RESTAURANT.restaurantSlug),
restaurantName: String(raw.restaurantName || DEFAULT_CART_RESTAURANT.restaurantName),
minimumOrderAmount: Math.max(0, Math.round(Number(raw.minimumOrderAmount) || 0)),
serviceAreaLabel: String(raw.serviceAreaLabel || DEFAULT_CART_RESTAURANT.serviceAreaLabel),
});
const items = Array.isArray(raw.items)
? raw.items.map(sanitizePersistedItem).filter((item): item is DACartItem => Boolean(item))
: [];

return recalculate({
...createEmptyCart(restaurant),
items,
deliveryFee: Math.max(0, Math.round(Number(raw.deliveryFee) || 0)),
});
}

function persistedEnvelope(snapshot: DACartState): DAPersistedCartV1 {
return {
version: CART_STORAGE_VERSION,
updatedAt: new Date().toISOString(),
cart: snapshot,
};
}

function schedulePersist(): void {
const snapshot = getCartSnapshot();
const serialized = JSON.stringify(persistedEnvelope(snapshot));
persistenceQueue = persistenceQueue
.catch(() => undefined)
.then(() => AsyncStorage.setItem(CART_STORAGE_KEY, serialized))
.catch(() => undefined);
}

export function getCartSnapshot(): DACartState {
return {
...cartState,
items: cartState.items.map(cloneItem),
};
}

export function hydrateCartFromStorage(): Promise<DACartState> {
if (hydrationPromise) return hydrationPromise;

hydrationPromise = (async () => {
try {
const serialized = await AsyncStorage.getItem(CART_STORAGE_KEY);
if (!serialized) return getCartSnapshot();
const restored = sanitizePersistedCart(JSON.parse(serialized));
if (!restored) {
await AsyncStorage.removeItem(CART_STORAGE_KEY).catch(() => undefined);
return getCartSnapshot();
}
cartState = restored;
return getCartSnapshot();
} catch {
return getCartSnapshot();
}
})();

return hydrationPromise;
}

export function waitForCartPersistence(): Promise<void> {
return persistenceQueue.catch(() => undefined);
}

export function clearCart(restaurant?: Partial<DARestaurantCartContext> | null): DACartState {
cartState = createEmptyCart(restaurant || {
restaurantId: cartState.restaurantId,
restaurantSlug: cartState.restaurantSlug,
restaurantName: cartState.restaurantName,
minimumOrderAmount: cartState.minimumOrderAmount,
serviceAreaLabel: cartState.serviceAreaLabel,
});
schedulePersist();
return getCartSnapshot();
}

export function setCartRestaurant(restaurant: Partial<DARestaurantCartContext>): DACartState {
const next = normalizeRestaurant(restaurant);
if (cartState.items.length > 0 && !sameRestaurant(cartState, next)) {
throw new Error(`Le panier est déjà lié à ${cartState.restaurantName}.`);
}
cartState = recalculate({
...cartState,
restaurantId: next.restaurantId,
restaurantSlug: next.restaurantSlug,
restaurantName: next.restaurantName,
minimumOrderAmount: next.minimumOrderAmount,
serviceAreaLabel: next.serviceAreaLabel,
});
schedulePersist();
return getCartSnapshot();
}

export function canAddRestaurant(restaurant: Partial<DARestaurantCartContext>): { ok: boolean; message?: string } {
const next = normalizeRestaurant(restaurant);
if (cartState.items.length === 0 || sameRestaurant(cartState, next)) return { ok: true };
return {
ok: false,
message: `Votre panier contient déjà des plats de ${cartState.restaurantName}. Vider le panier et commencer chez ${next.restaurantName} ?`,
};
}

export function addToCart(
item: Omit<DACartItem, "quantity"> & { quantity?: number },
restaurant?: Partial<DARestaurantCartContext> | null,
): DACartState {
ensureRestaurant(restaurant);
const id = String(item.id || item.sku || item.name);
const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) || 0));
const existing = cartState.items.find((entry) => entry.id === id);

if (existing) {
existing.quantity += quantity;
} else {
cartState.items.push({
id,
sku: item.sku,
name: String(item.name || "Article DelishAfrica"),
category: item.category,
description: item.description,
quantity,
unitPrice,
});
}

cartState = recalculate(cartState);
schedulePersist();
return getCartSnapshot();
}

export const addCartItem = addToCart;

export function removeFromCart(itemId: string): DACartState {
cartState.items = cartState.items.filter((item) => item.id !== itemId);
cartState = recalculate(cartState);
schedulePersist();
return getCartSnapshot();
}

export const removeCartItem = removeFromCart;

export function incrementCartItem(itemId: string): DACartState {
const item = cartState.items.find((entry) => entry.id === itemId);
if (item) item.quantity += 1;
cartState = recalculate(cartState);
schedulePersist();
return getCartSnapshot();
}

export function decrementCartItem(itemId: string): DACartState {
const item = cartState.items.find((entry) => entry.id === itemId);
if (item) item.quantity -= 1;
cartState = recalculate(cartState);
schedulePersist();
return getCartSnapshot();
}

export function updateCartItemQuantity(itemId: string, quantity: number): DACartState {
const item = cartState.items.find((entry) => entry.id === itemId);
if (item) item.quantity = Math.max(0, Math.round(Number(quantity) || 0));
cartState = recalculate(cartState);
schedulePersist();
return getCartSnapshot();
}

export function formatCartEuro(cents: number): string {
const value = Number.isFinite(cents) ? cents : 0;
return `${(value / 100).toFixed(2).replace(".", ",")} €`;
}

export function cartItemSummary(cart: DACartState): string {
const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
if (count === 0) return `Panier vide · ${cart.restaurantName}`;
return `${count} article${count > 1 ? "s" : ""} · ${formatCartEuro(cart.total)}`;
}
