export type DAApiMenuItem = {
sku?: string;
id?: string;
name?: string;
category?: string;
day?: string | null;
price?: number;
priceEUR?: number;
amount?: number;
description?: string;
tags?: string[];
};

export type DARestaurant = {
id: string;
slug: string;
name: string;
city: string;
area?: string;
country?: string;
cuisine?: string;
cuisines: string[];
rating?: number;
address?: string;
phone?: string;
email?: string;
website?: string;
description?: string;
descriptionLong?: string;
status: string;
featured: boolean;
acceptingOrders: boolean;
delivery: {
enabled: boolean;
prepTimeMinutes?: number;
serviceAreaLabel?: string;
minimumOrderAmount?: number;
deliveryFee?: number;
deliveryRadiusKm?: number;
};
menuItems: DAApiMenuItem[];
};

export type DARestaurantCartContext = {
restaurantId: string;
restaurantSlug: string;
restaurantName: string;
minimumOrderAmount: number;
serviceAreaLabel: string;
};

const DEFAULT_API_BASE = "https://api.delishafrica.me/api/v1";

function envApiBase(): string {
const raw =
process.env.EXPO_PUBLIC_API_BASE_URL ||
process.env.EXPO_PUBLIC_API_URL ||
DEFAULT_API_BASE;

const base = String(raw).replace(/\/+$/, "");
if (base.endsWith("/api/v1")) return base;
if (base.endsWith("/api")) return `${base}/v1`;
return `${base}/api/v1`;
}

export const DA_API_BASE_URL = envApiBase();

export function slugify(value: unknown): string {
return String(value || "")
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.replace(/&/g, " et ")
.replace(/[^a-z0-9]+/g, "-")
.replace(/^-+|-+$/g, "") || "restaurant";
}

function numberOr(value: unknown, fallback: number): number {
const n = Number(value);
return Number.isFinite(n) ? n : fallback;
}

function centsFromMenuItem(item: DAApiMenuItem): number {
if (typeof item.amount === "number" && item.amount > 0) return Math.round(item.amount);
if (typeof item.priceEUR === "number" && item.priceEUR > 0) return Math.round(item.priceEUR * 100);
if (typeof item.price === "number" && item.price > 0) {
return item.price > 100 ? Math.round(item.price) : Math.round(item.price * 100);
}
return 0;
}

export function menuItemAmount(item: DAApiMenuItem): number {
return centsFromMenuItem(item);
}

export function menuItemId(item: DAApiMenuItem, index = 0): string {
return String(item.sku || item.id || `${slugify(item.name)}-${index}`);
}

export function normalizeMenuItem(item: DAApiMenuItem, index = 0): DAApiMenuItem {
const amount = centsFromMenuItem(item);
return {
...item,
sku: menuItemId(item, index),
id: menuItemId(item, index),
name: String(item.name || "Plat DelishAfrica"),
category: String(item.category || "Menu"),
amount,
priceEUR: amount / 100,
price: amount / 100,
description: String(item.description || ""),
tags: Array.isArray(item.tags) ? item.tags : [],
};
}

export function normalizeRestaurant(raw: any): DARestaurant {
const id = String(raw?.slug || raw?.id || slugify(raw?.name));
const slug = String(raw?.slug || slugify(raw?.name || id));
const delivery = raw?.delivery || {};
const rawMenu = Array.isArray(raw?.menuItems)
? raw.menuItems
: Array.isArray(raw?.menu)
? raw.menu
: [];

const status = String(raw?.status || "placeholder").toLowerCase();
const acceptingOrders =
Boolean(raw?.acceptingOrders) ||
(status === "active" && delivery.enabled !== false && rawMenu.length > 0);

return {
id,
slug,
name: String(raw?.name || "Restaurant DelishAfrica"),
city: String(raw?.city || "Bruxelles"),
area: raw?.area ? String(raw.area) : undefined,
country: raw?.country ? String(raw.country) : "Belgique",
cuisine: raw?.cuisine ? String(raw.cuisine) : undefined,
cuisines: Array.isArray(raw?.cuisines) ? raw.cuisines.map(String) : raw?.cuisine ? [String(raw.cuisine)] : [],
rating: raw?.rating === undefined ? undefined : numberOr(raw.rating, 0),
address: raw?.address ? String(raw.address) : undefined,
phone: raw?.phone ? String(raw.phone) : undefined,
email: raw?.email ? String(raw.email) : undefined,
website: raw?.website ? String(raw.website) : undefined,
description: raw?.description ? String(raw.description) : undefined,
descriptionLong: raw?.descriptionLong ? String(raw.descriptionLong) : undefined,
status,
featured: Boolean(raw?.featured),
acceptingOrders,
delivery: {
enabled: delivery.enabled !== false,
prepTimeMinutes: delivery.prepTimeMinutes === undefined ? undefined : numberOr(delivery.prepTimeMinutes, 20),
serviceAreaLabel: delivery.serviceAreaLabel ? String(delivery.serviceAreaLabel) : "Bruxelles",
minimumOrderAmount: numberOr(delivery.minimumOrderAmount ?? raw?.minimumOrderAmount ?? 0, 0),
deliveryFee: numberOr(delivery.deliveryFee ?? raw?.deliveryFee ?? 0, 0),
deliveryRadiusKm: delivery.deliveryRadiusKm === undefined ? undefined : numberOr(delivery.deliveryRadiusKm, 0),
},
menuItems: rawMenu.map(normalizeMenuItem),
};
}

export function isRestaurantOrderable(restaurant: DARestaurant | null | undefined): boolean {
return Boolean(restaurant && restaurant.status === "active" && restaurant.acceptingOrders);
}

export function restaurantStatusLabel(restaurant: DARestaurant): string {
if (isRestaurantOrderable(restaurant)) return "Ouvert aux commandes";
if (restaurant.status === "placeholder") return "Bientôt disponible";
if (restaurant.status === "coming_soon") return "Bientôt disponible";
if (restaurant.status === "paused") return "Service en pause";
return "En préparation";
}

export function restaurantToCartRestaurant(restaurant: DARestaurant): DARestaurantCartContext {
return {
restaurantId: restaurant.slug || restaurant.id,
restaurantSlug: restaurant.slug || restaurant.id,
restaurantName: restaurant.name,
minimumOrderAmount: restaurant.delivery.minimumOrderAmount || 0,
serviceAreaLabel: restaurant.delivery.serviceAreaLabel || "Bruxelles",
};
}

export async function fetchRestaurants(): Promise<DARestaurant[]> {
const response = await fetch(`${DA_API_BASE_URL}/partners`);
if (!response.ok) {
throw new Error(`Catalogue restaurants indisponible (${response.status})`);
}
const json = await response.json();
const items = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : Array.isArray(json?.data) ? json.data : [];
return items
.map(normalizeRestaurant)
.sort((a, b) => {
if (a.status === "active" && b.status !== "active") return -1;
if (a.status !== "active" && b.status === "active") return 1;
if (a.featured && !b.featured) return -1;
if (!a.featured && b.featured) return 1;
return a.name.localeCompare(b.name);
});
}

export async function fetchRestaurantBySlug(slug: string): Promise<DARestaurant> {
const normalizedSlug = slugify(slug || "thieyp");
const restaurants = await fetchRestaurants();
const found = restaurants.find((restaurant) => restaurant.slug === normalizedSlug || restaurant.id === normalizedSlug);
if (found) return found;

if (normalizedSlug === "thieyp") {
const response = await fetch(`${DA_API_BASE_URL}/partners/thieyp`);
if (response.ok) return normalizeRestaurant(await response.json());
}

throw new Error("Restaurant introuvable dans le catalogue DelishAfrica.");
}

export function formatRestaurantPrice(cents: number): string {
const value = Number.isFinite(cents) ? cents : 0;
return `${(value / 100).toFixed(2).replace(".", ",")} €`;
}
