import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { DaAuthPrincipal } from '../auth/auth.types';
import { CourierPresenceService, type CourierPresenceRecord } from './courier-presence.service';
import { OrdersAccessService } from './orders.access.service';
import {
  acceptDemoOrderCourier,
  getDemoOrder,
  listDemoOrders,
  proposeDemoOrderCourier,
  rejectDemoOrderCourier,
  releaseDemoOrderCourierAssignment,
  type AnyOrder,
} from './orders.demo.store';

const OFFER_TTL_MS = 90_000;
const RECENT_REJECTION_MS = 5 * 60_000;
const BRUSSELS = new Set([
  'bruxelles', 'brussels', 'brussel', 'auderghem', 'oudergem', 'ixelles', 'elsene',
  'etterbeek', 'schaerbeek', 'schaarbeek', 'uccle', 'ukkel', 'forest', 'vorst',
  'saint-gilles', 'sint-gillis', 'molenbeek', 'anderlecht', 'woluwe', 'jette',
  'evere', 'koekelberg', 'berchem', 'ganshoren', 'watermael', 'boitsfort',
]);

function clean(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function norm(value: unknown): string {
  return clean(value).toLowerCase();
}

function publicId(order: AnyOrder | null): string {
  return clean(order?.publicId || order?.orderId || order?.id);
}

function status(order: AnyOrder | null): string {
  return norm(order?.status);
}

@Injectable()
export class OrdersDispatchService {
  constructor(
    private readonly presence: CourierPresenceService,
    private readonly access: OrdersAccessService,
  ) {}

  async heartbeat(principal: DaAuthPrincipal, body: Record<string, any> = {}) {
    const record = this.presence.heartbeat(principal, body);
    await this.reconcileReadyOrders();
    const orders = await this.access.visibleOrders(principal, listDemoOrders());
    return {
      ok: true,
      service: 'server_dispatch',
      presence: record,
      offers: orders.filter((order) => ['ready', 'picked_up'].includes(status(order))),
    };
  }

  async offers(principal: DaAuthPrincipal) {
    if (principal.role !== 'courier') {
      throw new ForbiddenException({ ok: false, code: 'courier_role_required' });
    }
    const orders = await this.access.visibleOrders(principal, listDemoOrders());
    return { ok: true, count: orders.length, orders, items: orders, data: orders };
  }

  async accept(principal: DaAuthPrincipal, body: Record<string, any> = {}) {
    if (principal.role !== 'courier') {
      throw new ForbiddenException({ ok: false, code: 'courier_role_required' });
    }
    const orderId = this.access.requestedId(body);
    const courierId = this.presence.courierId(principal);
    const order = acceptDemoOrderCourier({
      orderId,
      courierId,
      confirmed: true,
      source: 'courier-offer-inbox',
      decisionMode: 'courier_confirmed',
    });
    if (!order) throw new NotFoundException({ ok: false, code: 'dispatch_offer_not_found' });
    return { ok: true, order, proposal: order.assignmentProposal, status: order.status };
  }

  async reject(principal: DaAuthPrincipal, body: Record<string, any> = {}) {
    if (principal.role !== 'courier') {
      throw new ForbiddenException({ ok: false, code: 'courier_role_required' });
    }
    const orderId = this.access.requestedId(body);
    const courierId = this.presence.courierId(principal);
    const order = rejectDemoOrderCourier({ orderId, courierId, reason: clean(body.reason || 'courier_declined') });
    if (!order) throw new NotFoundException({ ok: false, code: 'dispatch_offer_not_found' });
    const next = await this.offerOrder(order);
    return { ok: true, order: next, rejectedBy: courierId };
  }

  async onOrderReady(order: AnyOrder): Promise<AnyOrder> {
    return this.offerOrder(order);
  }

  async reconcileReadyOrders(): Promise<void> {
    for (const order of listDemoOrders().filter((item) => status(item) === 'ready')) {
      await this.offerOrder(order);
    }
  }

  private async offerOrder(input: AnyOrder): Promise<AnyOrder> {
    const id = publicId(input);
    let order = getDemoOrder(id) || input;
    if (status(order) !== 'ready') return order;

    const proposal = order.assignmentProposal || null;
    const proposalStatus = norm(proposal?.status);
    const assignedId = clean(proposal?.courierId);
    const source = norm(proposal?.source || proposal?.acceptedSource);
    const expiresAt = proposal?.expiresAt ? new Date(proposal.expiresAt).getTime() : 0;

    if (proposalStatus === 'accepted') {
      const legacySelfDispatch = source.includes('courier-route-oracle') || norm(proposal?.decisionMode) === 'human_confirmed';
      if (!legacySelfDispatch || this.presence.isActive(assignedId)) return order;
      order = releaseDemoOrderCourierAssignment({ orderId: id, courierId: assignedId, reason: 'legacy_self_dispatch_released' }) || order;
    } else if (proposalStatus === 'proposed') {
      const stillValid = expiresAt > Date.now() && this.presence.isActive(assignedId);
      if (stillValid) return order;
      order = releaseDemoOrderCourierAssignment({ orderId: id, courierId: assignedId, reason: 'offer_expired_or_courier_offline' }) || order;
    }

    const candidates = this.rankCandidates(order);
    const selected = candidates[0];
    if (!selected) return order;

    const now = Date.now();
    return proposeDemoOrderCourier({
      orderId: id,
      courierId: selected.record.courierId,
      courierName: selected.record.name,
      source: 'server-dispatch',
      decisionMode: 'system_offer',
      previewVersion: 'r9disp2_server_authority_v1',
      score: selected.score,
      confidence: selected.confidence,
      totalEtaMin: selected.eta,
      expiresAt: new Date(now + OFFER_TTL_MS).toISOString(),
      territoryKey: selected.zone,
      offerAttempt: this.offerAttempt(order),
      confirmed: true,
    }) || order;
  }

  private rankCandidates(order: AnyOrder): Array<{ record: CourierPresenceRecord; score: number; confidence: number; eta: number; zone: string }> {
    const orderZone = this.orderZone(order);
    const rejected = this.recentRejectedCourierIds(order);
    return this.presence.active()
      .filter((record) => !rejected.has(record.courierId))
      .map((record) => {
        const activeMissions = this.activeMissionCount(record.courierId);
        const candidateZone = this.zoneKey(record.activeZone || record.city, record.countryCode);
        const zoneCompatible = !orderZone || !candidateZone || orderZone === candidateZone;
        const capacityAvailable = activeMissions < Math.max(1, record.capacity);
        if (!zoneCompatible || !capacityAvailable) return null;
        const freshnessSec = Math.max(0, (Date.now() - new Date(record.lastSeenAt).getTime()) / 1000);
        const freshness = Math.max(0, 30 - Math.min(30, freshnessSec / 3));
        const capacity = Math.max(0, 25 - activeMissions * 12);
        const zone = orderZone && candidateZone === orderZone ? 35 : 15;
        const score = Math.round(Math.min(100, 10 + freshness + capacity + zone));
        const eta = Math.max(5, 18 - Math.min(8, Math.round(score / 15)));
        return { record, score, confidence: Math.max(70, score), eta, zone: candidateZone || orderZone || 'unknown' };
      })
      .filter((item): item is { record: CourierPresenceRecord; score: number; confidence: number; eta: number; zone: string } => Boolean(item))
      .sort((a, b) => b.score - a.score || a.eta - b.eta || a.record.courierId.localeCompare(b.record.courierId));
  }

  private activeMissionCount(courierId: string): number {
    return listDemoOrders().filter((order) => {
      const proposal = order.assignmentProposal || null;
      return ['ready', 'picked_up'].includes(status(order))
        && norm(proposal?.status) === 'accepted'
        && clean(proposal?.courierId) === courierId;
    }).length;
  }

  private recentRejectedCourierIds(order: AnyOrder): Set<string> {
    const cutoff = Date.now() - RECENT_REJECTION_MS;
    const rejected = new Set<string>();
    const timeline = Array.isArray(order.timeline) ? order.timeline : [];
    for (const entry of timeline) {
      if (norm(entry?.label) !== 'courier_rejected') continue;
      const at = new Date(entry?.at || entry?.changedAt || 0).getTime();
      if (at >= cutoff && entry?.courierId) rejected.add(clean(entry.courierId));
    }
    return rejected;
  }

  private offerAttempt(order: AnyOrder): number {
    const timeline = Array.isArray(order.timeline) ? order.timeline : [];
    return 1 + timeline.filter((entry) => norm(entry?.label) === 'courier_proposed').length;
  }

  private orderZone(order: AnyOrder): string {
    const city = clean(
      order?.restaurantCity
      || order?.merchantCity
      || order?.customer?.city
      || order?.deliveryCity
      || order?.city,
    );
    const country = clean(order?.countryCode || order?.customer?.countryCode || order?.deliveryCountryCode);
    return this.zoneKey(city, country || (/belg/i.test(clean(order?.deliveryAddress)) ? 'BE' : ''));
  }

  private zoneKey(cityValue: unknown, countryValue: unknown): string {
    const city = norm(cityValue);
    const country = clean(countryValue).toUpperCase();
    if (BRUSSELS.has(city) || Array.from(BRUSSELS).some((name) => city.includes(name))) return 'BE:BRUSSELS';
    if (country && city) return `${country}:${city}`;
    if (country) return country;
    return city;
  }
}
