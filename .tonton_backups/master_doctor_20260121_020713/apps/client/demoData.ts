// app/demoData.ts
export type DemoDish = {
  id: string;
  name: string;
  description: string;
  price: string;
};

export type DemoRestaurant = {
  id: string;
  name: string;
  city: string;
  description: string;
  dishes: DemoDish[];
};

export const demoRestaurants: DemoRestaurant[] = [
  {
    id: 'mama-africa',
    name: 'Mama Africa',
    city: 'Bruxelles',
    description: 'Poulet braisé, attiéké, sauces ivoiriennes, ambiance chaleureuse.',
    dishes: [
      {
        id: 'ma-1',
        name: 'Poulet braisé + attiéké',
        description: 'Poulet mariné, braisé au charbon, servi avec attiéké et légumes.',
        price: '16,90 €',
      },
      {
        id: 'ma-2',
        name: 'Sauce graine & riz',
        description: 'Sauce graine maison, riz parfumé.',
        price: '13,50 €',
      },
    ],
  },
  {
    id: 'lagos-street-food',
    name: 'Lagos Street Food',
    city: 'Bruxelles',
    description: 'Jollof rice, suya grillé, street vibes nigérianes.',
    dishes: [
      {
        id: 'lsf-1',
        name: 'Jollof rice & poulet',
        description: 'Riz jollof fumé, poulet épicé, salade fraîche.',
        price: '14,90 €',
      },
      {
        id: 'lsf-2',
        name: 'Brochettes de suya',
        description: 'Bœuf mariné, grillé, servi avec oignons & piment.',
        price: '11,50 €',
      },
    ],
  },
  {
    id: 'douala-corner',
    name: 'Douala Corner',
    city: 'Bruxelles',
    description: 'Ndolé, plantain doré, grillades et sonorités camerounaises.',
    dishes: [
      {
        id: 'dc-1',
        name: 'Ndolé & plantain mûr',
        description: 'Feuilles de ndolé, arachide, crevettes, plantain frit.',
        price: '15,90 €',
      },
      {
        id: 'dc-2',
        name: 'Brochettes de poisson braisé',
        description: 'Poisson grillé, légumes, plantain.',
        price: '17,50 €',
      },
    ],
  },
];

export const getRestaurantById = (id: string) =>
  demoRestaurants.find(r => r.id === id);
