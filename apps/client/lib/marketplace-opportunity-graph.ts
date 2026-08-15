import {
  MARKETPLACE_DISCOVERY_SIGNALS,
  type MarketplaceDiscoverySignal,
  type MarketplaceRadarEntry,
} from "./marketplace-discovery-engine";

export type MarketplacePulseState = "LIVE" | "READY" | "RISING" | "WATCH";

export type MarketplaceOpportunitySignal = {
  id: string;
  city: string;
  country: string;
  countryCode: string;
  state: MarketplacePulseState;
  stateLabel: string;
  readinessScore: number;
  discoveryCount: number;
  activePartnerCount: number;
  cuisineCount: number;
  officialSourceCount: number;
  directorySourceCount: number;
  editorialSourceCount: number;
  launchWave: number;
  priorityCount: number;
  cuisines: string[];
  entries: MarketplaceDiscoverySignal[];
  nextMove: string;
  truth: string;
};

export type MarketplaceLivePartner = {
  name?: string;
  city?: string;
  area?: string;
  country?: string;
  cuisine?: string;
  cuisines?: string[];
  status?: string;
  menu?: unknown[];
  menuItems?: unknown[];
};

function normalized(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function cityOf(partner: MarketplaceLivePartner): string {
  return String(partner.city || partner.area || "").trim();
}

function activePartner(partner: MarketplaceLivePartner): boolean {
  const status = normalized(partner.status);
  const menu = Array.isArray(partner.menu)
    ? partner.menu
    : Array.isArray(partner.menuItems)
      ? partner.menuItems
      : [];
  return (status === "" || status === "active" || status === "open") && menu.length > 0;
}

function pulseState(score: number, activeCount: number): MarketplacePulseState {
  if (activeCount > 0) return "LIVE";
  if (score >= 72) return "READY";
  if (score >= 52) return "RISING";
  return "WATCH";
}

function stateLabel(state: MarketplacePulseState): string {
  if (state === "LIVE") return "Réseau actif";
  if (state === "READY") return "Prête à être officialisée";
  if (state === "RISING") return "Signal en accélération";
  return "Marché en observation";
}

function nextMove(state: MarketplacePulseState, officialCount: number): string {
  if (state === "LIVE") return "Densifier le réseau et enrichir la diversité.";
  if (state === "READY") return "Ouvrir la vague d’officialisation terrain.";
  if (state === "RISING") return officialCount > 0
    ? "Qualifier les adresses officielles puis lancer l’approche."
    : "Renforcer les preuves publiques avant l’approche.";
  return "Continuer la veille et consolider les signaux fiables.";
}

function scoreFor(
  entries: MarketplaceDiscoverySignal[],
  activeCount: number,
): number {
  const discoveryCount = entries.length;
  const officialCount = entries.filter((entry) => entry.sourceKind === "official").length;
  const directoryCount = entries.filter((entry) => entry.sourceKind === "directory").length;
  const editorialCount = entries.filter((entry) => entry.sourceKind === "editorial").length;
  const cuisines = new Set<string>();
  entries.forEach((entry) => {
    cuisines.add(entry.cuisine);
    entry.cuisines.forEach((cuisine) => cuisines.add(cuisine));
  });
  const sourceTotal = Math.max(discoveryCount, 1);
  const trustRatio = (
    officialCount * 1 +
    directoryCount * 0.68 +
    editorialCount * 0.45
  ) / sourceTotal;
  const wave = Math.min(...entries.map((entry) => entry.launchWave));
  const priorityShare = entries.filter((entry) => entry.priority === "launch").length / sourceTotal;

  const coverage = Math.min(34, discoveryCount * 4.2);
  const trust = trustRatio * 24;
  const diversity = Math.min(18, cuisines.size * 2.6);
  const waveReadiness = wave <= 1 ? 12 : wave === 2 ? 8 : 4;
  const priority = priorityShare * 8;
  const liveBoost = Math.min(18, activeCount * 12);

  return Math.max(0, Math.min(100, Math.round(coverage + trust + diversity + waveReadiness + priority + liveBoost)));
}

export function buildMarketplaceOpportunityGraph(
  livePartners: MarketplaceLivePartner[] = [],
): MarketplaceOpportunitySignal[] {
  const groups = new Map<string, MarketplaceDiscoverySignal[]>();
  for (const entry of MARKETPLACE_DISCOVERY_SIGNALS) {
    const key = `${entry.countryCode}::${normalized(entry.city)}`;
    const current = groups.get(key) || [];
    current.push(entry);
    groups.set(key, current);
  }

  const graph: MarketplaceOpportunitySignal[] = [];
  for (const [key, entries] of groups.entries()) {
    const first = entries[0];
    const activeCount = livePartners.filter((partner) =>
      activePartner(partner) &&
      normalized(cityOf(partner)) === normalized(first.city) &&
      normalized(partner.country) === normalized(first.country),
    ).length;
    const cuisines = new Set<string>();
    entries.forEach((entry) => {
      cuisines.add(entry.cuisine);
      entry.cuisines.forEach((cuisine) => cuisines.add(cuisine));
    });
    const officialCount = entries.filter((entry) => entry.sourceKind === "official").length;
    const directoryCount = entries.filter((entry) => entry.sourceKind === "directory").length;
    const editorialCount = entries.filter((entry) => entry.sourceKind === "editorial").length;
    const score = scoreFor(entries, activeCount);
    const state = pulseState(score, activeCount);

    graph.push({
      id: key,
      city: first.city,
      country: first.country,
      countryCode: first.countryCode,
      state,
      stateLabel: stateLabel(state),
      readinessScore: score,
      discoveryCount: entries.length,
      activePartnerCount: activeCount,
      cuisineCount: cuisines.size,
      officialSourceCount: officialCount,
      directorySourceCount: directoryCount,
      editorialSourceCount: editorialCount,
      launchWave: Math.min(...entries.map((entry) => entry.launchWave)),
      priorityCount: entries.filter((entry) => entry.priority === "launch").length,
      cuisines: [...cuisines].sort((a, b) => a.localeCompare(b, "fr")),
      entries: [...entries].sort((a, b) => Number(b.sourceKind === "official") - Number(a.sourceKind === "official") || a.name.localeCompare(b.name, "fr")),
      nextMove: nextMove(state, officialCount),
      truth: "Indice de préparation calculé uniquement à partir de la couverture, de la diversité, de la qualité des sources, de la vague de lancement et des partenaires réellement actifs.",
    });
  }

  const stateRank: Record<MarketplacePulseState, number> = { LIVE: 4, READY: 3, RISING: 2, WATCH: 1 };
  return graph.sort((a, b) =>
    stateRank[b.state] - stateRank[a.state] ||
    b.readinessScore - a.readinessScore ||
    b.discoveryCount - a.discoveryCount ||
    a.city.localeCompare(b.city, "fr"),
  );
}

export function marketplacePulseForEntry(
  entry: MarketplaceRadarEntry,
): MarketplaceOpportunitySignal | undefined {
  return buildMarketplaceOpportunityGraph().find((signal) =>
    signal.countryCode === entry.countryCode && normalized(signal.city) === normalized(entry.city),
  );
}
