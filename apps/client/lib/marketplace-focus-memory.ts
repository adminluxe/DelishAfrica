export type MarketplaceFocusMemory = {
  query: string;
  country: string;
  city: string;
  cuisine: string;
  ambientIndex: number;
  signatureIndex: number;
  scrollY: number;
  updatedAt: number;
};

const DEFAULT_FOCUS: MarketplaceFocusMemory = {
  query: "",
  country: "Tous",
  city: "Toutes",
  cuisine: "Tout",
  ambientIndex: 0,
  signatureIndex: 0,
  scrollY: 0,
  updatedAt: 0,
};

type FocusRoot = typeof globalThis & {
  __DELISHAFRICA_MARKETPLACE_FOCUS_V1__?: MarketplaceFocusMemory;
};

function root(): FocusRoot {
  return globalThis as FocusRoot;
}

function cleanText(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function cleanIndex(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function cleanScroll(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.min(number, 20000) : 0;
}

export function readMarketplaceFocus(): MarketplaceFocusMemory {
  const current = root().__DELISHAFRICA_MARKETPLACE_FOCUS_V1__;
  if (!current) return { ...DEFAULT_FOCUS };
  return {
    query: String(current.query || ""),
    country: cleanText(current.country, "Tous"),
    city: cleanText(current.city, "Toutes"),
    cuisine: cleanText(current.cuisine, "Tout"),
    ambientIndex: cleanIndex(current.ambientIndex),
    signatureIndex: cleanIndex(current.signatureIndex),
    scrollY: cleanScroll(current.scrollY),
    updatedAt: cleanIndex(current.updatedAt),
  };
}

export function writeMarketplaceFocus(patch: Partial<MarketplaceFocusMemory>): MarketplaceFocusMemory {
  const next = {
    ...readMarketplaceFocus(),
    ...patch,
    updatedAt: Date.now(),
  };
  root().__DELISHAFRICA_MARKETPLACE_FOCUS_V1__ = {
    query: String(next.query || ""),
    country: cleanText(next.country, "Tous"),
    city: cleanText(next.city, "Toutes"),
    cuisine: cleanText(next.cuisine, "Tout"),
    ambientIndex: cleanIndex(next.ambientIndex),
    signatureIndex: cleanIndex(next.signatureIndex),
    scrollY: cleanScroll(next.scrollY),
    updatedAt: next.updatedAt,
  };
  return readMarketplaceFocus();
}

export function clearMarketplaceFocus(): void {
  root().__DELISHAFRICA_MARKETPLACE_FOCUS_V1__ = { ...DEFAULT_FOCUS };
}
