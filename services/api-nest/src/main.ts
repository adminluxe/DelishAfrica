import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // Canonique (v1)
  app.setGlobalPrefix('api/v1');

  const port = parseInt(process.env.PORT || '3010', 10);

  // ✅ Aliases Express pour compat apps (health + partners)
  const server = app.getHttpAdapter().getInstance();

  const healthHandler = (_req: any, res: any) => res.status(200).json({ status: 'ok' });

  server.get('/health', healthHandler);
  server.get('/api/health', healthHandler);
  // /api/v1/health est déjà servi par Nest via le prefix + controller, mais on le redonne aussi en alias safe
  server.get('/api/v1/health', healthHandler);

  server.get('/partners', (_req: any, res: any) => res.status(200).json(partners));
  server.get('/api/partners', (_req: any, res: any) => res.status(200).json(partners));
  server.get('/api/v1/partners', (_req: any, res: any) => res.status(200).json(partners));

  server.get(['/partners/:slug', '/api/partners/:slug', '/api/v1/partners/:slug'], (req: any, res: any) => {
    const p = partners.find(x => x.slug === req.params.slug);
    if (!p) return res.status(404).json({ message: 'partner_not_found' });
    return res.status(200).json(p);
  });

  await app.listen(port, '0.0.0.0');
  console.log(`[API] OK on http://127.0.0.1:${port} (health: /health | /api/health | /api/v1/health)`);
}
bootstrap();
