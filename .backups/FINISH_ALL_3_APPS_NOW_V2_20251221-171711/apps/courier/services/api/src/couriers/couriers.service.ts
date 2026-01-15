// services/api/src/couriers/couriers.service.ts
import { Injectable } from '@nestjs/common';

type Status =
  | 'available'
  | 'accepted'
  | 'assigned'
  | 'picked_up'
  | 'en_route'
  | 'delivered'
  | 'canceled';

type Job = {
  id: string;
  merchant: string;
  pickup: { address: string; lat?: number; lng?: number };
  dropoff: { address: string; lat?: number; lng?: number };
  distanceKm: number;
  etaMin: number;
  payout: number;
  status: Status;
  courierId?: string | null;
};

@Injectable()
export class CouriersService {
  private jobs: Job[] = [];
  private static pos = new Map<string, { lat: number; lng: number; ts: number }>();

  constructor() {
    this.resetDemoData();
  }

  // -------- SEED DEMO ----------
  async resetDemoData(): Promise<void> {
    this.jobs = [
      {
        id: 'job_demo_0001',
        merchant: 'Demo Resto',
        // Coordonnées réalistes Brussels (démo)
        pickup:  { lat: 50.8467, lng: 4.3525, address: 'Rue Test 1, 1000 Bruxelles' },
        dropoff: { lat: 50.8505, lng: 4.3488, address: 'Grand-Place, 1000 Bruxelles' },
        distanceKm: 2.8,
        etaMin: 12,
        payout: 6.2,
        status: 'available',
        courierId: null,
      },
    ];
  }

  // -------- QUERIES ----------
  async getAvailableJobs(): Promise<Job[]> {
    return this.jobs.filter((j) => j.status === 'available');
  }

  async getMyJobs(courierId: string): Promise<Job[]> {
    return this.jobs.filter((j) => j.courierId === courierId && j.status !== 'delivered');
  }

  private getById(id: string): Job {
    const j = this.jobs.find((x) => x.id === id);
    if (!j) throw new Error('not_found');
    return j;
    }

  // -------- TRANSITIONS ----------
  private transition(id: string, from: Status[], to: Status, courierId?: string) {
    const j = this.getById(id);
    if (!from.includes(j.status)) {
      return { ok: false, id, status: 'invalid_state' as Status };
    }
    j.status = to;
    if (courierId) j.courierId = courierId;
    return { ok: true as const, id, status: j.status, payout: j.payout, etaMin: j.etaMin };
  }

  async acceptJob(jobId: string, courierId: string) {
    return this.transition(jobId, ['available'], 'accepted', courierId);
  }
  async assignJob(jobId: string, courierId: string) {
    return this.transition(jobId, ['accepted'], 'assigned', courierId);
  }
  async markPickedUp(jobId: string, courierId: string) {
    return this.transition(jobId, ['assigned'], 'picked_up', courierId);
  }
  async startDelivery(jobId: string, courierId: string) {
    return this.transition(jobId, ['picked_up'], 'en_route', courierId);
  }
  async markDelivered(jobId: string, courierId: string) {
    return this.transition(jobId, ['en_route'], 'delivered', courierId);
  }

  // -------- POSITION ----------
  async upsertPosition(courierId: string, lat: number, lng: number, ts: number) {
    CouriersService.pos.set(courierId, { lat, lng, ts });
  }
  getPosition(courierId: string) {
    return CouriersService.pos.get(courierId) ?? null;
  }
}
