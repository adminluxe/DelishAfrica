export type ThieypDay =
  | "Lundi"
  | "Mardi"
  | "Mercredi"
  | "Jeudi"
  | "Vendredi"
  | "Samedi";

export type ThieypMenuItem = {
  sku: string;
  day?: ThieypDay;
  name: string;
  priceEUR: number;
  tags?: string[];
};

export const THIEYP_PARTNER = {
  slug: "thieyp",
  name: "Thieyp",
  address: "Rue Longue Vie 46, 1050 Ixelles",
  phone: "+32 493 39 27 37",
  website: "https://www.thieyp.be",
  instagram: "thieypbruxelles",
  hours: "Lun–Sam 12:00–14:30 • 18:00–22:00",
  currency: "EUR",
} as const;

/**
 * Source: photos menu Thieyp (carte/menu papier).
 * Note: on garde volontairement les libellés exacts (accents / orthographe) tels qu’affichés.
 */
export const THIEYP_MENU = {
  updatedAt: "2025-12-18",
  note: "Carte limitée pour assurer la plus grande fraîcheur des plats.",
  entreeDuJour: { minEUR: 10.5, maxEUR: 12.5 },
  dessertDuJour: { minEUR: 8.5, maxEUR: 10.5 },
  jusFraisNaturelsEUR: 4.9,
  items: [
    // Lundi
    { sku: "thieyp-mon-001", day: "Lundi", name: "Rice and Peace", priceEUR: 21.9, tags: ["Plat du jour"] },
    { sku: "thieyp-mon-002", day: "Lundi", name: "Attiéké au poisson", priceEUR: 21.9, tags: ["Plat du jour"] },

    // Mardi
    { sku: "thieyp-tue-001", day: "Mardi", name: "Thiéboudieune", priceEUR: 21.9, tags: ["Plat du jour"] },
    { sku: "thieyp-tue-002", day: "Mardi", name: "Mafè à la viande (jarret)", priceEUR: 29.9, tags: ["Plat du jour"] },

    // Mercredi
    { sku: "thieyp-wed-001", day: "Mercredi", name: "Yassa aux crevettes", priceEUR: 22.9, tags: ["Plat du jour"] },
    { sku: "thieyp-wed-002", day: "Mercredi", name: "Attiéké au poulet", priceEUR: 21.9, tags: ["Plat du jour"] },

    // Jeudi
    { sku: "thieyp-thu-001", day: "Jeudi", name: "Foutou banane sauce graine", priceEUR: 22.9, tags: ["Plat du jour"] },
    { sku: "thieyp-thu-002", day: "Jeudi", name: "Thiou boulettes de poisson", priceEUR: 21.9, tags: ["Plat du jour"] },

    // Vendredi
    { sku: "thieyp-fri-001", day: "Vendredi", name: "Yassa au poulet", priceEUR: 21.9, tags: ["Plat du jour"] },
    { sku: "thieyp-fri-002", day: "Vendredi", name: "Thiéboudieune", priceEUR: 21.9, tags: ["Plat du jour"] },

    // Samedi
    { sku: "thieyp-sat-001", day: "Samedi", name: "Dibi et allocos", priceEUR: 22.9, tags: ["Plat du jour"] },
    { sku: "thieyp-sat-002", day: "Samedi", name: "Acras de morue et allocos", priceEUR: 21.9, tags: ["Plat du jour"] },

    // Extras
    { sku: "thieyp-x-veg-001", name: "Plat végétarien (sur demande)", priceEUR: 21.9, tags: ["Sur demande"] },
    { sku: "thieyp-x-jus-001", name: "Jus frais naturels (hibiscus / gingembre / baobab)", priceEUR: 4.9, tags: ["Boisson"] },
  ] as ThieypMenuItem[],
} as const;

export function formatEUR(v: number): string {
  // Affichage FR simple, sans dépendance Intl (évite surprises RN)
  return `${v.toFixed(2).replace(".", ",")} €`;
}

export function todayFR(): ThieypDay | null {
  const d = new Date();
  // JS: 0=Dim ... 6=Sam
  const map: Record<number, ThieypDay | null> = {
    0: null,
    1: "Lundi",
    2: "Mardi",
    3: "Mercredi",
    4: "Jeudi",
    5: "Vendredi",
    6: "Samedi",
  };
  return map[d.getDay()] ?? null;
}

export function todayItems(): ThieypMenuItem[] {
  const t = todayFR();
  if (!t) return [];
  return THIEYP_MENU.items.filter((x) => x.day === t);
}
