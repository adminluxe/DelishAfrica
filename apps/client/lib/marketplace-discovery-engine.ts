import {
  GLOBAL_MARKETPLACE_CATALOG,
  marketplaceRadarById,
  type MarketplaceRadarEntry,
  type MarketplaceSourceKind,
  type MarketplacePriority,
  type MarketplaceAvailability,
} from "./global-marketplace-catalog";

export type DiscoveryLifecycle = "detected" | "qualified" | "review" | "official" | "rejected";
export type DiscoveryConfidence = "high" | "medium" | "low";

export type MarketplaceDiscoverySignal = MarketplaceRadarEntry & {
  lifecycle: DiscoveryLifecycle;
  confidence: DiscoveryConfidence;
  orderable: false;
  requiresHumanValidation: true;
};

function confidenceOf(entry: MarketplaceRadarEntry): DiscoveryConfidence {
  if (entry.sourceKind === "official") return "high";
  if (entry.sourceKind === "directory") return "medium";
  return "low";
}

export const MARKETPLACE_DISCOVERY_ENGINE_VERSION = "4.0.0";

export const MARKETPLACE_DISCOVERY_SIGNALS: MarketplaceDiscoverySignal[] =
  GLOBAL_MARKETPLACE_CATALOG.map((entry) => ({
    ...entry,
    lifecycle: entry.sourceKind === "official" ? "qualified" : "detected",
    confidence: confidenceOf(entry),
    orderable: false,
    requiresHumanValidation: true,
  }));

export const GLOBAL_MARKETPLACE_CATALOG_COMPAT = GLOBAL_MARKETPLACE_CATALOG;
export { GLOBAL_MARKETPLACE_CATALOG, marketplaceRadarById };
export type { MarketplaceRadarEntry, MarketplaceSourceKind, MarketplacePriority, MarketplaceAvailability };

export function marketplaceDiscoveryById(id: string | undefined): MarketplaceDiscoverySignal | undefined {
  return MARKETPLACE_DISCOVERY_SIGNALS.find((entry) => entry.id === String(id || ""));
}

export function discoveryMarkets(): Array<{ country: string; countryCode: string; cities: string[]; signals: number }> {
  const markets = new Map<string, { country: string; countryCode: string; cities: Set<string>; signals: number }>();
  for (const entry of MARKETPLACE_DISCOVERY_SIGNALS) {
    const current = markets.get(entry.countryCode) || { country: entry.country, countryCode: entry.countryCode, cities: new Set<string>(), signals: 0 };
    current.cities.add(entry.city);
    current.signals += 1;
    markets.set(entry.countryCode, current);
  }
  return [...markets.values()].map((market) => ({ ...market, cities: [...market.cities].sort() }));
}
