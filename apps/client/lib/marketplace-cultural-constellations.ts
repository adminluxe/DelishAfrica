import {
  MARKETPLACE_DISCOVERY_SIGNALS,
  type MarketplaceDiscoverySignal,
  type MarketplaceRadarEntry,
} from "./marketplace-discovery-engine";
import {
  buildMarketplaceLaunchPassports,
  type MarketplaceLaunchPassport,
} from "./marketplace-launch-passport";
import type { MarketplaceLivePartner } from "./marketplace-opportunity-graph";

export type CulturalConstellationState = "LIVE" | "READY" | "RISING" | "WATCH";

export type CulturalConstellationCityStop = {
  id: string;
  city: string;
  country: string;
  countryCode: string;
  readinessScore: number;
  state: MarketplaceLaunchPassport["state"];
  stateLabel: string;
  discoveryCount: number;
  officialSourceCount: number;
  activePartnerCount: number;
};

export type MarketplaceCulturalConstellation = {
  id: string;
  name: string;
  kicker: string;
  origin: string;
  narrative: string;
  routeCode: string;
  state: CulturalConstellationState;
  stateLabel: string;
  readinessScore: number;
  entries: MarketplaceDiscoverySignal[];
  cityStops: CulturalConstellationCityStop[];
  cuisines: string[];
  countries: string[];
  discoveryCount: number;
  cityCount: number;
  countryCount: number;
  officialSourceCount: number;
  activePartnerCount: number;
  bridge: string;
  nextMove: string;
  truth: string;
};

type ConstellationBlueprint = {
  id: string;
  name: string;
  kicker: string;
  origin: string;
  narrative: string;
  keywords: string[];
  matchAll?: boolean;
  rank: number;
};

const BLUEPRINTS: ConstellationBlueprint[] = [
  {
    id: "ouest-atlantique",
    name: "Ouest Atlantique",
    kicker: "DAKAR · ABIDJAN · CONAKRY · LAGOS",
    origin: "Afrique de l’Ouest",
    narrative: "Une route de riz, de braise, de sauces et de street culture qui relie les capitales africaines aux grandes villes de la diaspora.",
    keywords: ["sénégal", "senegal", "ivoir", "guiné", "guine", "nigéri", "nigeri", "ghana", "afrique de l’ouest", "afrique de l'ouest", "jollof", "yassa", "thieb", "mafé", "mafe"],
    rank: 1,
  },
  {
    id: "bassin-congo",
    name: "Bassin Congo",
    kicker: "KINSHASA · DOUALA · BRUXELLES · PARIS",
    origin: "Afrique centrale",
    narrative: "Des cuisines généreuses, profondes et familiales qui traversent le bassin du Congo pour former une diaspora culinaire puissante.",
    keywords: ["congol", "cameroun", "afrique centrale", "bantou", "kinshasa", "douala"],
    rank: 2,
  },
  {
    id: "corne-grands-lacs",
    name: "Corne & Grands Lacs",
    kicker: "ADDIS · KIGALI · NAIROBI · LONDRES",
    origin: "Afrique de l’Est",
    narrative: "Injera, épices, cafés, grillades et tables de partage dessinent une constellation de l’Est africain encore trop peu reliée.",
    keywords: ["éthiop", "ethiop", "érythr", "erythr", "rwand", "tanzan", "kenya", "afrique de l’est", "afrique de l'est", "grands lacs", "corne"],
    rank: 3,
  },
  {
    id: "braise-rue",
    name: "Braise & Rue",
    kicker: "LE FEU COMME LANGAGE COMMUN",
    origin: "Street culture africaine",
    narrative: "Brochettes, grillades, braisés et comptoirs de nuit : la route la plus immédiate entre l’énergie des villes et l’envie de commander.",
    keywords: ["grillade", "braise", "braisé", "street food", "barbecue", "brochette"],
    rank: 4,
  },
  {
    id: "tables-nouvelles",
    name: "Tables Nouvelles",
    kicker: "L’AFRIQUE CONTEMPORAINE À TABLE",
    origin: "Création panafricaine",
    narrative: "Des signatures métissées et contemporaines qui réécrivent les codes sans effacer les héritages.",
    keywords: ["fusion", "contemporain", "gastronom", "métiss", "metiss", "création", "creation"],
    rank: 5,
  },
  {
    id: "grand-atlas",
    name: "Grand Atlas Africain",
    kicker: "TOUTES LES ROUTES · UN SEUL RÉSEAU",
    origin: "Afrique & diasporas",
    narrative: "La vue d’ensemble du réseau : chaque ville, chaque source et chaque partenaire actif racontent une partie du même continent culinaire.",
    keywords: [],
    matchAll: true,
    rank: 99,
  },
];

function normalized(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function entryText(entry: MarketplaceRadarEntry): string {
  return normalized([
    entry.name,
    entry.city,
    entry.country,
    entry.cuisine,
    ...entry.cuisines,
    ...entry.tags,
    entry.description,
  ].join(" "));
}

function matchesBlueprint(entry: MarketplaceRadarEntry, blueprint: ConstellationBlueprint): boolean {
  if (blueprint.matchAll) return true;
  const text = entryText(entry);
  return blueprint.keywords.some((keyword) => text.includes(normalized(keyword)));
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

function partnerText(partner: MarketplaceLivePartner): string {
  return normalized([
    partner.name,
    partner.city,
    partner.area,
    partner.country,
    partner.cuisine,
    ...(partner.cuisines || []),
  ].join(" "));
}

function partnerMatches(partner: MarketplaceLivePartner, blueprint: ConstellationBlueprint): boolean {
  if (!activePartner(partner)) return false;
  if (blueprint.matchAll) return true;
  const text = partnerText(partner);
  return blueprint.keywords.some((keyword) => text.includes(normalized(keyword)));
}

function routeScore(
  entries: MarketplaceDiscoverySignal[],
  cityCount: number,
  countryCount: number,
  cuisineCount: number,
  officialCount: number,
  activeCount: number,
): number {
  const trust = officialCount / Math.max(entries.length, 1);
  const coverage = Math.min(30, entries.length * 3.2);
  const geography = Math.min(22, cityCount * 3.2 + countryCount * 2.4);
  const evidence = trust * 24;
  const diversity = Math.min(12, cuisineCount * 1.4);
  const live = Math.min(18, activeCount * 9);
  return Math.max(0, Math.min(100, Math.round(coverage + geography + evidence + diversity + live)));
}

function routeState(score: number, activeCount: number): CulturalConstellationState {
  if (activeCount > 0) return "LIVE";
  if (score >= 72) return "READY";
  if (score >= 50) return "RISING";
  return "WATCH";
}

function stateLabel(state: CulturalConstellationState): string {
  if (state === "LIVE") return "Route déjà vivante";
  if (state === "READY") return "Route prête à s’officialiser";
  if (state === "RISING") return "Route en accélération";
  return "Route en observation";
}

function nextMove(state: CulturalConstellationState, officialCount: number): string {
  if (state === "LIVE") return "Densifier la route avec de nouvelles villes et davantage de diversité active.";
  if (state === "READY") return "Lancer une vague coordonnée d’officialisation sur les escales les mieux documentées.";
  if (state === "RISING") return officialCount > 0
    ? "Relier les meilleures preuves officielles à un premier partenaire signature."
    : "Renforcer les preuves officielles avant toute approche commerciale.";
  return "Continuer la cartographie et attendre un signal suffisamment solide.";
}

function bridgeOf(stops: CulturalConstellationCityStop[]): string {
  return stops.slice(0, 4).map((stop) => stop.city).join(" → ") || "Une route reste à tracer";
}

function routeCode(blueprint: ConstellationBlueprint, cityCount: number, countryCount: number, score: number): string {
  const prefix = blueprint.id.split("-").map((part) => part.slice(0, 2)).join("").toUpperCase().slice(0, 6);
  return `${prefix}-${countryCount}P-${cityCount}V-${score}`;
}

export function buildMarketplaceCulturalConstellations(
  livePartners: MarketplaceLivePartner[] = [],
): MarketplaceCulturalConstellation[] {
  const passports = buildMarketplaceLaunchPassports(livePartners);

  return BLUEPRINTS.map((blueprint) => {
    const entries = MARKETPLACE_DISCOVERY_SIGNALS.filter((entry) => matchesBlueprint(entry, blueprint));
    const entryCities = new Set(entries.map((entry) => `${entry.countryCode}::${normalized(entry.city)}`));
    const cityStops: CulturalConstellationCityStop[] = passports
      .filter((passport) => entryCities.has(`${passport.countryCode}::${normalized(passport.city)}`))
      .map((passport) => ({
        id: passport.id,
        city: passport.city,
        country: passport.country,
        countryCode: passport.countryCode,
        readinessScore: passport.readinessScore,
        state: passport.state,
        stateLabel: passport.stateLabel,
        discoveryCount: passport.discoveryCount,
        officialSourceCount: passport.officialSourceCount,
        activePartnerCount: passport.activePartnerCount,
      }))
      .sort((a, b) => b.activePartnerCount - a.activePartnerCount || b.readinessScore - a.readinessScore || a.city.localeCompare(b.city, "fr"));

    const cuisines = new Set<string>();
    const countries = new Set<string>();
    entries.forEach((entry) => {
      cuisines.add(entry.cuisine);
      entry.cuisines.forEach((cuisine) => cuisines.add(cuisine));
      countries.add(entry.country);
    });
    const officialSourceCount = entries.filter((entry) => entry.sourceKind === "official").length;
    const activePartnerCount = livePartners.filter((partner) => partnerMatches(partner, blueprint)).length;
    const score = routeScore(entries, cityStops.length, countries.size, cuisines.size, officialSourceCount, activePartnerCount);
    const state = routeState(score, activePartnerCount);

    return {
      id: blueprint.id,
      name: blueprint.name,
      kicker: blueprint.kicker,
      origin: blueprint.origin,
      narrative: blueprint.narrative,
      routeCode: routeCode(blueprint, cityStops.length, countries.size, score),
      state,
      stateLabel: stateLabel(state),
      readinessScore: score,
      entries: [...entries].sort((a, b) => Number(b.sourceKind === "official") - Number(a.sourceKind === "official") || a.name.localeCompare(b.name, "fr")),
      cityStops,
      cuisines: [...cuisines].sort((a, b) => a.localeCompare(b, "fr")),
      countries: [...countries].sort((a, b) => a.localeCompare(b, "fr")),
      discoveryCount: entries.length,
      cityCount: cityStops.length,
      countryCount: countries.size,
      officialSourceCount,
      activePartnerCount,
      bridge: bridgeOf(cityStops),
      nextMove: nextMove(state, officialSourceCount),
      truth: "Cette constellation relie uniquement des signaux publics qualifiés et des partenaires réellement actifs. Elle ne prétend ni mesurer une communauté, ni garantir une disponibilité commerciale.",
      rank: blueprint.rank,
    } as MarketplaceCulturalConstellation & { rank: number };
  })
    .filter((constellation) => constellation.discoveryCount > 0)
    .sort((a, b) => {
      const stateRank: Record<CulturalConstellationState, number> = { LIVE: 4, READY: 3, RISING: 2, WATCH: 1 };
      return Number(a.id === "grand-atlas") - Number(b.id === "grand-atlas") || stateRank[b.state] - stateRank[a.state] || b.readinessScore - a.readinessScore || (a as MarketplaceCulturalConstellation & { rank: number }).rank - (b as MarketplaceCulturalConstellation & { rank: number }).rank;
    })
    .map(({ rank: _rank, ...constellation }) => constellation);
}

export function marketplaceCulturalConstellationById(
  id: string | undefined,
  livePartners: MarketplaceLivePartner[] = [],
): MarketplaceCulturalConstellation | undefined {
  const constellations = buildMarketplaceCulturalConstellations(livePartners);
  return constellations.find((constellation) => constellation.id === String(id || "")) || constellations[0];
}

export function marketplaceCulturalConstellationForEntry(
  entry: MarketplaceRadarEntry,
  livePartners: MarketplaceLivePartner[] = [],
): MarketplaceCulturalConstellation | undefined {
  const constellations = buildMarketplaceCulturalConstellations(livePartners);
  return constellations.find((constellation) => constellation.id !== "grand-atlas" && constellation.entries.some((candidate) => candidate.id === entry.id))
    || constellations.find((constellation) => constellation.id === "grand-atlas")
    || constellations[0];
}
