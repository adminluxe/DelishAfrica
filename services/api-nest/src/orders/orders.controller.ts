import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { UpdateOrderStatusDto } from './dto/update-status.dto';
import type { OrderStatus } from './orders.types';

/**
 * IMPORTANT:
 * - On ne met PAS "api/" dans les paths internes,
 * - On expose 2 bases pour compat:
 *    - /orders
 *    - /api/orders
 * Le globalPrefix (ex: /api/v1) s'applique au-dessus.
 * => Ça donne /api/v1/orders ET /api/v1/api/orders (compat)
 */
@Controller(['orders', 'api/orders'])
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('_demo/reset')
  reset() {
    this.orders.resetForDemo();
    this.orders.seedThieypDemo();
    return { ok: true };
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    const order = this.orders.create(dto as any);
    return { orderId: order.id, status: order.status, order };
  }

  @Get()
  list(@Query('status') status?: OrderStatus, @Query('partnerSlug') partnerSlug?: string) {
    return this.orders.list({ status, partnerSlug });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    const order = this.orders.getById(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    const order = this.orders.updateStatus(id, (dto as any).status);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
