import { Injectable } from '@nestjs/common';
import type { Order, OrderStatus } from './orders.types';
import { randomUUID } from 'crypto';
import type { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  private orders: Order[] = [];

  resetForDemo() { this.orders = []; }

  seedThieypDemo() {
    if (this.orders.length) return;
    const now = new Date().toISOString();
    this.orders.push({
      id: randomUUID(),
      partnerSlug: 'thieyp',
      status: 'pending',
      items: [
        { sku: 'thieyp-yassa-001', name: 'Yassa Poulet', qty: 1, unitPrice: 14.9 },
        { sku: 'thieyp-bissap-001', name: 'Bissap', qty: 2, unitPrice: 3.5 }
      ],
      notes: 'Démo – seed',
      customerName: 'Client Démo',
      customerPhone: '+000000000',
      createdAt: now,
      updatedAt: now
    });
  }

  create(dto: CreateOrderDto): Order {
    const now = new Date().toISOString();
    const order: Order = {
      id: randomUUID(),
      partnerSlug: dto.partnerSlug,
      status: 'pending',
      items: dto.items.map(i => ({ ...i })),
      notes: dto.notes,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      createdAt: now,
      updatedAt: now
    };
    this.orders.unshift(order);
    return order;
  }

  list(filters?: { status?: OrderStatus; partnerSlug?: string }): Order[] {
    return this.orders.filter(o => {
      if (filters?.status && o.status !== filters.status) return false;
      if (filters?.partnerSlug && o.partnerSlug !== filters.partnerSlug) return false;
      return true;
    });
  }

  getById(id: string) { return this.orders.find(o => o.id === id); }

  updateStatus(id: string, status: OrderStatus) {
    const o = this.getById(id);
    if (!o) return undefined;
    o.status = status;
    o.updatedAt = new Date().toISOString();
    return o;
  }
}
