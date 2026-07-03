import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { OrdersService } from '../../orders/orders.service';

type AnyOrder = Record<string, any>;

function norm(v: any): string {
  return String(v ?? '').trim().toLowerCase();
}

function wantedStatuses(status?: string): string[] {
  if (status && status.trim()) {
    return status
      .split(',')
      .map((s) => norm(s))
      .filter(Boolean);
  }

  return ['ready', 'accepted', 'picked_up'];
}

function toMission(order: AnyOrder) {
  return {
    id: order.id,
    orderId: order.id,
    partnerSlug: order.partnerSlug,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress ?? null,
    pickup: {
      partnerSlug: order.partnerSlug,
      name: order.partnerName ?? order.partnerSlug ?? 'Merchant',
      address: order.pickupAddress ?? null,
    },
    dropoff: {
      name: order.customerName ?? 'Client',
      phone: order.customerPhone ?? null,
      address: order.customerAddress ?? null,
    },
    items: order.items ?? [],
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    order,
  };
}

@Controller(['/missions', '/api/missions'])
export class MissionsHttpController {
  constructor(private readonly orders: OrdersService) {}

  private listMissionOrders(partnerSlug?: string, status?: string): AnyOrder[] {
    const all = this.orders.list({ partnerSlug } as any) as AnyOrder[];
    const wanted = wantedStatuses(status);
    return all.filter((o) => wanted.includes(norm(o.status)));
  }

  @Get()
  list(@Query('status') status?: string, @Query('partnerSlug') partnerSlug?: string) {
    const items = this.listMissionOrders(partnerSlug, status).map(toMission);

    return {
      ok: true,
      items,
      count: items.length,
      source: 'orders',
    };
  }

  @Patch(':id/accept')
  accept(@Param('id') id: string) {
    const order = this.orders.updateStatus(id, 'accepted' as any);
    if (!order) return { ok: false, error: 'not_found' };
    return { ok: true, mission: toMission(order), source: 'orders' };
  }

  @Patch(':id/pickup')
  pickup(@Param('id') id: string) {
    const order = this.orders.updateStatus(id, 'picked_up' as any);
    if (!order) return { ok: false, error: 'not_found' };
    return { ok: true, mission: toMission(order), source: 'orders' };
  }

  @Patch(':id/delivered')
  delivered(@Param('id') id: string) {
    const order = this.orders.updateStatus(id, 'delivered' as any);
    if (!order) return { ok: false, error: 'not_found' };
    return { ok: true, mission: toMission(order), source: 'orders' };
  }
}
