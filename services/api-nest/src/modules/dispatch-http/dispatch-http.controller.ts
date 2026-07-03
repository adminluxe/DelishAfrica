import { Controller, Get, Query } from '@nestjs/common';
import { OrdersService } from '../../orders/orders.service';

type AnyOrder = Record<string, any>;

function norm(v: any): string {
  return String(v ?? '').trim().toLowerCase();
}

function toMission(order: AnyOrder) {
  if (!order) return null;

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

@Controller(['/dispatch', '/api/dispatch'])
export class DispatchHttpController {
  constructor(private readonly orders: OrdersService) {}

  @Get('active')
  active(@Query('partnerSlug') partnerSlug?: string) {
    const all = this.orders.list({ partnerSlug } as any) as AnyOrder[];

    const activeOrder =
      all.find((o) => ['ready', 'accepted', 'picked_up'].includes(norm(o.status))) ??
      null;

    return {
      ok: true,
      active: toMission(activeOrder),
      source: 'orders',
    };
  }
}
