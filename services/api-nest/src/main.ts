import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CatalogFoundationService } from './catalog-foundation/catalog-foundation.service';
import { minimumOrderAmountCents } from './order-policy/order-policy';

type Partner = {
  id: string;
  name: string;
  slug: string;
  city: string;
  cuisine?: string;
  rating?: number;
  area?: string;
  country?: string;
  cuisines?: string[];
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  description?: string;
  descriptionLong?: string;
  openingHours?: Record<string, string[]>;
  delivery?: Record<string, unknown>;
  dietary?: Record<string, unknown>;
  status?: string;
  featured?: boolean;
  menu?: Array<Record<string, unknown>>;
  menuItems?: Array<Record<string, unknown>>;
};

const partners: Partner[] = [
  {
    "id": "p1",
    "name": "Thieyp",
    "slug": "thieyp",
    "city": "Ixelles",
    "area": "Saint-Boniface / Matonge",
    "country": "Belgique",
    "cuisine": "Sénégalais",
    "cuisines": [
      "Africain",
      "Sénégalais",
      "Afrique de l’Ouest",
      "Halal"
    ],
    "rating": 4.8,
    "address": "Rue Longue Vie 46, 1050 Ixelles, Bruxelles",
    "phone": "+32 493 39 27 37",
    "email": "info@thieyp.be",
    "website": "https://thieyp.be",
    "description": "Fresh African Mama Kitchen à Ixelles : plats maison du jour, cuisine sénégalaise et ouest-africaine, accueil chaleureux.",
    "descriptionLong": "Thieyp propose une carte courte et fraîche, cuisinée le jour même : deux plats maison par jour, un plat végétarien à la demande, viandes halal, recettes souvent sans gluten et sans lactose, boissons et desserts maison.",
    "openingHours": {
      "monday": [
        "12:00-14:30",
        "18:00-22:00"
      ],
      "tuesday": [
        "12:00-14:30",
        "18:00-22:00"
      ],
      "wednesday": [
        "12:00-14:30",
        "18:00-22:00"
      ],
      "thursday": [
        "12:00-14:30",
        "18:00-22:00"
      ],
      "friday": [
        "12:00-14:30",
        "18:00-22:00"
      ],
      "saturday": [
        "12:00-14:30",
        "18:00-22:00"
      ],
      "sunday": []
    },
    "delivery": {
      "enabled": true,
      "minimumOrderAmount": minimumOrderAmountCents("thieyp"),
      "prepTimeMinutes": 20,
      "serviceAreaLabel": "Bruxelles / Ixelles"
    },
    "dietary": {
      "halal": true,
      "vegetarianOptions": true,
      "glutenFreeFriendly": true,
      "lactoseFreeFriendly": true
    },
    "status": "active",
    "featured": true,
    "menu": [
      {
        "sku": "thieyp-rice-and-peace-lundi",
        "name": "Rice and Peace",
        "category": "Plat du jour",
        "day": "lundi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Riz coco, haricots, pilons de poulet et sauce chien.",
        "tags": [
          "halal",
          "plat-du-jour"
        ]
      },
      {
        "sku": "thieyp-attieke-poisson-lundi",
        "name": "Attiéké au poisson",
        "category": "Plat du jour",
        "day": "lundi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Semoule de manioc, poisson mariné et salade fraîche.",
        "tags": [
          "poisson",
          "afrique-ouest"
        ]
      },
      {
        "sku": "thieyp-thieboudieune-rouge-mardi",
        "name": "Thiéboudieune rouge",
        "category": "Plat du jour",
        "day": "mardi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Riz cassé tomaté, poisson frais et légumes cuits dans le riz.",
        "tags": [
          "signature",
          "senegal",
          "poisson"
        ]
      },
      {
        "sku": "thieyp-mafe-viande-mardi",
        "name": "Mafé à la viande",
        "category": "Plat du jour",
        "day": "mardi",
        "price": 29.9,
        "priceEUR": 29.9,
        "amount": 2990,
        "description": "Riz blanc, jarret de viande et sauce onctueuse à base d’arachide et de tomate.",
        "tags": [
          "arachide",
          "halal"
        ]
      },
      {
        "sku": "thieyp-yassa-crevettes-mercredi",
        "name": "Yassa aux crevettes",
        "category": "Plat du jour",
        "day": "mercredi",
        "price": 22.9,
        "priceEUR": 22.9,
        "amount": 2290,
        "description": "Riz blanc, oignons frits, crevettes marinées citron/moutarde/vinaigre, petits légumes.",
        "tags": [
          "crevettes",
          "senegal"
        ]
      },
      {
        "sku": "thieyp-attieke-poulet-mercredi",
        "name": "Attiéké au poulet",
        "category": "Plat du jour",
        "day": "mercredi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Semoule de manioc, émincés de poulet marinés et salade de poivrons.",
        "tags": [
          "poulet",
          "afrique-ouest"
        ]
      },
      {
        "sku": "thieyp-foutu-banane-sauce-graine-jeudi",
        "name": "Foutu banane sauce graine",
        "category": "Plat du jour",
        "day": "jeudi",
        "price": 22.9,
        "priceEUR": 22.9,
        "amount": 2290,
        "description": "Pâte lisse accompagnée de viande d’agneau et sauce graine.",
        "tags": [
          "agneau",
          "afrique-ouest"
        ]
      },
      {
        "sku": "thieyp-thiou-boulettes-poisson-jeudi",
        "name": "Thiou boulettes de poisson",
        "category": "Plat du jour",
        "day": "jeudi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Boulettes de poisson sauce tomate, riz blanc ou frites de patates douces.",
        "tags": [
          "poisson",
          "tomate"
        ]
      },
      {
        "sku": "thieyp-thieboudiene-vendredi",
        "name": "Thieboudiene",
        "category": "Plat du jour",
        "day": "vendredi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Riz cassé, poisson frais et légumes, plat national sénégalais.",
        "tags": [
          "signature",
          "senegal",
          "poisson"
        ]
      },
      {
        "sku": "thieyp-yassa-poulet-vendredi",
        "name": "Yassa de poulet",
        "category": "Plat du jour",
        "day": "vendredi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Riz blanc, oignons frits, émincés de poulet marinés citron/moutarde/vinaigre.",
        "tags": [
          "poulet",
          "senegal"
        ]
      },
      {
        "sku": "thieyp-bissap",
        "name": "Hibiscus / Bissap",
        "category": "Boisson",
        "day": null,
        "price": 4.9,
        "priceEUR": 4.9,
        "amount": 490,
        "description": "Boisson maison à l’hibiscus.",
        "tags": [
          "boisson",
          "maison"
        ]
      },
      {
        "sku": "thieyp-gingembre",
        "name": "Gingembre",
        "category": "Boisson",
        "day": null,
        "price": 4.9,
        "priceEUR": 4.9,
        "amount": 490,
        "description": "Boisson maison au gingembre.",
        "tags": [
          "boisson",
          "maison"
        ]
      },
      {
        "sku": "thieyp-baobab",
        "name": "Baobab",
        "category": "Boisson",
        "day": null,
        "price": 4.9,
        "priceEUR": 4.9,
        "amount": 490,
        "description": "Boisson maison au baobab.",
        "tags": [
          "boisson",
          "maison"
        ]
      }
    ],
    "menuItems": [
      {
        "sku": "thieyp-rice-and-peace-lundi",
        "name": "Rice and Peace",
        "category": "Plat du jour",
        "day": "lundi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Riz coco, haricots, pilons de poulet et sauce chien.",
        "tags": [
          "halal",
          "plat-du-jour"
        ]
      },
      {
        "sku": "thieyp-attieke-poisson-lundi",
        "name": "Attiéké au poisson",
        "category": "Plat du jour",
        "day": "lundi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Semoule de manioc, poisson mariné et salade fraîche.",
        "tags": [
          "poisson",
          "afrique-ouest"
        ]
      },
      {
        "sku": "thieyp-thieboudieune-rouge-mardi",
        "name": "Thiéboudieune rouge",
        "category": "Plat du jour",
        "day": "mardi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Riz cassé tomaté, poisson frais et légumes cuits dans le riz.",
        "tags": [
          "signature",
          "senegal",
          "poisson"
        ]
      },
      {
        "sku": "thieyp-mafe-viande-mardi",
        "name": "Mafé à la viande",
        "category": "Plat du jour",
        "day": "mardi",
        "price": 29.9,
        "priceEUR": 29.9,
        "amount": 2990,
        "description": "Riz blanc, jarret de viande et sauce onctueuse à base d’arachide et de tomate.",
        "tags": [
          "arachide",
          "halal"
        ]
      },
      {
        "sku": "thieyp-yassa-crevettes-mercredi",
        "name": "Yassa aux crevettes",
        "category": "Plat du jour",
        "day": "mercredi",
        "price": 22.9,
        "priceEUR": 22.9,
        "amount": 2290,
        "description": "Riz blanc, oignons frits, crevettes marinées citron/moutarde/vinaigre, petits légumes.",
        "tags": [
          "crevettes",
          "senegal"
        ]
      },
      {
        "sku": "thieyp-attieke-poulet-mercredi",
        "name": "Attiéké au poulet",
        "category": "Plat du jour",
        "day": "mercredi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Semoule de manioc, émincés de poulet marinés et salade de poivrons.",
        "tags": [
          "poulet",
          "afrique-ouest"
        ]
      },
      {
        "sku": "thieyp-foutu-banane-sauce-graine-jeudi",
        "name": "Foutu banane sauce graine",
        "category": "Plat du jour",
        "day": "jeudi",
        "price": 22.9,
        "priceEUR": 22.9,
        "amount": 2290,
        "description": "Pâte lisse accompagnée de viande d’agneau et sauce graine.",
        "tags": [
          "agneau",
          "afrique-ouest"
        ]
      },
      {
        "sku": "thieyp-thiou-boulettes-poisson-jeudi",
        "name": "Thiou boulettes de poisson",
        "category": "Plat du jour",
        "day": "jeudi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Boulettes de poisson sauce tomate, riz blanc ou frites de patates douces.",
        "tags": [
          "poisson",
          "tomate"
        ]
      },
      {
        "sku": "thieyp-thieboudiene-vendredi",
        "name": "Thieboudiene",
        "category": "Plat du jour",
        "day": "vendredi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Riz cassé, poisson frais et légumes, plat national sénégalais.",
        "tags": [
          "signature",
          "senegal",
          "poisson"
        ]
      },
      {
        "sku": "thieyp-yassa-poulet-vendredi",
        "name": "Yassa de poulet",
        "category": "Plat du jour",
        "day": "vendredi",
        "price": 21.9,
        "priceEUR": 21.9,
        "amount": 2190,
        "description": "Riz blanc, oignons frits, émincés de poulet marinés citron/moutarde/vinaigre.",
        "tags": [
          "poulet",
          "senegal"
        ]
      },
      {
        "sku": "thieyp-bissap",
        "name": "Hibiscus / Bissap",
        "category": "Boisson",
        "day": null,
        "price": 4.9,
        "priceEUR": 4.9,
        "amount": 490,
        "description": "Boisson maison à l’hibiscus.",
        "tags": [
          "boisson",
          "maison"
        ]
      },
      {
        "sku": "thieyp-gingembre",
        "name": "Gingembre",
        "category": "Boisson",
        "day": null,
        "price": 4.9,
        "priceEUR": 4.9,
        "amount": 490,
        "description": "Boisson maison au gingembre.",
        "tags": [
          "boisson",
          "maison"
        ]
      },
      {
        "sku": "thieyp-baobab",
        "name": "Baobab",
        "category": "Boisson",
        "day": null,
        "price": 4.9,
        "priceEUR": 4.9,
        "amount": 490,
        "description": "Boisson maison au baobab.",
        "tags": [
          "boisson",
          "maison"
        ]
      }
    ]
  },
  {
      "id": "la-boule-bleue",
      "name": "La Boule Bleue",
      "slug": "la-boule-bleue",
      "city": "Ixelles",
      "area": "Chaussée de Wavre / Ixelles",
      "country": "Belgique",
      "cuisine": "Belgo-Africaine",
      "cuisines": [
          "Africain",
          "Belgo-Africain",
          "Grillades",
          "Cuisine d’Afrique centrale"
      ],
      "address": "Chaussée de Wavre 115, 1050 Ixelles, Bruxelles",
      "phone": "+32 2 852 53 16",
      "email": "cadilac115@gmail.com",
      "website": "https://laboulebleue.net",
      "description": "Une table belgo-africaine à Ixelles, entre grillades, légumes mijotés, sauces généreuses et accompagnements traditionnels.",
      "descriptionLong": "La Boule Bleue rejoint DelishAfrica® avec une carte africaine généreuse à Ixelles : grillades, légumes et sauces cuisinées, accompagnements traditionnels et boissons maison. La V1 livraison publie uniquement les références dont le prix est lisible sans ambiguïté sur les supports transmis par le partenaire.",
      "openingHours": {
          "monday": [
              "11:00-23:00"
          ],
          "tuesday": [
              "11:00-23:00"
          ],
          "wednesday": [
              "11:00-23:00"
          ],
          "thursday": [
              "11:00-23:00"
          ],
          "friday": [
              "11:00-01:00"
          ],
          "saturday": [
              "11:00-01:00"
          ],
          "sunday": [
              "11:00-01:00"
          ]
      },
      "delivery": {
          "enabled": true,
          "serviceAreaLabel": "Bruxelles / Ixelles"
      },
      "status": "active",
      "featured": true,
      "menu": [
          {
              "sku": "lbb-tilapia-braise",
              "name": "Tilapia braisé",
              "category": "Grillades",
              "price": 17,
              "priceEUR": 17,
              "amount": 1700,
              "tags": [
                  "poisson",
                  "grillade"
              ]
          },
          {
              "sku": "lbb-malangwa-braise",
              "name": "Malangwa braisé",
              "category": "Grillades",
              "price": 18,
              "priceEUR": 18,
              "amount": 1800,
              "tags": [
                  "poisson",
                  "grillade"
              ]
          },
          {
              "sku": "lbb-porc-braise",
              "name": "Porc braisé",
              "category": "Grillades",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "porc",
                  "grillade"
              ]
          },
          {
              "sku": "lbb-poulet-braise",
              "name": "Poulet braisé",
              "category": "Grillades",
              "price": 17,
              "priceEUR": 17,
              "amount": 1700,
              "tags": [
                  "poulet",
                  "grillade"
              ]
          },
          {
              "sku": "lbb-thompson-braise",
              "name": "Thompson braisé",
              "category": "Grillades",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "poisson",
                  "grillade"
              ]
          },
          {
              "sku": "lbb-chevre-grillee",
              "name": "Chèvre grillée",
              "category": "Grillades",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "chevre",
                  "grillade"
              ]
          },
          {
              "sku": "lbb-ndole-poisson",
              "name": "Ndolé poisson",
              "category": "Légumes",
              "price": 17,
              "priceEUR": 17,
              "amount": 1700,
              "tags": [
                  "ndole",
                  "poisson"
              ]
          },
          {
              "sku": "lbb-bitekuteku",
              "name": "Bitekuteku",
              "category": "Légumes",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "legumes"
              ]
          },
          {
              "sku": "lbb-pondu",
              "name": "Pondu",
              "category": "Légumes",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "manioc",
                  "legumes"
              ]
          },
          {
              "sku": "lbb-fumbwa",
              "name": "Fumbwa",
              "category": "Légumes",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "legumes"
              ]
          },
          {
              "sku": "lbb-bitole-legumes",
              "name": "Bitolé légumes",
              "category": "Légumes",
              "price": 18,
              "priceEUR": 18,
              "amount": 1800,
              "tags": [
                  "legumes"
              ]
          },
          {
              "sku": "lbb-ndole-viande",
              "name": "Ndolé viande",
              "category": "Légumes",
              "price": 15,
              "priceEUR": 15,
              "amount": 1500,
              "tags": [
                  "ndole",
                  "viande"
              ]
          },
          {
              "sku": "lbb-ndole-crevettes",
              "name": "Ndolé crevettes",
              "category": "Légumes",
              "price": 18,
              "priceEUR": 18,
              "amount": 1800,
              "tags": [
                  "ndole",
                  "crevettes"
              ]
          },
          {
              "sku": "lbb-epinards",
              "name": "Épinards",
              "category": "Légumes",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "legumes"
              ]
          },
          {
              "sku": "lbb-sauce-arachide",
              "name": "Sauce arachide · viande ou poulet",
              "category": "Sauces",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "arachide",
                  "sauce"
              ]
          },
          {
              "sku": "lbb-sauce-tomate",
              "name": "Sauce tomate · viande, poulet ou poisson",
              "category": "Sauces",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "tomate",
                  "sauce"
              ]
          },
          {
              "sku": "lbb-mouambe-poulet",
              "name": "Mouambé poulet",
              "category": "Sauces",
              "price": 15,
              "priceEUR": 15,
              "amount": 1500,
              "tags": [
                  "poulet",
                  "mouambe"
              ]
          },
          {
              "sku": "lbb-bolognaise-spaghetti",
              "name": "Bolognaise · spaghetti",
              "category": "Sauces",
              "price": 10,
              "priceEUR": 10,
              "amount": 1000,
              "tags": [
                  "pates",
                  "sauce"
              ]
          },
          {
              "sku": "lbb-riz",
              "name": "Riz",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-frites",
              "name": "Frites",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-pomme-de-terre",
              "name": "Pomme de terre",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-manioc",
              "name": "Manioc",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-banane-plantain",
              "name": "Banane plantain",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "plantain",
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-foutou-manioc",
              "name": "Foutou manioc",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "manioc",
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-semoule",
              "name": "Semoule",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-baton-manioc",
              "name": "Bâton de manioc",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "manioc",
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-attieke",
              "name": "Attiéké",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "manioc",
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-croquettes",
              "name": "Croquettes",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-expresso",
              "name": "Expresso",
              "category": "Boissons chaudes",
              "price": 2.5,
              "priceEUR": 2.5,
              "amount": 250,
              "tags": [
                  "boisson",
                  "cafe"
              ]
          },
          {
              "sku": "lbb-cappuccino",
              "name": "Cappuccino",
              "category": "Boissons chaudes",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "cafe"
              ]
          },
          {
              "sku": "lbb-chocolat-chaud-froid",
              "name": "Chocolat chaud / froid",
              "category": "Boissons chaudes",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson"
              ]
          },
          {
              "sku": "lbb-lait-russe",
              "name": "Lait russe",
              "category": "Boissons chaudes",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson"
              ]
          },
          {
              "sku": "lbb-the-nature-citron",
              "name": "Thé nature / citron",
              "category": "Boissons chaudes",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "the"
              ]
          },
          {
              "sku": "lbb-infusion",
              "name": "Infusion · green tea citron, camomille ou menthe",
              "category": "Boissons chaudes",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "boisson",
                  "infusion"
              ]
          },
          {
              "sku": "lbb-gingembre-chaud",
              "name": "Gingembre chaud",
              "category": "Boissons chaudes",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "boisson",
                  "gingembre"
              ]
          },
          {
              "sku": "lbb-looza",
              "name": "Looza · pomme, ananas, pêche ou orange",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "jus"
              ]
          },
          {
              "sku": "lbb-sprite-fanta-schweppes",
              "name": "Sprite / Fanta / Schweppes",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "soda"
              ]
          },
          {
              "sku": "lbb-coca-cola",
              "name": "Coca-Cola · normal, zero ou light",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "soda"
              ]
          },
          {
              "sku": "lbb-ice-tea",
              "name": "Ice Tea",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson"
              ]
          },
          {
              "sku": "lbb-spa-25",
              "name": "Spa 25 cl",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "eau"
              ]
          },
          {
              "sku": "lbb-spa-1l",
              "name": "Spa 1 L",
              "category": "Boissons froides",
              "price": 5,
              "priceEUR": 5,
              "amount": 500,
              "tags": [
                  "boisson",
                  "eau"
              ]
          },
          {
              "sku": "lbb-bissap",
              "name": "Jus de bissap",
              "category": "Boissons froides",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "boisson",
                  "bissap"
              ]
          },
          {
              "sku": "lbb-gingembre",
              "name": "Jus de gingembre",
              "category": "Boissons froides",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "boisson",
                  "gingembre"
              ]
          },
          {
              "sku": "lbb-gini",
              "name": "Gini",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "soda"
              ]
          },
          {
              "sku": "lbb-red-bull",
              "name": "Red Bull",
              "category": "Boissons froides",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "boisson",
                  "energy"
              ]
          },
          {
              "sku": "lbb-jus-tomate",
              "name": "Jus de tomate",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "jus"
              ]
          }
      ],
      "menuItems": [
          {
              "sku": "lbb-tilapia-braise",
              "name": "Tilapia braisé",
              "category": "Grillades",
              "price": 17,
              "priceEUR": 17,
              "amount": 1700,
              "tags": [
                  "poisson",
                  "grillade"
              ]
          },
          {
              "sku": "lbb-malangwa-braise",
              "name": "Malangwa braisé",
              "category": "Grillades",
              "price": 18,
              "priceEUR": 18,
              "amount": 1800,
              "tags": [
                  "poisson",
                  "grillade"
              ]
          },
          {
              "sku": "lbb-porc-braise",
              "name": "Porc braisé",
              "category": "Grillades",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "porc",
                  "grillade"
              ]
          },
          {
              "sku": "lbb-poulet-braise",
              "name": "Poulet braisé",
              "category": "Grillades",
              "price": 17,
              "priceEUR": 17,
              "amount": 1700,
              "tags": [
                  "poulet",
                  "grillade"
              ]
          },
          {
              "sku": "lbb-thompson-braise",
              "name": "Thompson braisé",
              "category": "Grillades",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "poisson",
                  "grillade"
              ]
          },
          {
              "sku": "lbb-chevre-grillee",
              "name": "Chèvre grillée",
              "category": "Grillades",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "chevre",
                  "grillade"
              ]
          },
          {
              "sku": "lbb-ndole-poisson",
              "name": "Ndolé poisson",
              "category": "Légumes",
              "price": 17,
              "priceEUR": 17,
              "amount": 1700,
              "tags": [
                  "ndole",
                  "poisson"
              ]
          },
          {
              "sku": "lbb-bitekuteku",
              "name": "Bitekuteku",
              "category": "Légumes",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "legumes"
              ]
          },
          {
              "sku": "lbb-pondu",
              "name": "Pondu",
              "category": "Légumes",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "manioc",
                  "legumes"
              ]
          },
          {
              "sku": "lbb-fumbwa",
              "name": "Fumbwa",
              "category": "Légumes",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "legumes"
              ]
          },
          {
              "sku": "lbb-bitole-legumes",
              "name": "Bitolé légumes",
              "category": "Légumes",
              "price": 18,
              "priceEUR": 18,
              "amount": 1800,
              "tags": [
                  "legumes"
              ]
          },
          {
              "sku": "lbb-ndole-viande",
              "name": "Ndolé viande",
              "category": "Légumes",
              "price": 15,
              "priceEUR": 15,
              "amount": 1500,
              "tags": [
                  "ndole",
                  "viande"
              ]
          },
          {
              "sku": "lbb-ndole-crevettes",
              "name": "Ndolé crevettes",
              "category": "Légumes",
              "price": 18,
              "priceEUR": 18,
              "amount": 1800,
              "tags": [
                  "ndole",
                  "crevettes"
              ]
          },
          {
              "sku": "lbb-epinards",
              "name": "Épinards",
              "category": "Légumes",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "legumes"
              ]
          },
          {
              "sku": "lbb-sauce-arachide",
              "name": "Sauce arachide · viande ou poulet",
              "category": "Sauces",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "arachide",
                  "sauce"
              ]
          },
          {
              "sku": "lbb-sauce-tomate",
              "name": "Sauce tomate · viande, poulet ou poisson",
              "category": "Sauces",
              "price": 12,
              "priceEUR": 12,
              "amount": 1200,
              "tags": [
                  "tomate",
                  "sauce"
              ]
          },
          {
              "sku": "lbb-mouambe-poulet",
              "name": "Mouambé poulet",
              "category": "Sauces",
              "price": 15,
              "priceEUR": 15,
              "amount": 1500,
              "tags": [
                  "poulet",
                  "mouambe"
              ]
          },
          {
              "sku": "lbb-bolognaise-spaghetti",
              "name": "Bolognaise · spaghetti",
              "category": "Sauces",
              "price": 10,
              "priceEUR": 10,
              "amount": 1000,
              "tags": [
                  "pates",
                  "sauce"
              ]
          },
          {
              "sku": "lbb-riz",
              "name": "Riz",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-frites",
              "name": "Frites",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-pomme-de-terre",
              "name": "Pomme de terre",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-manioc",
              "name": "Manioc",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-banane-plantain",
              "name": "Banane plantain",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "plantain",
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-foutou-manioc",
              "name": "Foutou manioc",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "manioc",
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-semoule",
              "name": "Semoule",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-baton-manioc",
              "name": "Bâton de manioc",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "manioc",
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-attieke",
              "name": "Attiéké",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "manioc",
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-croquettes",
              "name": "Croquettes",
              "category": "Accompagnements",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "accompagnement"
              ]
          },
          {
              "sku": "lbb-expresso",
              "name": "Expresso",
              "category": "Boissons chaudes",
              "price": 2.5,
              "priceEUR": 2.5,
              "amount": 250,
              "tags": [
                  "boisson",
                  "cafe"
              ]
          },
          {
              "sku": "lbb-cappuccino",
              "name": "Cappuccino",
              "category": "Boissons chaudes",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "cafe"
              ]
          },
          {
              "sku": "lbb-chocolat-chaud-froid",
              "name": "Chocolat chaud / froid",
              "category": "Boissons chaudes",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson"
              ]
          },
          {
              "sku": "lbb-lait-russe",
              "name": "Lait russe",
              "category": "Boissons chaudes",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson"
              ]
          },
          {
              "sku": "lbb-the-nature-citron",
              "name": "Thé nature / citron",
              "category": "Boissons chaudes",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "the"
              ]
          },
          {
              "sku": "lbb-infusion",
              "name": "Infusion · green tea citron, camomille ou menthe",
              "category": "Boissons chaudes",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "boisson",
                  "infusion"
              ]
          },
          {
              "sku": "lbb-gingembre-chaud",
              "name": "Gingembre chaud",
              "category": "Boissons chaudes",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "boisson",
                  "gingembre"
              ]
          },
          {
              "sku": "lbb-looza",
              "name": "Looza · pomme, ananas, pêche ou orange",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "jus"
              ]
          },
          {
              "sku": "lbb-sprite-fanta-schweppes",
              "name": "Sprite / Fanta / Schweppes",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "soda"
              ]
          },
          {
              "sku": "lbb-coca-cola",
              "name": "Coca-Cola · normal, zero ou light",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "soda"
              ]
          },
          {
              "sku": "lbb-ice-tea",
              "name": "Ice Tea",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson"
              ]
          },
          {
              "sku": "lbb-spa-25",
              "name": "Spa 25 cl",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "eau"
              ]
          },
          {
              "sku": "lbb-spa-1l",
              "name": "Spa 1 L",
              "category": "Boissons froides",
              "price": 5,
              "priceEUR": 5,
              "amount": 500,
              "tags": [
                  "boisson",
                  "eau"
              ]
          },
          {
              "sku": "lbb-bissap",
              "name": "Jus de bissap",
              "category": "Boissons froides",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "boisson",
                  "bissap"
              ]
          },
          {
              "sku": "lbb-gingembre",
              "name": "Jus de gingembre",
              "category": "Boissons froides",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "boisson",
                  "gingembre"
              ]
          },
          {
              "sku": "lbb-gini",
              "name": "Gini",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "soda"
              ]
          },
          {
              "sku": "lbb-red-bull",
              "name": "Red Bull",
              "category": "Boissons froides",
              "price": 4,
              "priceEUR": 4,
              "amount": 400,
              "tags": [
                  "boisson",
                  "energy"
              ]
          },
          {
              "sku": "lbb-jus-tomate",
              "name": "Jus de tomate",
              "category": "Boissons froides",
              "price": 3,
              "priceEUR": 3,
              "amount": 300,
              "tags": [
                  "boisson",
                  "jus"
              ]
          }
      ]
  },
  {
    "id": "p2",
    "name": "Afro Bowl",
    "slug": "afro-bowl",
    "city": "Bruxelles",
    "country": "Belgique",
    "cuisine": "Pan-africain",
    "cuisines": [
      "Pan-africain",
      "Bowl",
      "Street-food"
    ],
    "rating": 4.6,
    "status": "placeholder",
    "featured": false,
    "description": "Partenaire placeholder pour tester les listes restaurants avant onboarding réel."
  },
  {
    "id": "p3",
    "name": "Toukoul",
    "slug": "toukoul",
    "city": "Bruxelles",
    "country": "Belgique",
    "cuisine": "Éthiopien",
    "cuisines": [
      "Éthiopien"
    ],
    "rating": 4.7,
    "status": "placeholder",
    "featured": false,
    "description": "Partenaire placeholder pour tester filtres, cartes et navigation."
  },
  {
    "id": "p4",
    "name": "Café Béguin",
    "slug": "cafe-beguin",
    "city": "Bruxelles",
    "country": "Belgique",
    "cuisine": "Afro-européen",
    "cuisines": [
      "Afro-européen",
      "Fusion"
    ],
    "rating": 4.5,
    "status": "placeholder",
    "featured": false,
    "description": "Partenaire placeholder masqué en démo externe tant que l’onboarding n’est pas validé."
  }
];

const BRUSSELS_WEEKDAYS = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
] as const;

function normalizedWeekday(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function currentBrusselsAvailability(): { date: string; day: string } {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('fr-BE', {
      timeZone: 'Europe/Brussels',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
    }).formatToParts(now);
    const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      date: `${lookup.year}-${lookup.month}-${lookup.day}`,
      day: normalizedWeekday(lookup.weekday),
    };
  } catch {
    return {
      date: now.toISOString().slice(0, 10),
      day: BRUSSELS_WEEKDAYS[now.getDay()] || 'dimanche',
    };
  }
}

function withMenuAvailability(item: Record<string, any>, clock: { date: string; day: string }) {
  const scheduledDay = normalizedWeekday(item?.day) || null;
  const orderableNow = !scheduledDay || scheduledDay === clock.day;
  return {
    ...item,
    orderableNow,
    availability: {
      mode: scheduledDay ? 'weekday' : 'always',
      orderableNow,
      scheduledDay,
      today: clock.day,
      date: clock.date,
      reason: orderableNow ? 'available_today' : 'scheduled_for_another_day',
      label: scheduledDay ? `Disponible ${scheduledDay}` : 'Disponible tous les jours',
    },
  };
}

function withPartnerOrderPolicy<T extends Record<string, any>>(partner: T): T {
  const minimumOrderAmount = minimumOrderAmountCents(partner?.slug);
  const clock = currentBrusselsAvailability();
  const rawMenu = Array.isArray(partner?.menuItems)
    ? partner.menuItems
    : Array.isArray(partner?.menu)
      ? partner.menu
      : [];
  const menuItems = rawMenu.map((item: Record<string, any>) => withMenuAvailability(item, clock));

  return {
    ...partner,
    menu: menuItems,
    menuItems,
    availability: {
      timeZone: 'Europe/Brussels',
      date: clock.date,
      day: clock.day,
    },
    delivery: {
      ...(partner?.delivery || {}),
      ...(minimumOrderAmount > 0 ? { minimumOrderAmount } : {}),
    },
  } as T;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true, rawBody: true });

  // Canonique (v1)
  app.setGlobalPrefix('api/v1');

  const port = parseInt(process.env.PORT || '3010', 10);

  // ✅ Aliases Express pour compat apps (health + partners)
  const server = app.getHttpAdapter().getInstance();
  const catalogFoundation = app.get(CatalogFoundationService);

  await catalogFoundation.initialize(partners);

  const healthHandler = (_req: any, res: any) => res.status(200).json({ status: 'ok' });

  server.get('/health', healthHandler);
  server.get('/api/health', healthHandler);
  // /api/v1/health est déjà servi par Nest via le prefix + controller, mais on le redonne aussi en alias safe
  server.get('/api/v1/health', healthHandler);

  const partnersHandler = async (_req: any, res: any) => {
    const published = await catalogFoundation.listPublished(partners);
    return res.status(200).json(
      published.map((partner) => withPartnerOrderPolicy(partner)),
    );
  };

  server.get('/partners', partnersHandler);
  server.get('/api/partners', partnersHandler);
  server.get('/api/v1/partners', partnersHandler);

  server.get(['/partners/:slug', '/api/partners/:slug', '/api/v1/partners/:slug'], async (req: any, res: any) => {
    const partner = await catalogFoundation.findPublishedBySlug(String(req.params.slug || ''), partners);
    if (!partner) return res.status(404).json({ message: 'partner_not_found' });
    return res.status(200).json(withPartnerOrderPolicy(partner));
  });

  await app.listen(port, '0.0.0.0');
  console.log(`[API] OK on http://127.0.0.1:${port} (health: /health | /api/health | /api/v1/health)`);
}
bootstrap();
