export type thieypMenuDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
export type ThieypDayKey = thieypMenuDay;
export type ThieypDay = "Lundi" | "Mardi" | "Mercredi" | "Jeudi" | "Vendredi" | "Samedi";

export type ThieypMenuItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  priceEUR: number;
  price: number;
  amount: number;
  description: string;
  tags: string[];
  dayKey?: ThieypDayKey;
  day?: ThieypDay;
};

export type ThieypMenuDayBlock = {
  day: ThieypDayKey;
  dayKey: ThieypDayKey;
  label: ThieypDay;
  items: ThieypMenuItem[];
};

export const THIEYP_PARTNER = {
  "slug": "thieyp",
  "name": "Thieyp",
  "address": "Rue Longue Vie 46, 1050 Ixelles, Bruxelles",
  "phone": "+32 493 39 27 37",
  "email": "info@thieyp.be",
  "website": "https://thieyp.be",
  "hours": "Lun–Sam 12h–14h30 / 18h–22h",
  "city": "Ixelles",
  "area": "Saint-Boniface / Matonge",
  "cuisine": "Cuisine sénégalaise",
  "description": "Fresh African Mama Kitchen à Ixelles : plats maison du jour, cuisine sénégalaise et ouest-africaine, accueil chaleureux."
} as const;

export const THIEYP_MENU_ITEMS: ThieypMenuItem[] = [
  {
    "id": "thieyp-rice-and-peace-lundi",
    "sku": "thieyp-rice-and-peace-lundi",
    "name": "Rice and Peace",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Riz coco, haricots, pilons de poulet et sauce chien.",
    "tags": [
      "halal",
      "plat-du-jour"
    ],
    "dayKey": "MON",
    "day": "Lundi"
  },
  {
    "id": "thieyp-attieke-poisson-lundi",
    "sku": "thieyp-attieke-poisson-lundi",
    "name": "Attiéké au poisson",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Semoule de manioc, poisson mariné et salade fraîche.",
    "tags": [
      "poisson",
      "afrique-ouest"
    ],
    "dayKey": "MON",
    "day": "Lundi"
  },
  {
    "id": "thieyp-thieboudieune-rouge-mardi",
    "sku": "thieyp-thieboudieune-rouge-mardi",
    "name": "Thiéboudieune rouge",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Riz cassé tomaté, poisson frais et légumes cuits dans le riz.",
    "tags": [
      "signature",
      "senegal",
      "poisson"
    ],
    "dayKey": "TUE",
    "day": "Mardi"
  },
  {
    "id": "thieyp-mafe-viande-mardi",
    "sku": "thieyp-mafe-viande-mardi",
    "name": "Mafé à la viande",
    "category": "Plat du jour",
    "priceEUR": 29.9,
    "price": 29.9,
    "amount": 2990,
    "description": "Riz blanc, jarret de viande et sauce onctueuse à base d’arachide et de tomate.",
    "tags": [
      "arachide",
      "halal"
    ],
    "dayKey": "TUE",
    "day": "Mardi"
  },
  {
    "id": "thieyp-yassa-crevettes-mercredi",
    "sku": "thieyp-yassa-crevettes-mercredi",
    "name": "Yassa aux crevettes",
    "category": "Plat du jour",
    "priceEUR": 22.9,
    "price": 22.9,
    "amount": 2290,
    "description": "Riz blanc, oignons frits, crevettes marinées citron/moutarde/vinaigre, petits légumes.",
    "tags": [
      "crevettes",
      "senegal"
    ],
    "dayKey": "WED",
    "day": "Mercredi"
  },
  {
    "id": "thieyp-attieke-poulet-mercredi",
    "sku": "thieyp-attieke-poulet-mercredi",
    "name": "Attiéké au poulet",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Semoule de manioc, émincés de poulet marinés et salade de poivrons.",
    "tags": [
      "poulet",
      "afrique-ouest"
    ],
    "dayKey": "WED",
    "day": "Mercredi"
  },
  {
    "id": "thieyp-foutu-banane-sauce-graine-jeudi",
    "sku": "thieyp-foutu-banane-sauce-graine-jeudi",
    "name": "Foutu banane sauce graine",
    "category": "Plat du jour",
    "priceEUR": 22.9,
    "price": 22.9,
    "amount": 2290,
    "description": "Pâte lisse accompagnée de viande d’agneau et sauce graine.",
    "tags": [
      "agneau",
      "afrique-ouest"
    ],
    "dayKey": "THU",
    "day": "Jeudi"
  },
  {
    "id": "thieyp-thiou-boulettes-poisson-jeudi",
    "sku": "thieyp-thiou-boulettes-poisson-jeudi",
    "name": "Thiou boulettes de poisson",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Boulettes de poisson sauce tomate, riz blanc ou frites de patates douces.",
    "tags": [
      "poisson",
      "tomate"
    ],
    "dayKey": "THU",
    "day": "Jeudi"
  },
  {
    "id": "thieyp-thieboudiene-vendredi",
    "sku": "thieyp-thieboudiene-vendredi",
    "name": "Thieboudiene",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Riz cassé, poisson frais et légumes, plat national sénégalais.",
    "tags": [
      "signature",
      "senegal",
      "poisson"
    ],
    "dayKey": "FRI",
    "day": "Vendredi"
  },
  {
    "id": "thieyp-yassa-poulet-vendredi",
    "sku": "thieyp-yassa-poulet-vendredi",
    "name": "Yassa de poulet",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Riz blanc, oignons frits, émincés de poulet marinés citron/moutarde/vinaigre.",
    "tags": [
      "poulet",
      "senegal"
    ],
    "dayKey": "FRI",
    "day": "Vendredi"
  },
  {
    "id": "thieyp-bissap",
    "sku": "thieyp-bissap",
    "name": "Hibiscus / Bissap",
    "category": "Boisson",
    "priceEUR": 4.9,
    "price": 4.9,
    "amount": 490,
    "description": "Boisson maison à l’hibiscus.",
    "tags": [
      "boisson",
      "maison"
    ]
  },
  {
    "id": "thieyp-gingembre",
    "sku": "thieyp-gingembre",
    "name": "Gingembre",
    "category": "Boisson",
    "priceEUR": 4.9,
    "price": 4.9,
    "amount": 490,
    "description": "Boisson maison au gingembre.",
    "tags": [
      "boisson",
      "maison"
    ]
  },
  {
    "id": "thieyp-baobab",
    "sku": "thieyp-baobab",
    "name": "Baobab",
    "category": "Boisson",
    "priceEUR": 4.9,
    "price": 4.9,
    "amount": 490,
    "description": "Boisson maison au baobab.",
    "tags": [
      "boisson",
      "maison"
    ]
  }
];

export const THIEYP_MENU_DAYS: ThieypMenuDayBlock[] = [
  {
    "day": "MON",
    "dayKey": "MON",
    "label": "Lundi",
    "items": [
      {
        "id": "thieyp-rice-and-peace-lundi",
        "sku": "thieyp-rice-and-peace-lundi",
        "name": "Rice and Peace",
        "category": "Plat du jour",
        "priceEUR": 21.9,
        "price": 21.9,
        "amount": 2190,
        "description": "Riz coco, haricots, pilons de poulet et sauce chien.",
        "tags": [
          "halal",
          "plat-du-jour"
        ],
        "dayKey": "MON",
        "day": "Lundi"
      },
      {
        "id": "thieyp-attieke-poisson-lundi",
        "sku": "thieyp-attieke-poisson-lundi",
        "name": "Attiéké au poisson",
        "category": "Plat du jour",
        "priceEUR": 21.9,
        "price": 21.9,
        "amount": 2190,
        "description": "Semoule de manioc, poisson mariné et salade fraîche.",
        "tags": [
          "poisson",
          "afrique-ouest"
        ],
        "dayKey": "MON",
        "day": "Lundi"
      }
    ]
  },
  {
    "day": "TUE",
    "dayKey": "TUE",
    "label": "Mardi",
    "items": [
      {
        "id": "thieyp-thieboudieune-rouge-mardi",
        "sku": "thieyp-thieboudieune-rouge-mardi",
        "name": "Thiéboudieune rouge",
        "category": "Plat du jour",
        "priceEUR": 21.9,
        "price": 21.9,
        "amount": 2190,
        "description": "Riz cassé tomaté, poisson frais et légumes cuits dans le riz.",
        "tags": [
          "signature",
          "senegal",
          "poisson"
        ],
        "dayKey": "TUE",
        "day": "Mardi"
      },
      {
        "id": "thieyp-mafe-viande-mardi",
        "sku": "thieyp-mafe-viande-mardi",
        "name": "Mafé à la viande",
        "category": "Plat du jour",
        "priceEUR": 29.9,
        "price": 29.9,
        "amount": 2990,
        "description": "Riz blanc, jarret de viande et sauce onctueuse à base d’arachide et de tomate.",
        "tags": [
          "arachide",
          "halal"
        ],
        "dayKey": "TUE",
        "day": "Mardi"
      }
    ]
  },
  {
    "day": "WED",
    "dayKey": "WED",
    "label": "Mercredi",
    "items": [
      {
        "id": "thieyp-yassa-crevettes-mercredi",
        "sku": "thieyp-yassa-crevettes-mercredi",
        "name": "Yassa aux crevettes",
        "category": "Plat du jour",
        "priceEUR": 22.9,
        "price": 22.9,
        "amount": 2290,
        "description": "Riz blanc, oignons frits, crevettes marinées citron/moutarde/vinaigre, petits légumes.",
        "tags": [
          "crevettes",
          "senegal"
        ],
        "dayKey": "WED",
        "day": "Mercredi"
      },
      {
        "id": "thieyp-attieke-poulet-mercredi",
        "sku": "thieyp-attieke-poulet-mercredi",
        "name": "Attiéké au poulet",
        "category": "Plat du jour",
        "priceEUR": 21.9,
        "price": 21.9,
        "amount": 2190,
        "description": "Semoule de manioc, émincés de poulet marinés et salade de poivrons.",
        "tags": [
          "poulet",
          "afrique-ouest"
        ],
        "dayKey": "WED",
        "day": "Mercredi"
      }
    ]
  },
  {
    "day": "THU",
    "dayKey": "THU",
    "label": "Jeudi",
    "items": [
      {
        "id": "thieyp-foutu-banane-sauce-graine-jeudi",
        "sku": "thieyp-foutu-banane-sauce-graine-jeudi",
        "name": "Foutu banane sauce graine",
        "category": "Plat du jour",
        "priceEUR": 22.9,
        "price": 22.9,
        "amount": 2290,
        "description": "Pâte lisse accompagnée de viande d’agneau et sauce graine.",
        "tags": [
          "agneau",
          "afrique-ouest"
        ],
        "dayKey": "THU",
        "day": "Jeudi"
      },
      {
        "id": "thieyp-thiou-boulettes-poisson-jeudi",
        "sku": "thieyp-thiou-boulettes-poisson-jeudi",
        "name": "Thiou boulettes de poisson",
        "category": "Plat du jour",
        "priceEUR": 21.9,
        "price": 21.9,
        "amount": 2190,
        "description": "Boulettes de poisson sauce tomate, riz blanc ou frites de patates douces.",
        "tags": [
          "poisson",
          "tomate"
        ],
        "dayKey": "THU",
        "day": "Jeudi"
      }
    ]
  },
  {
    "day": "FRI",
    "dayKey": "FRI",
    "label": "Vendredi",
    "items": [
      {
        "id": "thieyp-thieboudiene-vendredi",
        "sku": "thieyp-thieboudiene-vendredi",
        "name": "Thieboudiene",
        "category": "Plat du jour",
        "priceEUR": 21.9,
        "price": 21.9,
        "amount": 2190,
        "description": "Riz cassé, poisson frais et légumes, plat national sénégalais.",
        "tags": [
          "signature",
          "senegal",
          "poisson"
        ],
        "dayKey": "FRI",
        "day": "Vendredi"
      },
      {
        "id": "thieyp-yassa-poulet-vendredi",
        "sku": "thieyp-yassa-poulet-vendredi",
        "name": "Yassa de poulet",
        "category": "Plat du jour",
        "priceEUR": 21.9,
        "price": 21.9,
        "amount": 2190,
        "description": "Riz blanc, oignons frits, émincés de poulet marinés citron/moutarde/vinaigre.",
        "tags": [
          "poulet",
          "senegal"
        ],
        "dayKey": "FRI",
        "day": "Vendredi"
      }
    ]
  }
];

export const THIEYP_DRINKS: ThieypMenuItem[] = [
  {
    "id": "thieyp-bissap",
    "sku": "thieyp-bissap",
    "name": "Hibiscus / Bissap",
    "category": "Boisson",
    "priceEUR": 4.9,
    "price": 4.9,
    "amount": 490,
    "description": "Boisson maison à l’hibiscus.",
    "tags": [
      "boisson",
      "maison"
    ]
  },
  {
    "id": "thieyp-gingembre",
    "sku": "thieyp-gingembre",
    "name": "Gingembre",
    "category": "Boisson",
    "priceEUR": 4.9,
    "price": 4.9,
    "amount": 490,
    "description": "Boisson maison au gingembre.",
    "tags": [
      "boisson",
      "maison"
    ]
  },
  {
    "id": "thieyp-baobab",
    "sku": "thieyp-baobab",
    "name": "Baobab",
    "category": "Boisson",
    "priceEUR": 4.9,
    "price": 4.9,
    "amount": 490,
    "description": "Boisson maison au baobab.",
    "tags": [
      "boisson",
      "maison"
    ]
  }
];

export const THIEYP_DISHES: ThieypMenuItem[] = [
  {
    "id": "thieyp-rice-and-peace-lundi",
    "sku": "thieyp-rice-and-peace-lundi",
    "name": "Rice and Peace",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Riz coco, haricots, pilons de poulet et sauce chien.",
    "tags": [
      "halal",
      "plat-du-jour"
    ],
    "dayKey": "MON",
    "day": "Lundi"
  },
  {
    "id": "thieyp-attieke-poisson-lundi",
    "sku": "thieyp-attieke-poisson-lundi",
    "name": "Attiéké au poisson",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Semoule de manioc, poisson mariné et salade fraîche.",
    "tags": [
      "poisson",
      "afrique-ouest"
    ],
    "dayKey": "MON",
    "day": "Lundi"
  },
  {
    "id": "thieyp-thieboudieune-rouge-mardi",
    "sku": "thieyp-thieboudieune-rouge-mardi",
    "name": "Thiéboudieune rouge",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Riz cassé tomaté, poisson frais et légumes cuits dans le riz.",
    "tags": [
      "signature",
      "senegal",
      "poisson"
    ],
    "dayKey": "TUE",
    "day": "Mardi"
  },
  {
    "id": "thieyp-mafe-viande-mardi",
    "sku": "thieyp-mafe-viande-mardi",
    "name": "Mafé à la viande",
    "category": "Plat du jour",
    "priceEUR": 29.9,
    "price": 29.9,
    "amount": 2990,
    "description": "Riz blanc, jarret de viande et sauce onctueuse à base d’arachide et de tomate.",
    "tags": [
      "arachide",
      "halal"
    ],
    "dayKey": "TUE",
    "day": "Mardi"
  },
  {
    "id": "thieyp-yassa-crevettes-mercredi",
    "sku": "thieyp-yassa-crevettes-mercredi",
    "name": "Yassa aux crevettes",
    "category": "Plat du jour",
    "priceEUR": 22.9,
    "price": 22.9,
    "amount": 2290,
    "description": "Riz blanc, oignons frits, crevettes marinées citron/moutarde/vinaigre, petits légumes.",
    "tags": [
      "crevettes",
      "senegal"
    ],
    "dayKey": "WED",
    "day": "Mercredi"
  },
  {
    "id": "thieyp-attieke-poulet-mercredi",
    "sku": "thieyp-attieke-poulet-mercredi",
    "name": "Attiéké au poulet",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Semoule de manioc, émincés de poulet marinés et salade de poivrons.",
    "tags": [
      "poulet",
      "afrique-ouest"
    ],
    "dayKey": "WED",
    "day": "Mercredi"
  },
  {
    "id": "thieyp-foutu-banane-sauce-graine-jeudi",
    "sku": "thieyp-foutu-banane-sauce-graine-jeudi",
    "name": "Foutu banane sauce graine",
    "category": "Plat du jour",
    "priceEUR": 22.9,
    "price": 22.9,
    "amount": 2290,
    "description": "Pâte lisse accompagnée de viande d’agneau et sauce graine.",
    "tags": [
      "agneau",
      "afrique-ouest"
    ],
    "dayKey": "THU",
    "day": "Jeudi"
  },
  {
    "id": "thieyp-thiou-boulettes-poisson-jeudi",
    "sku": "thieyp-thiou-boulettes-poisson-jeudi",
    "name": "Thiou boulettes de poisson",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Boulettes de poisson sauce tomate, riz blanc ou frites de patates douces.",
    "tags": [
      "poisson",
      "tomate"
    ],
    "dayKey": "THU",
    "day": "Jeudi"
  },
  {
    "id": "thieyp-thieboudiene-vendredi",
    "sku": "thieyp-thieboudiene-vendredi",
    "name": "Thieboudiene",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Riz cassé, poisson frais et légumes, plat national sénégalais.",
    "tags": [
      "signature",
      "senegal",
      "poisson"
    ],
    "dayKey": "FRI",
    "day": "Vendredi"
  },
  {
    "id": "thieyp-yassa-poulet-vendredi",
    "sku": "thieyp-yassa-poulet-vendredi",
    "name": "Yassa de poulet",
    "category": "Plat du jour",
    "priceEUR": 21.9,
    "price": 21.9,
    "amount": 2190,
    "description": "Riz blanc, oignons frits, émincés de poulet marinés citron/moutarde/vinaigre.",
    "tags": [
      "poulet",
      "senegal"
    ],
    "dayKey": "FRI",
    "day": "Vendredi"
  }
];

export const THIEYP_MENU = {
  currency: "EUR" as const,
  partner: THIEYP_PARTNER,
  partnerCard: THIEYP_PARTNER,
  items: THIEYP_MENU_ITEMS,
  menuItems: THIEYP_MENU_ITEMS,
  daily: THIEYP_MENU_DAYS,
  days: THIEYP_MENU_DAYS,
  drinks: THIEYP_DRINKS,
  dishes: THIEYP_DISHES,
  extras: {
    platVegetarien: 21.9,
    jusFrais: 4.9,
    jusOptions: ["bissap", "gingembre", "baobab"] as const,
  },
} as const;

export const thieypMenu = THIEYP_MENU;
export const thieypMenuByDay = THIEYP_MENU_DAYS;

export function formatEUR(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`;
}

export function todayFR(): ThieypDay | null {
  const day = new Date().getDay();
  const map: Record<number, ThieypDay | null> = {
    0: null,
    1: "Lundi",
    2: "Mardi",
    3: "Mercredi",
    4: "Jeudi",
    5: "Vendredi",
    6: "Samedi",
  };
  return map[day] ?? null;
}

export function todayItems(): ThieypMenuItem[] {
  const today = todayFR();
  if (!today) return [];
  return THIEYP_MENU_ITEMS.filter((item) => item.day === today);
}

export default THIEYP_MENU;
