/**
 * DelishAfrica R4Q - launch-market geographic coverage, not a courier reservation.
 * The marketplace defines the covered city, not an individual restaurant label.
 * A valid geocoded country + locality is REQUIRED; substrings in street addresses
 * are never used to establish geographic eligibility.
 *
 * IMPORTANT: ok=true means "inside a launch market" only. It does NOT promise
 * a courier, a delivery time, a fee quote or authorization to capture payment.
 */
export type DADeliveryZoneInput = {
  address?: string | null;
  city?: string | null;
  countryCode?: string | null;
  postalCode?: string | null;
  adminArea?: string | null;
};

export type DADeliveryZoneResult = {
  ok: boolean;
  status: "ok" | "missing" | "outside";
  title: string;
  message: string;
  zoneLabel: string;
  normalizedCity: string;
  marketKey?: "brussels" | "luxembourg-city" | "paris" | "marseille";
};

type LaunchMarket = {
  key: NonNullable<DADeliveryZoneResult["marketKey"]>;
  label: string;
};

export const DA_LAUNCH_MARKETS_LABEL =
  "Bruxelles-Capitale (19 communes) · Luxembourg-Ville · Paris · Marseille";

export function normalizeZoneText(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// The complete 19 Brussels-Capital municipalities, with language variants.
// Laeken, Haren and Neder-Over-Heembeek are districts of Brussels municipality.
const BRUSSELS_COMMUNES: ReadonlyArray<ReadonlyArray<string>> = [
  ["Anderlecht"],
  ["Auderghem", "Oudergem"],
  ["Berchem-Sainte-Agathe", "Sint-Agatha-Berchem"],
  ["Bruxelles", "Brussels", "Brussel", "Ville de Bruxelles", "Bruxelles-Ville"],
  ["Etterbeek"],
  ["Evere"],
  ["Forest", "Vorst"],
  ["Ganshoren"],
  ["Ixelles", "Elsene"],
  ["Jette"],
  ["Koekelberg"],
  ["Molenbeek-Saint-Jean", "Sint-Jans-Molenbeek", "Molenbeek"],
  ["Saint-Gilles", "Sint-Gillis"],
  ["Saint-Josse-ten-Noode", "Sint-Joost-ten-Node", "Saint-Josse"],
  ["Schaerbeek", "Schaarbeek"],
  ["Uccle", "Ukkel"],
  ["Watermael-Boitsfort", "Watermaal-Bosvoorde"],
  ["Woluwe-Saint-Lambert", "Sint-Lambrechts-Woluwe"],
  ["Woluwe-Saint-Pierre", "Sint-Pieters-Woluwe"],
];

const BRUSSELS_LOCALITIES = new Set(
  [...BRUSSELS_COMMUNES.flat(), "Laeken", "Laken", "Haren", "Neder-Over-Heembeek"]
    .map((value) => normalizeZoneText(value)),
);

const BRUSSELS_POSTCODES = new Set([
  "1000", "1020", "1030", "1040", "1050", "1060", "1070",
  "1080", "1081", "1082", "1083", "1090", "1120", "1130",
  "1140", "1150", "1160", "1170", "1180", "1190", "1200", "1210",
]);

// For Luxembourg-Ville, all 24 official districts are covered by recognizing
// the municipality "Luxembourg" itself (not by searching street/quarter names).
// A country code LU is mandatory, preventing Belgian province false positives.
const LUXEMBOURG_CITY_NAMES = new Set([
  "luxembourg", "luxembourg ville", "ville de luxembourg",
  "luxembourg city", "luxemburg", "stad letzebuerg", "letzebuerg",
]);

const BRUSSELS: LaunchMarket = {
  key: "brussels",
  label: "Bruxelles-Capitale · 19 communes",
};
const LUXEMBOURG_CITY: LaunchMarket = {
  key: "luxembourg-city",
  label: "Luxembourg-Ville · 24 quartiers",
};
const PARIS: LaunchMarket = {
  key: "paris",
  label: "Paris · 20 arrondissements",
};
const MARSEILLE: LaunchMarket = {
  key: "marseille",
  label: "Marseille · 16 arrondissements",
};

function normalizePostcode(value?: string | null): string {
  return String(value || "").toUpperCase().trim().replace(/\s+/g, "").replace(/^L-/, "");
}

function frenchArrondissementCity(city: string, cityName: "paris" | "marseille", max: number): boolean {
  if (city === cityName) return true;
  if (cityName === "paris" && city === "paris centre") return true;
  const suffix = city.startsWith(cityName + " ") ? city.slice(cityName.length + 1) : "";
  const match = /^(0?[1-9]|1\d|20)(?:er|e|eme)?(?: arrondissement)?$/.exec(suffix);
  return Boolean(match && Number(match[1]) >= 1 && Number(match[1]) <= max);
}

function postcodeMatchesMarket(postcode: string, market: LaunchMarket): boolean {
  if (!postcode) return true;
  if (market.key === "brussels") return BRUSSELS_POSTCODES.has(postcode);
  if (market.key === "luxembourg-city") return /^\d{4}$/.test(postcode);
  if (market.key === "paris") {
    if (postcode === "75116") return true;
    const n = Number(postcode);
    return /^75\d{3}$/.test(postcode) && n >= 75001 && n <= 75020;
  }
  const n = Number(postcode);
  return /^13\d{3}$/.test(postcode) && n >= 13001 && n <= 13016;
}

function marketForVerifiedCity(country: string, city: string): LaunchMarket | null {
  if (country === "BE" && BRUSSELS_LOCALITIES.has(city)) return BRUSSELS;
  if (country === "LU" && LUXEMBOURG_CITY_NAMES.has(city)) return LUXEMBOURG_CITY;
  if (country === "FR" && frenchArrondissementCity(city, "paris", 20)) return PARIS;
  if (country === "FR" && frenchArrondissementCity(city, "marseille", 16)) return MARSEILLE;
  return null;
}

/**
 * The former restaurantZoneLabel argument is intentionally retained for
 * backward compatibility. It never grants or restricts market coverage.
 */
export function validateDeliveryZone(
  input?: DADeliveryZoneInput | null,
  _restaurantZoneLabel?: string | null,
): DADeliveryZoneResult {
  const city = normalizeZoneText(input?.city);
  const address = String(input?.address || "").trim();
  const country = String(input?.countryCode || "").trim().toUpperCase();
  const postcode = normalizePostcode(input?.postalCode);
  const common = { normalizedCity: city };

  if (!address || !city || !country) {
    return {
      ...common,
      ok: false,
      status: "missing",
      title: "Adresse vérifiée à compléter",
      message: "Confirmez l'adresse, la ville et le pays via la recherche sécurisée pour vérifier votre couverture DelishAfrica.",
      zoneLabel: DA_LAUNCH_MARKETS_LABEL,
    };
  }

  const market = marketForVerifiedCity(country, city);
  if (!market || !postcodeMatchesMarket(postcode, market)) {
    return {
      ...common,
      ok: false,
      status: "outside",
      title: "Disponibilité à étudier",
      message: "Cette destination est en dehors de nos villes de lancement confirmées, ou ses informations géographiques ne concordent pas. Notre couverture périphérique évoluera avec les coursiers.",
      zoneLabel: DA_LAUNCH_MARKETS_LABEL,
    };
  }

  return {
    ...common,
    ok: true,
    status: "ok",
    title: "Dans la zone DelishAfrica",
    message: `Votre adresse est dans ${market.label}. Une livraison, son délai et ses frais restent soumis à la disponibilité opérationnelle des coursiers.`,
    zoneLabel: market.label,
    marketKey: market.key,
  };
}

export function deliveryZoneSummary(result: DADeliveryZoneResult): string {
  if (result.ok) return `Ville couverte · ${result.zoneLabel} · coursier à confirmer`;
  if (result.status === "missing") return "Adresse géocodée à confirmer";
  return "Disponibilité à étudier · hors villes de lancement";
}

export const DELIVERY_ZONES_V1_LABEL = DA_LAUNCH_MARKETS_LABEL;

/**
 * Customer-facing territory label. An individual restaurant's legacy label
 * never narrows an active marketplace launch region in the new Client UI.
 * This is geography only; dispatch capacity is checked separately.
 */
export function launchCoverageDisplayLabel(
  city?: string | null,
  country?: string | null,
  legacyLabel?: string | null,
): string {
  const countryName = normalizeZoneText(country);
  const code =
    countryName === "be" || countryName === "belgique" || countryName === "belgium" || countryName === "belgie" ? "BE" :
    countryName === "lu" || countryName === "luxembourg" || countryName === "letzebuerg" ? "LU" :
    countryName === "fr" || countryName === "france" ? "FR" : "";
  const market = marketForVerifiedCity(code, normalizeZoneText(city));
  if (market) return market.label + " · selon disponibilité des coursiers";
  return String(legacyLabel || "").trim() || "Couverture DelishAfrica à confirmer";
}
