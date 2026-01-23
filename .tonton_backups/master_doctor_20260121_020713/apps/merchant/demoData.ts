export type DemoOrder = {
  id: string;
  customerName: string;
  address: string;
  items: { name: string; quantity: number }[];
  total: string;
  etaPickup: string;
};

export const demoOrders: DemoOrder[] = [
  {
    id: 'DA-1001',
    customerName: 'Amélie K.',
    address: 'Rue du Midi 45, Bruxelles',
    items: [
      { name: 'Poulet braisé + attiéké', quantity: 2 },
      { name: 'Bissap', quantity: 2 },
    ],
    total: '42,80 €',
    etaPickup: 'Coursier dans 8 min',
  },
  {
    id: 'DA-1002',
    customerName: 'Nicolas B.',
    address: 'Avenue de la Couronne 120, Ixelles',
    items: [
      { name: 'Jollof rice & poulet', quantity: 1 },
      { name: 'Suya grillé', quantity: 1 },
    ],
    total: '27,40 €',
    etaPickup: 'Coursier dans 12 min',
  },
  {
    id: 'DA-1003',
    customerName: 'Fatou S.',
    address: 'Chaussée de Mons 200, Bruxelles',
    items: [{ name: 'Ndolé & plantain', quantity: 2 }],
    total: '31,80 €',
    etaPickup: 'Coursier en approche',
  },
];

export const getOrderById = (id: string) =>
  demoOrders.find((o) => o.id === id);
