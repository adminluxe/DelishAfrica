export type DemoMissionStatus = 'pending' | 'accepted' | 'in_progress' | 'completed';

export type DemoMission = {
  id: string;
  title: string;
  restaurantName: string;
  pickupAddress: string;
  dropoffAddress: string;
  amount: string;
  distanceKm: number;
  etaMin: number;
  status: DemoMissionStatus;
};

export const demoMissions: DemoMission[] = [
  {
    id: 'demo-ixelles-eu-1',
    title: 'Commande #DA-1324 – Yassa poulet + Bissap',
    restaurantName: 'Mama Yassa Matonge',
    pickupAddress: 'Chaussée de Wavre 214, 1050 Ixelles',
    dropoffAddress: 'Rue de la Loi 155, 1040 Bruxelles',
    amount: '18,90 €',
    distanceKm: 3.4,
    etaMin: 14,
    status: 'pending',
  },
  {
    id: 'demo-molenbeek-centre-2',
    title: 'Commande #DA-2210 – Ndolé + Plantains',
    restaurantName: 'Saveurs du Cameroun',
    pickupAddress: 'Boulevard Léopold II 80, 1080 Molenbeek',
    dropoffAddress: 'Boulevard Anspach 24, 1000 Bruxelles',
    amount: '26,50 €',
    distanceKm: 4.1,
    etaMin: 18,
    status: 'pending',
  },
  {
    id: 'demo-ixelles-ucl-3',
    title: 'Commande #DA-3058 – Thieb + Jus de gingembre',
    restaurantName: 'Teranga Matonge',
    pickupAddress: 'Rue de la Paix 25, 1050 Ixelles',
    dropoffAddress: 'Avenue Emmanuel Mounier 50, 1200 Bruxelles',
    amount: '22,30 €',
    distanceKm: 6.2,
    etaMin: 24,
    status: 'pending',
  },
];

export default function DemoMissionsScreenStub() {
  // Stub : ce fichier sert uniquement de source de données, pas d'écran.
  return null;
}
