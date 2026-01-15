export type DemoMissionStage = 'pending' | 'ongoing' | 'completed';

export type DemoMission = {
  id: string;
  restaurantName: string;
  pickupAddress: string;
  dropoffAddress: string;
  distance: string;
  price: string;
  eta: string;
};

export const demoMissions: DemoMission[] = [
  {
    id: 'brux-001',
    restaurantName: 'Mama Africa',
    pickupAddress: 'Chaussée de Wavre 123, Ixelles',
    dropoffAddress: 'Rue du Bailli 45, Bruxelles',
    distance: '2,4 km',
    price: '7,50 €',
    eta: '12 min',
  },
  {
    id: 'brux-002',
    restaurantName: 'Lagos Street Food',
    pickupAddress: 'Boulevard Anspach 200, Bruxelles',
    dropoffAddress: 'Avenue Louise 90, Ixelles',
    distance: '3,1 km',
    price: '8,20 €',
    eta: '15 min',
  },
  {
    id: 'brux-003',
    restaurantName: 'Douala Corner',
    pickupAddress: 'Place Flagey 8, Ixelles',
    dropoffAddress: 'Rue de la Loi 155, Bruxelles',
    distance: '4,0 km',
    price: '9,10 €',
    eta: '19 min',
  },
];

export const getMissionById = (id: string) =>
  demoMissions.find((m) => m.id === id);
