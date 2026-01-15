import { Injectable } from '@nestjs/common';

@Injectable()
export class CourierPlatformService {
  getCouriers() {
    return [
      { id: 'c_demo_001', displayName: 'Thieyp', city: 'Bruxelles', rating: 4.8, status: 'active', vehicle: 'scooter' },
      { id: 'c_demo_002', displayName: 'Afrosian', city: 'Bruxelles', rating: 4.6, status: 'active', vehicle: 'bike' },
    ];
  }

  getMe() {
    return { id: 'c_demo_001', displayName: 'Thieyp', status: 'active', role: 'courier' };
  }

  getActiveDispatch() {
    return {
      id: 'm_demo_001',
      status: 'assigned',
      restaurant: { id: 'r_demo_thieyp', name: 'Thieyp', city: 'Bruxelles' },
      customer: { id: 'u_demo_001', name: 'Client', city: 'Bruxelles' },
      pickup: { label: 'Thieyp', city: 'Bruxelles' },
      dropoff: { label: 'Client', city: 'Bruxelles' },
      timeline: ['assigned', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered'],
    };
  }

  getMissions() {
    return [this.getActiveDispatch()];
  }
}
