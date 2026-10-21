export type DADeliveryZoneInput = {
  address?: string | null;
  city?: string | null;
};

export type DADeliveryZoneResult = {
  ok: boolean;
  status: "ok" | "missing" | "outside";
  title: string;
  message: string;
  zoneLabel: string;
  normalizedCity: string;
};

export function normalizeZoneText(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function serviceAreaTokens(value?: string | null): string[] {
  return String(value || "")
    .split(/[\/,;|·]+|\s+et\s+/i)
    .map(normalizeZoneText)
    .filter((token) => token.length >= 3)
    .filter(
      (token) =>
        ![
          "zone",
          "service",
          "livraison",
          "delivery",
          "secteur",
          "area",
          "active",
          "confirmee",
          "confirme",
        ].includes(token),
    );
}

/**
 * Store policy: never infer a delivery territory from a global hard-coded list.
 * Checkout is allowed only when the selected restaurant explicitly exposes a
 * serviceAreaLabel and the confirmed customer address matches one of its
 * declared localities.
 */
export function validateDeliveryZone(
  input?: DADeliveryZoneInput | null,
  restaurantZoneLabel?: string | null,
): DADeliveryZoneResult {
  const city = normalizeZoneText(input?.city);
  const address = normalizeZoneText(input?.address);
  const combined = `${address} ${city}`.trim();
  const zoneLabel = String(restaurantZoneLabel || "").trim();
  const tokens = serviceAreaTokens(zoneLabel);

  if (!zoneLabel || tokens.length === 0) {
    return {
      ok: false,
      status: "missing",
      title: "Zone du restaurant à confirmer",
      message:
        "Ce partenaire n’a pas encore publié une zone de livraison suffisamment précise. Aucune commande ne peut être payée tant que cette information n’est pas confirmée.",
      zoneLabel: "Zone partenaire à confirmer",
      normalizedCity: city,
    };
  }

  if (!combined) {
    return {
      ok: false,
      status: "missing",
      title: "Adresse à compléter",
      message:
        "Ajoutez puis confirmez votre adresse de livraison pour vérifier la zone de ce restaurant.",
      zoneLabel,
      normalizedCity: city,
    };
  }

  const accepted = tokens.some((token) => combined.includes(token));

  if (accepted) {
    return {
      ok: true,
      status: "ok",
      title: "Zone de livraison validée",
      message: `Votre adresse correspond à la zone déclarée par le partenaire : ${zoneLabel}.`,
      zoneLabel,
      normalizedCity: city,
    };
  }

  return {
    ok: false,
    status: "outside",
    title: "Adresse hors zone déclarée",
    message: `Ce restaurant déclare actuellement la zone « ${zoneLabel} ». Choisissez une adresse comprise dans cette zone ou un autre partenaire.`,
    zoneLabel,
    normalizedCity: city,
  };
}

export function deliveryZoneSummary(result: DADeliveryZoneResult): string {
  if (result.ok) return `Zone validée · ${result.zoneLabel}`;
  if (result.status === "missing") return `Zone à confirmer · ${result.zoneLabel}`;
  return `Hors zone · ${result.zoneLabel}`;
}

export const DELIVERY_ZONES_V1_LABEL =
  "La zone dépend du restaurant sélectionné et de sa couverture confirmée.";
