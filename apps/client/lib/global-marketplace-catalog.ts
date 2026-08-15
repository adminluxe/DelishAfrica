export type MarketplaceSourceKind = "official" | "directory" | "editorial";
export type MarketplacePriority = "launch" | "standard";
export type MarketplaceAvailability = "watchlist";

export type MarketplaceRadarEntry = {
  id: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  cuisine: string;
  cuisines: string[];
  description: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceKind: MarketplaceSourceKind;
  checkedAt: string;
  launchWave: number;
  priority: MarketplacePriority;
  tags: string[];
  availability: MarketplaceAvailability;
  publicAddress?: string;
  publicMenuNote?: string;
  publicMenuHighlights?: Array<{
    name: string;
    priceLabel?: string;
    checkedAt: string;
    sourceUrl: string;
  }>;
};

/**
 * Marketplace Discovery Engine V1 — Seed Registry
 *
 * Registre initial de signaux publics normalisés par le moteur de découverte.
 * Aucune entrée de ce catalogue ne vaut partenariat, disponibilité de commande,
 * validation de marque, copie de menu, de note, de photo ou de logo.
 * Les partenaires réellement actifs fournis par l'API prennent toujours priorité.
 */
export const GLOBAL_MARKETPLACE_CATALOG: MarketplaceRadarEntry[] = [
  {
    "id": "be-brussels-afrikana",
    "name": "Afrikana",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Congolais",
    "cuisines": [
      "Congolais",
      "Afrique centrale"
    ],
    "description": "Cuisine congolaise repérée dans le paysage bruxellois.",
    "sourceUrl": "https://afrikanarestaurant.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Afrique centrale"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-mere-malou",
    "name": "Chez Mère Malou",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Congolais",
    "cuisines": [
      "Congolais",
      "Afrique centrale",
      "Grillades"
    ],
    "description": "Maison congolaise présente à Bruxelles depuis 1996, repérée via sa source officielle.",
    "sourceUrl": "https://chezmeremalou.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Ixelles",
      "Congo",
      "Grillades"
    ],
    "availability": "watchlist",
    "publicAddress": "Chaussée de Wavre 104, 1050 Ixelles, Bruxelles",
    "publicMenuNote": "Repères issus de la carte publique officielle. Prix et disponibilité à confirmer avec l’établissement avant toute officialisation.",
    "publicMenuHighlights": [
      { "name": "Ailes de poulet braisées, sauce Malou", "priceLabel": "13,00 €", "checkedAt": "2026-07-18", "sourceUrl": "https://chezmeremalou.com/" },
      { "name": "Cuisse de poulet avec riz tchep", "priceLabel": "13,00 €", "checkedAt": "2026-07-18", "sourceUrl": "https://chezmeremalou.com/" },
      { "name": "Poulet entier braisé, salade et sauce Malou", "priceLabel": "15,00 €", "checkedAt": "2026-07-18", "sourceUrl": "https://chezmeremalou.com/" },
      { "name": "Chèvre grillée au bois", "priceLabel": "15,00 €", "checkedAt": "2026-07-18", "sourceUrl": "https://chezmeremalou.com/" },
      { "name": "Makayabu", "priceLabel": "18,00 €", "checkedAt": "2026-07-18", "sourceUrl": "https://chezmeremalou.com/" },
      { "name": "Tilapia braisé, sauce fines herbes", "priceLabel": "24,00 €", "checkedAt": "2026-07-18", "sourceUrl": "https://chezmeremalou.com/" }
    ]
  },
  {
    "id": "be-liege-metisses",
    "name": "Métisses",
    "city": "Liège",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Fusion africaine",
    "cuisines": [
      "Fusion africaine",
      "Afrique de l’Ouest"
    ],
    "description": "Table métissée repérée à Liège, entre héritage africain et écriture contemporaine.",
    "sourceUrl": "https://metisses.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Liège",
      "Contemporain"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-new-dakar",
    "name": "New Dakar",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Sénégalais",
    "cuisines": [
      "Sénégalais",
      "Afrique de l’Ouest"
    ],
    "description": "Adresse sénégalaise repérée à Bruxelles.",
    "sourceUrl": "https://restaurant-le-dakar.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Sénégal"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-antwerp-karibu-mezani",
    "name": "Karibu Mezani",
    "city": "Anvers",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Afrique de l’Est",
    "cuisines": [
      "Afrique de l’Est",
      "Tanzanien"
    ],
    "description": "Cuisine d’Afrique de l’Est repérée à Anvers.",
    "sourceUrl": "https://www.karibumezani.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Anvers",
      "Afrique de l’Est"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-liege-afro-drink-eat",
    "name": "Afro Drink and Eat",
    "city": "Liège",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Grillades"
    ],
    "description": "Adresse afro repérée à Liège.",
    "sourceUrl": "https://afro-drink-and-eat.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Liège",
      "Grillades"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-thieyp",
    "name": "Thieyp",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Sénégalais",
    "cuisines": [
      "Sénégalais",
      "Street food"
    ],
    "description": "Signature sénégalaise repérée à Bruxelles.",
    "sourceUrl": "https://thieyp.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Sénégal"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-africalicious",
    "name": "Africalicious",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Fusion africaine",
    "cuisines": [
      "Fusion africaine",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine africaine contemporaine repérée à Bruxelles.",
    "sourceUrl": "https://africalicious.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Contemporain"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-antwerp-little-ethiopia",
    "name": "Little Ethiopia",
    "city": "Anvers",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Éthiopien",
    "cuisines": [
      "Éthiopien",
      "Érythréen"
    ],
    "description": "Table éthiopienne repérée à Anvers.",
    "sourceUrl": "https://little-ethiopia-antwerp.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Anvers",
      "Corne de l’Afrique"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-la-lune-violette",
    "name": "La Lune chez Violette",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Camerounais",
    "cuisines": [
      "Camerounais",
      "Afrique centrale"
    ],
    "description": "Cuisine camerounaise repérée à Bruxelles.",
    "sourceUrl": "https://www.lalunechezviolette.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Cameroun"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-villa-bantou",
    "name": "La Villa Bantou",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Afrique centrale",
    "cuisines": [
      "Congolais",
      "Camerounais",
      "Afrique centrale"
    ],
    "description": "Adresse bantoue repérée à Bruxelles.",
    "sourceUrl": "https://lavillabantou.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Afrique centrale"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-le-sankaran",
    "name": "Le Sankaran",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Guinéen",
    "cuisines": [
      "Guinéen",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine guinéenne et ouest-africaine repérée à Bruxelles.",
    "sourceUrl": "https://lesankaran.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Guinée"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-boule-bleue",
    "name": "La Boule Bleue",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Grillades"
    ],
    "description": "Adresse africaine repérée à Bruxelles.",
    "sourceUrl": "https://laboulebleue.net/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Grillades"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-antwerp-black-star",
    "name": "Snack Black Star",
    "city": "Anvers",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Street food"
    ],
    "description": "Street food africaine repérée à Anvers.",
    "sourceUrl": "https://www.snackblackstar.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Anvers",
      "Street food"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-antwerp-fidel",
    "name": "Fidel Ethiopian Restaurant",
    "city": "Anvers",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Éthiopien",
    "cuisines": [
      "Éthiopien",
      "Végétarien"
    ],
    "description": "Cuisine éthiopienne repérée à Anvers.",
    "sourceUrl": "https://fidelrestaurant.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Anvers",
      "Corne de l’Afrique"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-antwerp-elsies",
    "name": "Elsie’s Eritrean & Ethiopian",
    "city": "Anvers",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Érythréen",
    "cuisines": [
      "Érythréen",
      "Éthiopien"
    ],
    "description": "Cuisine érythréenne et éthiopienne repérée à Anvers.",
    "sourceUrl": "https://elsies-restaurant.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Anvers",
      "Corne de l’Afrique"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-bantu-lounge",
    "name": "Bantu Restaurant & Lounge",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Afrique centrale",
    "cuisines": [
      "Afrique centrale",
      "Lounge"
    ],
    "description": "Restaurant et lounge africain repéré à Bruxelles.",
    "sourceUrl": "https://bantu.boost-resto.be/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Lounge"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-so-yiri",
    "name": "Sô Yiri",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Burkinabè",
    "cuisines": [
      "Burkinabè",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine burkinabè repérée à Bruxelles.",
    "sourceUrl": "https://bruxellessecrete.com/en/african-restaurants-brussels/",
    "sourceLabel": "Bruxelles Secrète",
    "sourceKind": "editorial",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Repéré en ligne"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-afro-bowl",
    "name": "Afro Bowl",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Fusion africaine",
    "cuisines": [
      "Fusion africaine",
      "Bowls"
    ],
    "description": "Concept de bowls africains repéré à Bruxelles.",
    "sourceUrl": "https://bruxellessecrete.com/en/african-restaurants-brussels/",
    "sourceLabel": "Bruxelles Secrète",
    "sourceKind": "editorial",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Repéré en ligne"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-afrosian",
    "name": "Afrosian",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Afro-asiatique",
    "cuisines": [
      "Fusion africaine",
      "Asiatique"
    ],
    "description": "Cuisine afro-asiatique repérée à Bruxelles.",
    "sourceUrl": "https://bruxellessecrete.com/en/african-restaurants-brussels/",
    "sourceLabel": "Bruxelles Secrète",
    "sourceKind": "editorial",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Repéré en ligne"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-toukoul",
    "name": "Toukoul",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Éthiopien",
    "cuisines": [
      "Éthiopien",
      "Afrique de l’Est"
    ],
    "description": "Table éthiopienne repérée à Bruxelles.",
    "sourceUrl": "https://bruxellessecrete.com/en/african-restaurants-brussels/",
    "sourceLabel": "Bruxelles Secrète",
    "sourceKind": "editorial",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Repéré en ligne"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-fasika",
    "name": "Fasika",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Éthiopien",
    "cuisines": [
      "Éthiopien",
      "Végétarien"
    ],
    "description": "Cuisine éthiopienne repérée à Bruxelles.",
    "sourceUrl": "https://bruxellessecrete.com/en/african-restaurants-brussels/",
    "sourceLabel": "Bruxelles Secrète",
    "sourceKind": "editorial",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Repéré en ligne"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-cafe-beguin",
    "name": "Café Béguin",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Fusion africaine",
    "cuisines": [
      "Fusion africaine",
      "Bar"
    ],
    "description": "Adresse afro-urbaine repérée à Bruxelles.",
    "sourceUrl": "https://bruxellessecrete.com/en/african-restaurants-brussels/",
    "sourceLabel": "Bruxelles Secrète",
    "sourceKind": "editorial",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Repéré en ligne"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-petite-metisse",
    "name": "Petite Métisse",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Fusion africaine",
    "cuisines": [
      "Fusion africaine",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine métissée africaine repérée à Bruxelles.",
    "sourceUrl": "https://bruxellessecrete.com/en/african-restaurants-brussels/",
    "sourceLabel": "Bruxelles Secrète",
    "sourceKind": "editorial",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Repéré en ligne"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-afro-luna",
    "name": "Afro Luna",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Grillades"
    ],
    "description": "Adresse ouest-africaine repérée à Bruxelles.",
    "sourceUrl": "https://bruxellessecrete.com/en/african-restaurants-brussels/",
    "sourceLabel": "Bruxelles Secrète",
    "sourceKind": "editorial",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Repéré en ligne"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-zamunda",
    "name": "Restaurant Zamunda",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Afrique centrale",
    "cuisines": [
      "Afrique centrale",
      "Fusion africaine"
    ],
    "description": "Restaurant africain repéré dans les annuaires de réservation bruxellois.",
    "sourceUrl": "https://www.thefork.be/restaurants/bruxelles-c68211/africain-t375",
    "sourceLabel": "TheFork Belgique",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Annuaire public"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-christo-renaissance",
    "name": "Christo Renaissance Africain",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Grillades"
    ],
    "description": "Adresse africaine repérée dans les annuaires de réservation bruxellois.",
    "sourceUrl": "https://www.thefork.be/restaurants/bruxelles-c68211/africain-t375",
    "sourceLabel": "TheFork Belgique",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Annuaire public"
    ],
    "availability": "watchlist"
  },
  {
    "id": "be-brussels-debys-delice",
    "name": "Deby’s Delice Bistro",
    "city": "Bruxelles",
    "country": "Belgique",
    "countryCode": "BE",
    "cuisine": "Fusion africaine",
    "cuisines": [
      "Fusion africaine",
      "Bistro"
    ],
    "description": "Bistro africain repéré dans les annuaires de réservation bruxellois.",
    "sourceUrl": "https://www.thefork.be/restaurants/bruxelles-c68211/africain-t375",
    "sourceLabel": "TheFork Belgique",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Bruxelles",
      "Annuaire public"
    ],
    "availability": "watchlist"
  },
  {
    "id": "lu-luxembourg-odum",
    "name": "Odum",
    "city": "Luxembourg",
    "country": "Luxembourg",
    "countryCode": "LU",
    "cuisine": "Fusion africaine",
    "cuisines": [
      "Fusion africaine",
      "Ghanéen"
    ],
    "description": "Cuisine africaine fusion repérée au Luxembourg.",
    "sourceUrl": "https://odumfusion.lu/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Luxembourg",
      "Fusion"
    ],
    "availability": "watchlist"
  },
  {
    "id": "lu-luxembourg-cap-afrik",
    "name": "Cap-Afrik",
    "city": "Luxembourg",
    "country": "Luxembourg",
    "countryCode": "LU",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Traiteur"
    ],
    "description": "Adresse africaine repérée au Luxembourg.",
    "sourceUrl": "https://cap-afrik.lu/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Luxembourg",
      "Afrique de l’Ouest"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-paris-bmk-paris-bamako",
    "name": "BMK Paris-Bamako",
    "city": "Paris",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Malien",
    "cuisines": [
      "Malien",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine malienne et ouest-africaine repérée à Paris.",
    "sourceUrl": "https://www.bmkparis.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Paris",
      "Mali"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-paris-bmk-folie-bamako",
    "name": "BMK Folie-Bamako",
    "city": "Paris",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Malien",
    "cuisines": [
      "Malien",
      "Afrique de l’Ouest"
    ],
    "description": "Deuxième escale BMK repérée à Paris.",
    "sourceUrl": "https://www.bmkparis.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Paris",
      "Mali"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-paris-mama-kossa",
    "name": "Mama Kossa",
    "city": "Paris",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Fusion africaine",
    "cuisines": [
      "Fusion africaine",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine africaine contemporaine repérée à Paris.",
    "sourceUrl": "https://www.mamakossa.fr/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Paris",
      "Contemporain"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-paris-le-lokosso",
    "name": "Le Lokosso",
    "city": "Paris",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Béninois",
    "cuisines": [
      "Béninois",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine béninoise repérée à Paris.",
    "sourceUrl": "https://lelokossoparis.fr/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Paris",
      "Bénin"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-paris-waly-fay",
    "name": "Waly-Fay",
    "city": "Paris",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Sénégalais",
    "cuisines": [
      "Sénégalais",
      "Afrique de l’Ouest"
    ],
    "description": "Table sénégalaise repérée à Paris.",
    "sourceUrl": "https://www.walyfay.fr/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Paris",
      "Sénégal"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-paris-ose-chateau-eau",
    "name": "Osè African Cuisine · Château d’Eau",
    "city": "Paris",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Street food"
    ],
    "description": "Cuisine africaine urbaine repérée à Paris.",
    "sourceUrl": "https://www.thefork.fr/restaurant/ose-african-cuisine-chateau-d-eau-r731788",
    "sourceLabel": "TheFork France",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Paris",
      "Street food"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-paris-ose-saint-lazare",
    "name": "Osè African Cuisine · Saint-Lazare",
    "city": "Paris",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Street food"
    ],
    "description": "Cuisine africaine urbaine repérée près de Saint-Lazare.",
    "sourceUrl": "https://www.thefork.fr/restaurant/ose-african-cuisine-saint-lazare-r805701",
    "sourceLabel": "TheFork France",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Paris",
      "Street food"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-lyon-awani",
    "name": "AWANI",
    "city": "Lyon",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Fusion africaine",
    "cuisines": [
      "Fusion africaine",
      "Contemporain"
    ],
    "description": "Cuisine africaine contemporaine repérée à Lyon.",
    "sourceUrl": "https://www.awani-restaurant-africain.fr/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Lyon",
      "Contemporain"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-lyon-tam-tam",
    "name": "Tam-Tam",
    "city": "Lyon",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Grillades"
    ],
    "description": "Restaurant africain repéré à Lyon.",
    "sourceUrl": "https://tam-tam-restaurant.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Lyon",
      "Afrique de l’Ouest"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-lyon-addis-abeba",
    "name": "Addis Abeba",
    "city": "Lyon",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Éthiopien",
    "cuisines": [
      "Éthiopien",
      "Végétarien"
    ],
    "description": "Cuisine éthiopienne repérée à Lyon.",
    "sourceUrl": "https://addisabeba.fr/fr",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Lyon",
      "Corne de l’Afrique"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-lyon-africana",
    "name": "Africana Lyon 3",
    "city": "Lyon",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Grillades"
    ],
    "description": "Adresse africaine repérée dans le troisième arrondissement de Lyon.",
    "sourceUrl": "https://africana-lyon-3.fr/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Lyon",
      "Grillades"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-lyon-amessiam",
    "name": "Amessiam Youcan",
    "city": "Lyon",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Fusion africaine",
    "cuisines": [
      "Fusion africaine",
      "Cuisine africaine"
    ],
    "description": "Fusion africaine repérée dans les annuaires publics lyonnais.",
    "sourceUrl": "https://www.thefork.fr/restaurants/lyon-c326512/africain-t375",
    "sourceLabel": "TheFork France",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Lyon",
      "Annuaire public"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-lyon-gebeta",
    "name": "Gebeta",
    "city": "Lyon",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Éthiopien",
    "cuisines": [
      "Éthiopien",
      "Cuisine africaine"
    ],
    "description": "Éthiopien repérée dans les annuaires publics lyonnais.",
    "sourceUrl": "https://www.thefork.fr/restaurants/lyon-c326512/africain-t375",
    "sourceLabel": "TheFork France",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Lyon",
      "Annuaire public"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-lyon-gojo",
    "name": "Gojo",
    "city": "Lyon",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Éthiopien",
    "cuisines": [
      "Éthiopien",
      "Cuisine africaine"
    ],
    "description": "Éthiopien repérée dans les annuaires publics lyonnais.",
    "sourceUrl": "https://www.thefork.fr/restaurants/lyon-c326512/africain-t375",
    "sourceLabel": "TheFork France",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Lyon",
      "Annuaire public"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-marseille-kin",
    "name": "KIN",
    "city": "Marseille",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Congolais",
    "cuisines": [
      "Congolais",
      "Fusion française"
    ],
    "description": "Cuisine congolaise et française repérée à Marseille.",
    "sourceUrl": "https://ohmyresto.fr/etablissement/kin-restaurant",
    "sourceLabel": "Oh My Resto",
    "sourceKind": "editorial",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Marseille",
      "Congo"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-marseille-kwetu",
    "name": "Kwetu Bistrot Afro Contemporain",
    "city": "Marseille",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Fusion africaine",
    "cuisines": [
      "Fusion africaine",
      "Cuisine africaine"
    ],
    "description": "Fusion africaine repérée dans les annuaires publics marseillais.",
    "sourceUrl": "https://www.thefork.fr/restaurants/marseille-c336326/africain-t375",
    "sourceLabel": "TheFork France",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Marseille",
      "Annuaire public"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-marseille-mama-nelly",
    "name": "Mama Nelly Bistro Chic",
    "city": "Marseille",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Cuisine africaine"
    ],
    "description": "Afrique de l’Ouest repérée dans les annuaires publics marseillais.",
    "sourceUrl": "https://www.thefork.fr/restaurants/marseille-c336326/africain-t375",
    "sourceLabel": "TheFork France",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Marseille",
      "Annuaire public"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-marseille-wara-buffet",
    "name": "Wara Buffet",
    "city": "Marseille",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Cuisine africaine"
    ],
    "description": "Afrique de l’Ouest repérée dans les annuaires publics marseillais.",
    "sourceUrl": "https://www.thefork.fr/restaurants/marseille-c336326/africain-t375",
    "sourceLabel": "TheFork France",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Marseille",
      "Annuaire public"
    ],
    "availability": "watchlist"
  },
  {
    "id": "fr-marseille-opiment",
    "name": "Opiment",
    "city": "Marseille",
    "country": "France",
    "countryCode": "FR",
    "cuisine": "Fusion africaine",
    "cuisines": [
      "Fusion africaine",
      "Cuisine africaine"
    ],
    "description": "Fusion africaine repérée dans les annuaires publics marseillais.",
    "sourceUrl": "https://www.thefork.fr/restaurants/marseille-c336326/africain-t375",
    "sourceLabel": "TheFork France",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 1,
    "priority": "launch",
    "tags": [
      "Marseille",
      "Annuaire public"
    ],
    "availability": "watchlist"
  },
  {
    "id": "de-berlin-bantabaa",
    "name": "Bantabaa Food Dealer",
    "city": "Berlin",
    "country": "Allemagne",
    "countryCode": "DE",
    "cuisine": "Gambien",
    "cuisines": [
      "Gambien",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine gambienne repérée à Berlin.",
    "sourceUrl": "https://bantabaafooddealer.eu/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Berlin",
      "Gambie"
    ],
    "availability": "watchlist"
  },
  {
    "id": "de-berlin-9ja-flavour",
    "name": "9JA Flavour",
    "city": "Berlin",
    "country": "Allemagne",
    "countryCode": "DE",
    "cuisine": "Nigérian",
    "cuisines": [
      "Nigérian",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine nigériane repérée à Berlin.",
    "sourceUrl": "https://9jaflavour.de/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Berlin",
      "Nigeria"
    ],
    "availability": "watchlist"
  },
  {
    "id": "de-berlin-didi-pa",
    "name": "Didi Pa",
    "city": "Berlin",
    "country": "Allemagne",
    "countryCode": "DE",
    "cuisine": "Ghanéen",
    "cuisines": [
      "Ghanéen",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine ghanéenne repérée à Berlin.",
    "sourceUrl": "https://didipa.de/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Berlin",
      "Ghana"
    ],
    "availability": "watchlist"
  },
  {
    "id": "de-berlin-afropot",
    "name": "Afropot Mitte",
    "city": "Berlin",
    "country": "Allemagne",
    "countryCode": "DE",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Street food"
    ],
    "description": "Adresse ouest-africaine repérée à Berlin.",
    "sourceUrl": "https://www.top10berlin.de/en/cat/eating-257/african-restaurants/afropot-mitte",
    "sourceLabel": "Top10 Berlin",
    "sourceKind": "editorial",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Berlin",
      "Street food"
    ],
    "availability": "watchlist"
  },
  {
    "id": "de-hamburg-ghana-aba",
    "name": "Ghana Aba Abrokyire",
    "city": "Hambourg",
    "country": "Allemagne",
    "countryCode": "DE",
    "cuisine": "Ghanéen",
    "cuisines": [
      "Ghanéen",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine ghanéenne repérée à Hambourg.",
    "sourceUrl": "https://www.ghana-aba-abrokyire.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Hambourg",
      "Ghana"
    ],
    "availability": "watchlist"
  },
  {
    "id": "de-hamburg-shanis",
    "name": "Shani’s African Snacks",
    "city": "Hambourg",
    "country": "Allemagne",
    "countryCode": "DE",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Street food"
    ],
    "description": "Snacks africains repérés à Hambourg.",
    "sourceUrl": "https://www.shanisafricansnacks.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Hambourg",
      "Street food"
    ],
    "availability": "watchlist"
  },
  {
    "id": "gb-london-stork",
    "name": "Stork",
    "city": "Londres",
    "country": "Royaume-Uni",
    "countryCode": "GB",
    "cuisine": "Pan-africain",
    "cuisines": [
      "Pan-africain",
      "Contemporain"
    ],
    "description": "Cuisine pan-africaine contemporaine repérée à Londres.",
    "sourceUrl": "https://storkrestaurant.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Londres",
      "Contemporain"
    ],
    "availability": "watchlist"
  },
  {
    "id": "gb-london-akoko",
    "name": "Akoko",
    "city": "Londres",
    "country": "Royaume-Uni",
    "countryCode": "GB",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Gastronomique"
    ],
    "description": "Cuisine ouest-africaine gastronomique repérée à Londres.",
    "sourceUrl": "https://akoko.co.uk/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Londres",
      "Gastronomique"
    ],
    "availability": "watchlist"
  },
  {
    "id": "gb-london-chishuru",
    "name": "Chishuru",
    "city": "Londres",
    "country": "Royaume-Uni",
    "countryCode": "GB",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Contemporain"
    ],
    "description": "Cuisine ouest-africaine contemporaine repérée à Londres.",
    "sourceUrl": "https://www.chishuru.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Londres",
      "Contemporain"
    ],
    "availability": "watchlist"
  },
  {
    "id": "gb-london-akara",
    "name": "Akara",
    "city": "Londres",
    "country": "Royaume-Uni",
    "countryCode": "GB",
    "cuisine": "Afrique de l’Ouest",
    "cuisines": [
      "Afrique de l’Ouest",
      "Street food"
    ],
    "description": "Concept ouest-africain repéré à Londres.",
    "sourceUrl": "https://www.akaralondon.co.uk/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Londres",
      "Street food"
    ],
    "availability": "watchlist"
  },
  {
    "id": "gb-london-little-baobab",
    "name": "Little Baobab",
    "city": "Londres",
    "country": "Royaume-Uni",
    "countryCode": "GB",
    "cuisine": "Sénégalais",
    "cuisines": [
      "Sénégalais",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine sénégalaise repérée à Londres.",
    "sourceUrl": "https://littlebaobab.co.uk/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Londres",
      "Sénégal"
    ],
    "availability": "watchlist"
  },
  {
    "id": "gb-london-805",
    "name": "805 Restaurants",
    "city": "Londres",
    "country": "Royaume-Uni",
    "countryCode": "GB",
    "cuisine": "Nigérian",
    "cuisines": [
      "Nigérian",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine nigériane repérée à Londres.",
    "sourceUrl": "https://www.805restaurants.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Londres",
      "Nigeria"
    ],
    "availability": "watchlist"
  },
  {
    "id": "gb-manchester-backyard-africa",
    "name": "Backyard Africa",
    "city": "Manchester",
    "country": "Royaume-Uni",
    "countryCode": "GB",
    "cuisine": "Pan-africain",
    "cuisines": [
      "Pan-africain",
      "Grillades"
    ],
    "description": "Cuisine africaine repérée à Manchester.",
    "sourceUrl": "https://backyardafrica.co.uk/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Manchester",
      "Pan-africain"
    ],
    "availability": "watchlist"
  },
  {
    "id": "gb-manchester-house-habesha",
    "name": "House of Habesha",
    "city": "Manchester",
    "country": "Royaume-Uni",
    "countryCode": "GB",
    "cuisine": "Éthiopien",
    "cuisines": [
      "Éthiopien",
      "Érythréen"
    ],
    "description": "Cuisine de la Corne de l’Afrique repérée à Manchester.",
    "sourceUrl": "https://www.designmynight.com/manchester/restaurants/house-of-habesha",
    "sourceLabel": "DesignMyNight",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 2,
    "priority": "standard",
    "tags": [
      "Manchester",
      "Corne de l’Afrique"
    ],
    "availability": "watchlist"
  },
  {
    "id": "sn-dakar-la-calebasse",
    "name": "La Calebasse",
    "city": "Dakar",
    "country": "Sénégal",
    "countryCode": "SN",
    "cuisine": "Sénégalais",
    "cuisines": [
      "Sénégalais",
      "Contemporain"
    ],
    "description": "Table sénégalaise repérée à Dakar.",
    "sourceUrl": "https://oumangeradakar.com/joj-dakar-2026",
    "sourceLabel": "Où Manger à Dakar",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Dakar",
      "Sénégal"
    ],
    "availability": "watchlist"
  },
  {
    "id": "sn-dakar-chez-loutcha",
    "name": "Chez Loutcha",
    "city": "Dakar",
    "country": "Sénégal",
    "countryCode": "SN",
    "cuisine": "Sénégalais",
    "cuisines": [
      "Sénégalais",
      "Cuisine familiale"
    ],
    "description": "Institution culinaire repérée à Dakar.",
    "sourceUrl": "https://oumangeradakar.com/joj-dakar-2026",
    "sourceLabel": "Où Manger à Dakar",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Dakar",
      "Cuisine familiale"
    ],
    "availability": "watchlist"
  },
  {
    "id": "sn-dakar-lagon-1",
    "name": "Le Lagon 1",
    "city": "Dakar",
    "country": "Sénégal",
    "countryCode": "SN",
    "cuisine": "Sénégalais",
    "cuisines": [
      "Sénégalais",
      "Poissons"
    ],
    "description": "Adresse emblématique repérée à Dakar.",
    "sourceUrl": "https://www.lelagondakar.com/lelagon1/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Dakar",
      "Poissons"
    ],
    "availability": "watchlist"
  },
  {
    "id": "sn-dakar-le-ngor",
    "name": "Le Ngor",
    "city": "Dakar",
    "country": "Sénégal",
    "countryCode": "SN",
    "cuisine": "Sénégalais",
    "cuisines": [
      "Sénégalais",
      "Poissons"
    ],
    "description": "Restaurant repéré à Dakar.",
    "sourceUrl": "https://restaurantlengor.sn/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Dakar",
      "Sénégal"
    ],
    "availability": "watchlist"
  },
  {
    "id": "sn-saint-louis-baobab-gourmand",
    "name": "Le Baobab Gourmand",
    "city": "Saint-Louis",
    "country": "Sénégal",
    "countryCode": "SN",
    "cuisine": "Sénégalais",
    "cuisines": [
      "Sénégalais",
      "Cuisine locale"
    ],
    "description": "Adresse repérée à Saint-Louis.",
    "sourceUrl": "https://oumangeradakar.com/",
    "sourceLabel": "Où Manger à Dakar",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Saint-Louis",
      "Cuisine locale"
    ],
    "availability": "watchlist"
  },
  {
    "id": "sn-saly-noflaye-beach",
    "name": "Noflaye Beach",
    "city": "Saly",
    "country": "Sénégal",
    "countryCode": "SN",
    "cuisine": "Sénégalais",
    "cuisines": [
      "Sénégalais",
      "Plage"
    ],
    "description": "Adresse repérée à Saly.",
    "sourceUrl": "https://oumangeradakar.com/",
    "sourceLabel": "Où Manger à Dakar",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Saly",
      "Plage"
    ],
    "availability": "watchlist"
  },
  {
    "id": "ci-abidjan-saakan",
    "name": "Saakan",
    "city": "Abidjan",
    "country": "Côte d’Ivoire",
    "countryCode": "CI",
    "cuisine": "Ivoirien",
    "cuisines": [
      "Ivoirien",
      "Contemporain"
    ],
    "description": "Cuisine ivoirienne contemporaine repérée à Abidjan.",
    "sourceUrl": "https://saakanabidjan.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Abidjan",
      "Contemporain"
    ],
    "availability": "watchlist"
  },
  {
    "id": "ci-abidjan-fourchette-roze",
    "name": "La Fourchette de Rōze",
    "city": "Abidjan",
    "country": "Côte d’Ivoire",
    "countryCode": "CI",
    "cuisine": "Ivoirien",
    "cuisines": [
      "Ivoirien",
      "Contemporain"
    ],
    "description": "Table ivoirienne repérée à Abidjan.",
    "sourceUrl": "https://www.eater.com/maps/best-restaurants-abidjan-ivory-coast",
    "sourceLabel": "Eater",
    "sourceKind": "editorial",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Abidjan",
      "Contemporain"
    ],
    "availability": "watchlist"
  },
  {
    "id": "ci-abidjan-cafe-continent",
    "name": "Café Continent",
    "city": "Abidjan",
    "country": "Côte d’Ivoire",
    "countryCode": "CI",
    "cuisine": "Ivoirien",
    "cuisines": [
      "Ivoirien",
      "Café"
    ],
    "description": "Adresse ivoirienne repérée à Abidjan.",
    "sourceUrl": "https://www.eater.com/maps/best-restaurants-abidjan-ivory-coast",
    "sourceLabel": "Eater",
    "sourceKind": "editorial",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Abidjan",
      "Café"
    ],
    "availability": "watchlist"
  },
  {
    "id": "ci-abidjan-chez-ambroise",
    "name": "Chez Ambroise",
    "city": "Abidjan",
    "country": "Côte d’Ivoire",
    "countryCode": "CI",
    "cuisine": "Ivoirien",
    "cuisines": [
      "Ivoirien",
      "Maquis"
    ],
    "description": "Maquis ivoirien repéré à Abidjan.",
    "sourceUrl": "https://www.tripadvisor.com/Restaurants-g297513-c10632-Abidjan_Lagunes_Region.html",
    "sourceLabel": "Tripadvisor",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Abidjan",
      "Maquis"
    ],
    "availability": "watchlist"
  },
  {
    "id": "ci-abidjan-o-feu-bois",
    "name": "Maquis Resto Ô Feu de Bois",
    "city": "Abidjan",
    "country": "Côte d’Ivoire",
    "countryCode": "CI",
    "cuisine": "Ivoirien",
    "cuisines": [
      "Ivoirien",
      "Maquis",
      "Grillades"
    ],
    "description": "Maquis et grillades repérés à Abidjan.",
    "sourceUrl": "https://www.tripadvisor.com/Restaurants-g297513-c10632-Abidjan_Lagunes_Region.html",
    "sourceLabel": "Tripadvisor",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Abidjan",
      "Grillades"
    ],
    "availability": "watchlist"
  },
  {
    "id": "ci-abidjan-sole-plus",
    "name": "Maquis Le Sole Plus",
    "city": "Abidjan",
    "country": "Côte d’Ivoire",
    "countryCode": "CI",
    "cuisine": "Ivoirien",
    "cuisines": [
      "Ivoirien",
      "Maquis"
    ],
    "description": "Maquis ivoirien repéré à Abidjan.",
    "sourceUrl": "https://www.tripadvisor.com/Restaurants-g297513-c10632-Abidjan_Lagunes_Region.html",
    "sourceLabel": "Tripadvisor",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Abidjan",
      "Maquis"
    ],
    "availability": "watchlist"
  },
  {
    "id": "cm-douala-african-grill-emy",
    "name": "African Grill by Emy",
    "city": "Douala",
    "country": "Cameroun",
    "countryCode": "CM",
    "cuisine": "Camerounais",
    "cuisines": [
      "Camerounais",
      "Grillades"
    ],
    "description": "Cuisine camerounaise et grillades repérées à Douala.",
    "sourceUrl": "https://www.tripadvisor.com/Restaurants-g297392-c10632-Douala_Littoral_Region.html",
    "sourceLabel": "Tripadvisor",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Douala",
      "Grillades"
    ],
    "availability": "watchlist"
  },
  {
    "id": "cm-yaounde-african-food-emy",
    "name": "African Food by Emy",
    "city": "Yaoundé",
    "country": "Cameroun",
    "countryCode": "CM",
    "cuisine": "Camerounais",
    "cuisines": [
      "Camerounais",
      "Cuisine locale"
    ],
    "description": "Cuisine camerounaise repérée à Yaoundé.",
    "sourceUrl": "https://www.tripadvisor.com/Restaurants-g293773-c10632-Yaounde_Centre_Region.html",
    "sourceLabel": "Tripadvisor",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Yaoundé",
      "Cuisine locale"
    ],
    "availability": "watchlist"
  },
  {
    "id": "cm-douala-kotcha",
    "name": "Kotcha Restaurant",
    "city": "Douala",
    "country": "Cameroun",
    "countryCode": "CM",
    "cuisine": "Camerounais",
    "cuisines": [
      "Camerounais",
      "Contemporain"
    ],
    "description": "Restaurant camerounais repéré à Douala.",
    "sourceUrl": "https://www.tripadvisor.com/Restaurants-g297392-c10632-Douala_Littoral_Region.html",
    "sourceLabel": "Tripadvisor",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Douala",
      "Contemporain"
    ],
    "availability": "watchlist"
  },
  {
    "id": "cm-douala-the-yard",
    "name": "The Yard Restaurant",
    "city": "Douala",
    "country": "Cameroun",
    "countryCode": "CM",
    "cuisine": "Fusion africaine",
    "cuisines": [
      "Fusion africaine",
      "Lounge"
    ],
    "description": "Adresse afro-contemporaine repérée à Douala.",
    "sourceUrl": "https://www.tripadvisor.com/Restaurants-g297392-Douala_Littoral_Region.html",
    "sourceLabel": "Tripadvisor",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Douala",
      "Lounge"
    ],
    "availability": "watchlist"
  },
  {
    "id": "gn-conakry-jardins-guinee",
    "name": "Les Jardins de Guinée",
    "city": "Conakry",
    "country": "Guinée",
    "countryCode": "GN",
    "cuisine": "Guinéen",
    "cuisines": [
      "Guinéen",
      "Afrique de l’Ouest"
    ],
    "description": "Cuisine guinéenne repérée à Conakry.",
    "sourceUrl": "https://www.petitfute.com/v53010-conakry/c1165-restaurants/",
    "sourceLabel": "Petit Futé",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Conakry",
      "Guinée"
    ],
    "availability": "watchlist"
  },
  {
    "id": "gn-conakry-gout-eternel",
    "name": "Le Goût Éternel",
    "city": "Conakry",
    "country": "Guinée",
    "countryCode": "GN",
    "cuisine": "Guinéen",
    "cuisines": [
      "Guinéen",
      "Cuisine locale"
    ],
    "description": "Adresse guinéenne repérée à Conakry.",
    "sourceUrl": "https://www.tripadvisor.com/Restaurants-g293797-Conakry_Conakry_Region.html",
    "sourceLabel": "Tripadvisor",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Conakry",
      "Cuisine locale"
    ],
    "availability": "watchlist"
  },
  {
    "id": "rw-kigali-heaven",
    "name": "Heaven Restaurant",
    "city": "Kigali",
    "country": "Rwanda",
    "countryCode": "RW",
    "cuisine": "Rwandais",
    "cuisines": [
      "Rwandais",
      "Pan-africain"
    ],
    "description": "Cuisine rwandaise et pan-africaine repérée à Kigali.",
    "sourceUrl": "https://heavenrwanda.com/dine/heaven-restaurant/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Kigali",
      "Rwanda"
    ],
    "availability": "watchlist"
  },
  {
    "id": "rw-kigali-nyurah",
    "name": "Nyurah",
    "city": "Kigali",
    "country": "Rwanda",
    "countryCode": "RW",
    "cuisine": "Rwandais",
    "cuisines": [
      "Rwandais",
      "Contemporain"
    ],
    "description": "Cuisine rwandaise contemporaine repérée à Kigali.",
    "sourceUrl": "https://nyurah.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Kigali",
      "Contemporain"
    ],
    "availability": "watchlist"
  },
  {
    "id": "rw-musanze-meza-malonga",
    "name": "Meza Malonga",
    "city": "Musanze",
    "country": "Rwanda",
    "countryCode": "RW",
    "cuisine": "Pan-africain",
    "cuisines": [
      "Pan-africain",
      "Gastronomique"
    ],
    "description": "Expérience culinaire pan-africaine repérée au Rwanda.",
    "sourceUrl": "https://www.mezamalonga.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Musanze",
      "Gastronomique"
    ],
    "availability": "watchlist"
  },
  {
    "id": "rw-kigali-anda",
    "name": "Anda Kigali",
    "city": "Kigali",
    "country": "Rwanda",
    "countryCode": "RW",
    "cuisine": "Rwandais",
    "cuisines": [
      "Rwandais",
      "Contemporain"
    ],
    "description": "Table contemporaine repérée à Kigali.",
    "sourceUrl": "https://www.cntraveler.com/story/best-restaurants-in-kigali-rwanda",
    "sourceLabel": "Condé Nast Traveler",
    "sourceKind": "editorial",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Kigali",
      "Contemporain"
    ],
    "availability": "watchlist"
  },
  {
    "id": "ng-lagos-nok-alara",
    "name": "NOK by Alara",
    "city": "Lagos",
    "country": "Nigéria",
    "countryCode": "NG",
    "cuisine": "Nigérian",
    "cuisines": [
      "Nigérian",
      "Contemporain"
    ],
    "description": "Cuisine nigériane contemporaine repérée à Lagos.",
    "sourceUrl": "https://www.nokbyalara.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Lagos",
      "Contemporain"
    ],
    "availability": "watchlist"
  },
  {
    "id": "ng-lagos-mama-cass",
    "name": "Mama Cass",
    "city": "Lagos",
    "country": "Nigéria",
    "countryCode": "NG",
    "cuisine": "Nigérian",
    "cuisines": [
      "Nigérian",
      "Cuisine familiale"
    ],
    "description": "Enseigne nigériane repérée à Lagos.",
    "sourceUrl": "https://mamacassng.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Lagos",
      "Cuisine familiale"
    ],
    "availability": "watchlist"
  },
  {
    "id": "ng-lagos-molabat",
    "name": "Molabat Kitchen",
    "city": "Lagos",
    "country": "Nigéria",
    "countryCode": "NG",
    "cuisine": "Nigérian",
    "cuisines": [
      "Nigérian",
      "Cuisine locale"
    ],
    "description": "Cuisine nigériane repérée à Lagos.",
    "sourceUrl": "https://molabatkitchen.com/",
    "sourceLabel": "Site officiel",
    "sourceKind": "official",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Lagos",
      "Cuisine locale"
    ],
    "availability": "watchlist"
  },
  {
    "id": "ng-abuja-iya-oyo",
    "name": "Iya Oyo",
    "city": "Abuja",
    "country": "Nigéria",
    "countryCode": "NG",
    "cuisine": "Nigérian",
    "cuisines": [
      "Nigérian",
      "Yoruba"
    ],
    "description": "Cuisine yoruba repérée à Abuja.",
    "sourceUrl": "https://chowdeck.com/store/iya-oyo",
    "sourceLabel": "Chowdeck",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Abuja",
      "Yoruba"
    ],
    "availability": "watchlist"
  },
  {
    "id": "ng-abuja-yahuza-suya",
    "name": "Yahuza Suya Spot",
    "city": "Abuja",
    "country": "Nigéria",
    "countryCode": "NG",
    "cuisine": "Nigérian",
    "cuisines": [
      "Nigérian",
      "Suya",
      "Grillades"
    ],
    "description": "Spécialiste du suya repéré à Abuja.",
    "sourceUrl": "https://www.nigerianrestaurants.com/restaurant/yahuza-suya-spot/",
    "sourceLabel": "Nigerian Restaurants",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Abuja",
      "Suya"
    ],
    "availability": "watchlist"
  },
  {
    "id": "ng-lagos-ekaabo",
    "name": "Ekaabo Restaurant",
    "city": "Lagos",
    "country": "Nigéria",
    "countryCode": "NG",
    "cuisine": "Nigérian",
    "cuisines": [
      "Nigérian",
      "Cuisine locale"
    ],
    "description": "Restaurant nigérian repéré à Lagos.",
    "sourceUrl": "https://www.tripadvisor.com/Restaurants-g304026-c10632-Lagos_Lagos_State.html",
    "sourceLabel": "Tripadvisor",
    "sourceKind": "directory",
    "checkedAt": "2026-07-18",
    "launchWave": 3,
    "priority": "standard",
    "tags": [
      "Lagos",
      "Cuisine locale"
    ],
    "availability": "watchlist"
  }
];

export function marketplaceRadarById(id: string): MarketplaceRadarEntry | undefined {
  return GLOBAL_MARKETPLACE_CATALOG.find((entry) => entry.id === id);
}

export const MARKETPLACE_RADAR_COUNTRIES = Array.from(
  new Set(GLOBAL_MARKETPLACE_CATALOG.map((entry) => entry.country)),
);
