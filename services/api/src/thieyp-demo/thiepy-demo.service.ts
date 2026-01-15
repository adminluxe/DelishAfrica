import { Injectable } from '@nestjs/common';
import { CreateDemoOrderDto } from './dto/create-demo-order.dto';
import { DemoOrder } from './entities/demo-order.entity';

@Injectable()
export class ThiepyDemoService {
  private orders: DemoOrder[] = [];

  private ensureDefaultOrder(): void {
    if (this.orders.length === 0) {
      this.create({});
    }
  }

  create(dto: CreateDemoOrderDto): DemoOrder {
    const id = `THIEYP-DEMO-${this.orders.length + 1}`;
    const now = new Date().toISOString();

    const order: DemoOrder = {
      id,
      createdAt: now,
      status: 'pending',
      restaurantSlug: 'thieyp',
      restaurantName: 'Thiepy – Démo',
      customerName: dto.customerName ?? 'Client démo',
      customerAddress: dto.customerAddress ?? 'Adresse de démonstration',
      totalAmount: dto.totalAmount ?? 19.9,
      currency: dto.currency ?? 'EUR',
    };

    this.orders.unshift(order);
    return order;
  }

  findAll(): DemoOrder[] {
    this.ensureDefaultOrder();
    return this.orders;
  }
}
