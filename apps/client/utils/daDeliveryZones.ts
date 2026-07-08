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

const BRUSSELS_COMMUNES = [
"bruxelles",
"brussels",
"ixelles",
"elsene",
"auderghem",
"oudergem",
"etterbeek",
"saint-gilles",
"sint-gillis",
"uccle",
"ukkel",
"forest",
"vorst",
"saint-josse",
"sint-joost",
"schaerbeek",
"schaarbeek",
"woluwe",
"watermael",
"boitsfort",
"watermaal",
"bosvoorde",
"molenbeek",
"anderlecht",
"jette",
"evere",
"ganshoren",
"koekelberg",
"berchem",
"laeken",
"laken",
"neder-over-heembeek",
"haren",
];

const BRUSSELS_POSTCODES = [
"1000",
"1020",
"1030",
"1040",
"1050",
"1060",
"1070",
"1080",
"1081",
"1082",
"1083",
"1090",
"1120",
"1130",
"1140",
"1150",
"1160",
"1170",
"1180",
"1190",
"1200",
"1210",
];

export function normalizeZoneText(value?: string | null): string {
return String(value || "")
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.replace(/[’']/g, "")
.replace(/[^a-z0-9]+/g, " ")
.trim();
}

function containsSupportedCommune(value: string): boolean {
return BRUSSELS_COMMUNES.some((commune) => value.includes(normalizeZoneText(commune)));
}

function containsSupportedPostcode(value: string): boolean {
return BRUSSELS_POSTCODES.some((postcode) => value.includes(postcode));
}

export function validateDeliveryZone(
input?: DADeliveryZoneInput | null,
restaurantZoneLabel = "Bruxelles / Ixelles",
): DADeliveryZoneResult {
const city = normalizeZoneText(input?.city);
const address = normalizeZoneText(input?.address);
const combined = `${address} ${city}`.trim();
const zoneLabel = restaurantZoneLabel || "Bruxelles / Ixelles";

if (!combined) {
return {
ok: false,
status: "missing",
title: "Adresse à compléter",
message: "Ajoutez votre adresse et votre ville pour confirmer la zone de livraison.",
zoneLabel,
normalizedCity: city,
};
}

const accepted =
containsSupportedCommune(combined) ||
containsSupportedPostcode(combined) ||
combined.includes("bruxelles") ||
combined.includes("brussels");

if (accepted) {
return {
ok: true,
status: "ok",
title: "Zone de livraison validée",
message: `Votre adresse est dans la zone ${zoneLabel}.`,
zoneLabel,
normalizedCity: city,
};
}

return {
ok: false,
status: "outside",
title: "Zone non couverte",
message:
"Cette adresse semble hors de la zone de livraison actuelle. Pour ce palier, DelishAfrica livre Bruxelles et les communes proches.",
zoneLabel,
normalizedCity: city,
};
}

export function deliveryZoneSummary(result: DADeliveryZoneResult): string {
if (result.ok) return `Zone validée · ${result.zoneLabel}`;
if (result.status === "missing") return `Zone à compléter · ${result.zoneLabel}`;
return `Hors zone · ${result.zoneLabel}`;
}

export const DELIVERY_ZONES_V1_LABEL = "Bruxelles, Ixelles, Auderghem et communes proches";
