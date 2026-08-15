import {
  buildMarketplaceOpportunityGraph,
  type MarketplaceLivePartner,
  type MarketplaceOpportunitySignal,
} from "./marketplace-opportunity-graph";

export type MarketplaceLaunchPhaseState = "COMPLETE" | "ACTIVE" | "NEXT" | "LOCKED";

export type MarketplaceLaunchPhase = {
  id: "map" | "qualify" | "officialize" | "open";
  label: string;
  detail: string;
  state: MarketplaceLaunchPhaseState;
};

export type MarketplaceLaunchPassport = {
  id: string;
  city: string;
  country: string;
  countryCode: string;
  launchCode: string;
  state: MarketplaceOpportunitySignal["state"];
  stateLabel: string;
  readinessScore: number;
  evidenceStrength: "FORTE" | "ÉTABLIE" | "ÉMERGENTE";
  headline: string;
  signature: string;
  firstMove: string;
  missingPiece: string;
  cuisines: string[];
  entries: MarketplaceOpportunitySignal["entries"];
  discoveryCount: number;
  officialSourceCount: number;
  activePartnerCount: number;
  phases: MarketplaceLaunchPhase[];
  truth: string;
};

function slug(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function evidenceStrength(signal: MarketplaceOpportunitySignal): MarketplaceLaunchPassport["evidenceStrength"] {
  const ratio = signal.officialSourceCount / Math.max(signal.discoveryCount, 1);
  if (signal.officialSourceCount >= 3 || ratio >= 0.55) return "FORTE";
  if (signal.officialSourceCount >= 1 || signal.discoveryCount >= 4) return "ÉTABLIE";
  return "ÉMERGENTE";
}

function headline(signal: MarketplaceOpportunitySignal): string {
  if (signal.state === "LIVE") return `${signal.city} est déjà reliée. Le prochain enjeu est la densité.`;
  if (signal.state === "READY") return `${signal.city} a assez de preuves pour ouvrir une vague terrain.`;
  if (signal.state === "RISING") return `${signal.city} se structure. Une officialisation peut changer l’échelle.`;
  return `${signal.city} est visible. Le réseau attend encore ses preuves décisives.`;
}

function firstMove(signal: MarketplaceOpportunitySignal): string {
  if (signal.state === "LIVE") return "Renforcer la diversité, les horaires et la couverture locale.";
  if (signal.state === "READY") return "Contacter les adresses officielles et ouvrir les premiers profils maîtrisés.";
  if (signal.state === "RISING") return "Qualifier les sources officielles puis concentrer l’approche sur une adresse signature.";
  return "Consolider la cartographie publique avant toute promesse d’ouverture.";
}

function missingPiece(signal: MarketplaceOpportunitySignal): string {
  if (signal.activePartnerCount > 0 && signal.cuisineCount < 4) return "Davantage de diversité culinaire active.";
  if (signal.activePartnerCount === 0 && signal.officialSourceCount >= 2) return "Le premier partenaire officiellement relié.";
  if (signal.officialSourceCount === 0) return "Une preuve officielle directement attribuable aux établissements.";
  if (signal.discoveryCount < 4) return "Une couverture plus large de la ville.";
  return "La validation humaine des adresses prioritaires.";
}

function phases(signal: MarketplaceOpportunitySignal): MarketplaceLaunchPhase[] {
  const mapped = signal.discoveryCount > 0;
  const qualified = signal.officialSourceCount > 0 || signal.discoveryCount >= 4;
  const officialized = signal.activePartnerCount > 0;
  const open = signal.state === "LIVE";
  return [
    {
      id: "map",
      label: "Cartographier",
      detail: `${signal.discoveryCount} présence${signal.discoveryCount > 1 ? "s" : ""} publique${signal.discoveryCount > 1 ? "s" : ""} repérée${signal.discoveryCount > 1 ? "s" : ""}.`,
      state: mapped ? "COMPLETE" : "ACTIVE",
    },
    {
      id: "qualify",
      label: "Qualifier",
      detail: `${signal.officialSourceCount} source${signal.officialSourceCount > 1 ? "s" : ""} officielle${signal.officialSourceCount > 1 ? "s" : ""} exploitable${signal.officialSourceCount > 1 ? "s" : ""}.`,
      state: qualified ? "COMPLETE" : mapped ? "ACTIVE" : "NEXT",
    },
    {
      id: "officialize",
      label: "Officialiser",
      detail: officialized ? `${signal.activePartnerCount} partenaire${signal.activePartnerCount > 1 ? "s" : ""} actif${signal.activePartnerCount > 1 ? "s" : ""}.` : "Premier établissement à relier au réseau.",
      state: officialized ? "COMPLETE" : qualified ? "ACTIVE" : "NEXT",
    },
    {
      id: "open",
      label: "Ouvrir",
      detail: open ? "La ville est déjà accessible dans le réseau actif." : "Ouverture progressive après validation terrain.",
      state: open ? "COMPLETE" : officialized ? "ACTIVE" : "LOCKED",
    },
  ];
}

export function buildMarketplaceLaunchPassports(
  livePartners: MarketplaceLivePartner[] = [],
): MarketplaceLaunchPassport[] {
  return buildMarketplaceOpportunityGraph(livePartners).map((signal) => ({
    id: signal.id,
    city: signal.city,
    country: signal.country,
    countryCode: signal.countryCode,
    launchCode: `${signal.countryCode}-${slug(signal.city)}-${signal.readinessScore}`.toUpperCase(),
    state: signal.state,
    stateLabel: signal.stateLabel,
    readinessScore: signal.readinessScore,
    evidenceStrength: evidenceStrength(signal),
    headline: headline(signal),
    signature: signal.cuisines.slice(0, 3).join(" · ") || "Cuisine africaine",
    firstMove: firstMove(signal),
    missingPiece: missingPiece(signal),
    cuisines: signal.cuisines,
    entries: signal.entries,
    discoveryCount: signal.discoveryCount,
    officialSourceCount: signal.officialSourceCount,
    activePartnerCount: signal.activePartnerCount,
    phases: phases(signal),
    truth: "Ce passeport organise des preuves publiques et des partenaires réellement actifs. Il ne représente ni une audience, ni une promesse commerciale, ni une demande agrégée.",
  }));
}

export function marketplaceLaunchPassportForCity(
  city: string | undefined,
  country: string | undefined,
  livePartners: MarketplaceLivePartner[] = [],
): MarketplaceLaunchPassport | undefined {
  const normalizedCity = String(city || "").trim().toLocaleLowerCase("fr");
  const normalizedCountry = String(country || "").trim().toLocaleLowerCase("fr");
  const passports = buildMarketplaceLaunchPassports(livePartners);
  return passports.find((passport) =>
    passport.city.toLocaleLowerCase("fr") === normalizedCity &&
    (!normalizedCountry || passport.country.toLocaleLowerCase("fr") === normalizedCountry),
  ) || passports[0];
}
