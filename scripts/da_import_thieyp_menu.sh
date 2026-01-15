#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
OUT_DIR="$ROOT/templates/thieyp_import_kit"
CLIENT_DATA_DIR="$ROOT/apps/client/src/data"
MERCHANT_DATA_DIR="$ROOT/apps/merchant/src/data"
COURIER_DATA_DIR="$ROOT/apps/courier/src/data"

mkdir -p "$OUT_DIR"

# --- 1) Partner (fiche) ---
cat > "$OUT_DIR/partner.thieyp.json" <<'JSON'
{
  "id": "thieyp",
  "slug": "thieyp",
  "name": "Thieyp",
  "city": "Ixelles",
  "country": "BE",
  "address": {
    "line1": "Rue Longue Vie 46",
    "postalCode": "1050",
    "city": "Ixelles",
    "country": "Belgium"
  },
  "hours": [
    { "days": ["MON", "TUE", "WED", "THU", "FRI", "SAT"], "open": "12:00", "close": "14:30" },
    { "days": ["MON", "TUE", "WED", "THU", "FRI", "SAT"], "open": "18:00", "close": "22:00" }
  ],
  "contacts": {
    "phoneE164": "+32493392737",
    "website": "https://www.thieyp.be",
    "instagram": "thieypbruxelles"
  },
  "tags": ["africain", "sénégalais", "ivoirien", "streetfood"],
  "notes": "Carte limitée pour assurer la plus grande fraîcheur des plats."
}
JSON

# --- 2) Menu ---
cat > "$OUT_DIR/menu.thieyp.json" <<'JSON'
{
  "partnerId": "thieyp",
  "currency": "EUR",
  "sections": [
    {
      "id": "daily-specials",
      "title": "Plats du jour",
      "items": [
        { "id": "mon_rice_and_peace", "day": "MON", "name": "Rice and Peace", "price": 21.90 },
        { "id": "mon_attieke_poisson", "day": "MON", "name": "Attiéké au poisson", "price": 21.90 },

        { "id": "tue_thieboudieune", "day": "TUE", "name": "Thiéboudieune", "price": 21.90 },
        { "id": "tue_mafe_jarret", "day": "TUE", "name": "Mafè à la viande (jarret)", "price": 29.90 },

        { "id": "wed_yassa_crevettes", "day": "WED", "name": "Yassa aux crevettes", "price": 22.90 },
        { "id": "wed_attieke_poulet", "day": "WED", "name": "Attiéké au poulet", "price": 21.90 },

        { "id": "thu_foutou_graine", "day": "THU", "name": "Foutou banane sauce graine", "price": 22.90 },
        { "id": "thu_thiou_boulettes_poisson", "day": "THU", "name": "Thiou boulettes de poisson", "price": 21.90 },

        { "id": "fri_yassa_poulet", "day": "FRI", "name": "Yassa au poulet", "price": 21.90 },
        { "id": "fri_thieboudieune", "day": "FRI", "name": "Thiéboudieune", "price": 21.90 },

        { "id": "sat_dibi_allocos", "day": "SAT", "name": "Dibi et allocos", "price": 22.90 },
        { "id": "sat_acras_morue_allocos", "day": "SAT", "name": "Acras de morue et allocos", "price": 21.90 }
      ]
    },
    {
      "id": "extras",
      "title": "Extras",
      "items": [
        { "id": "entree_du_jour", "name": "Entrée du jour", "priceRange": { "min": 10.50, "max": 12.50 } },
        { "id": "plat_vegetarien", "name": "Plat végétarien sur demande", "price": 21.90 },
        { "id": "dessert_du_jour", "name": "Dessert du jour", "priceRange": { "min": 8.50, "max": 10.50 } },
        { "id": "jus_frais", "name": "Jus frais naturels (hibiscus, gingembre ou baobab)", "price": 4.90 }
      ]
    }
  ]
}
JSON

# --- 3) (Optionnel) : copie “data TS” dans chaque app, sans toucher à vos écrans existants ---
write_ts() {
  local dir="$1"
  local file="$dir/thieypMenu.ts"
  mkdir -p "$dir"
  cat > "$file" <<'TS'
export type ThieypMenuDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

export const THIEYP_MENU = {
  currency: "EUR" as const,
  daily: [
    { day: "MON" as ThieypMenuDay, items: [
      { id: "mon_rice_and_peace", name: "Rice and Peace", price: 21.90 },
      { id: "mon_attieke_poisson", name: "Attiéké au poisson", price: 21.90 },
    ]},
    { day: "TUE" as ThieypMenuDay, items: [
      { id: "tue_thieboudieune", name: "Thiéboudieune", price: 21.90 },
      { id: "tue_mafe_jarret", name: "Mafè à la viande (jarret)", price: 29.90 },
    ]},
    { day: "WED" as ThieypMenuDay, items: [
      { id: "wed_yassa_crevettes", name: "Yassa aux crevettes", price: 22.90 },
      { id: "wed_attieke_poulet", name: "Attiéké au poulet", price: 21.90 },
    ]},
    { day: "THU" as ThieypMenuDay, items: [
      { id: "thu_foutou_graine", name: "Foutou banane sauce graine", price: 22.90 },
      { id: "thu_thiou_boulettes_poisson", name: "Thiou boulettes de poisson", price: 21.90 },
    ]},
    { day: "FRI" as ThieypMenuDay, items: [
      { id: "fri_yassa_poulet", name: "Yassa au poulet", price: 21.90 },
      { id: "fri_thieboudieune", name: "Thiéboudieune", price: 21.90 },
    ]},
    { day: "SAT" as ThieypMenuDay, items: [
      { id: "sat_dibi_allocos", name: "Dibi et allocos", price: 22.90 },
      { id: "sat_acras_morue_allocos", name: "Acras de morue et allocos", price: 21.90 },
    ]},
  ],
  extras: {
    entreeDuJour: { min: 10.50, max: 12.50 },
    platVegetarien: 21.90,
    dessertDuJour: { min: 8.50, max: 10.50 },
    jusFrais: 4.90,
    jusOptions: ["hibiscus", "gingembre", "baobab"] as const,
  },
  partnerCard: {
    address: "Rue Longue Vie 46, 1050 Ixelles",
    hours: "Lun–Sam 12h–14h30 / 18h–22h",
    phone: "+32 493 39 27 37",
    website: "https://www.thieyp.be",
    instagram: "thieypbruxelles",
  }
} as const;
TS
  echo "✅ Wrote $file"
}

if [ -d "$ROOT/apps/client" ]; then write_ts "$CLIENT_DATA_DIR"; fi
if [ -d "$ROOT/apps/merchant" ]; then write_ts "$MERCHANT_DATA_DIR"; fi
if [ -d "$ROOT/apps/courier" ]; then write_ts "$COURIER_DATA_DIR"; fi

echo
echo "✅ Thieyp Import Kit ready:"
echo " - $OUT_DIR/partner.thieyp.json"
echo " - $OUT_DIR/menu.thieyp.json"
echo
echo "➡️ Next: intégrer ces données côté API (Partners controller) OU côté UI (import THIEYP_MENU)."
