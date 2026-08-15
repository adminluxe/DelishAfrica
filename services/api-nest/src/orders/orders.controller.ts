import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { OrdersAccessService } from './orders.access.service';
import { OrdersDispatchService } from './orders.dispatch.service';
import { OrdersAuthGuard } from './orders.auth.guard';
import type { OrdersRequest } from './orders.access.types';
import {
  createDemoOrder,
  getDemoOrder,
  listDemoOrders,
  resetDemoOrders,
  updateDemoOrderStatus,
} from './orders.demo.store';
import {
  canonicalGetInterceptor,
  canonicalListInterceptor,
} from './orders.canonical.response';

type AnyRecord = Record<string, any>;

@Controller('orders')
@UseGuards(OrdersAuthGuard)
export class OrdersController {
  constructor(
    private readonly access: OrdersAccessService,
    private readonly dispatch: OrdersDispatchService,
  ) {}

  @Post(['reset', 'demo/reset'])
  reset(@Req() request: OrdersRequest) {
    const principal = this.access.principal(request);
    this.access.requireOps(principal);
    resetDemoOrders();
    return { ok: true, message: 'demo reset ok', count: 0, orders: [], items: [], data: [] };
  }

  @Post(['create', 'demo/create'])
  async create(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    const principal = this.access.principal(request);
    const requestedId = this.access.requestedId(body);
    const existing = requestedId ? getDemoOrder(requestedId) : null;
    const secured = await this.access.secureCreateInput(principal, body, existing);
    if (existing) {
      return {
        ok: true,
        order: existing,
        id: existing.id,
        orderId: existing.orderId,
        idempotentReplay: true,
      };
    }
    const order = createDemoOrder(secured);
    return {
      ok: true,
      order,
      id: order.id,
      orderId: order.orderId,
      idempotentReplay: false,
    };
  }

  @Post(['list', 'demo/list'])
  @UseInterceptors(canonicalListInterceptor)
  async list(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    const principal = this.access.principal(request);
    const orders = await this.access.visibleOrders(principal, listDemoOrders(body));
    return { ok: true, count: orders.length, orders, items: orders, data: orders };
  }

  @Post(['get', 'demo/get'])
  @UseInterceptors(canonicalGetInterceptor)
  async get(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    const principal = this.access.principal(request);
    const id = body.id ?? body.orderId ?? body.publicId;
    const order = await this.access.requireReadable(principal, getDemoOrder(id));
    return { ok: true, order, id: order.id, orderId: order.orderId };
  }

  @Post(['status', 'demo/status'])
  async status(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    const principal = this.access.principal(request);
    const id = body.id ?? body.orderId ?? body.publicId;
    await this.access.requireStatusTransition(principal, getDemoOrder(id), body.status);
    const order = updateDemoOrderStatus(body);
    if (!order) throw new Error('order_disappeared_during_status_update');
    const dispatched = String(order.status || '').toLowerCase() === 'ready'
      ? await this.dispatch.onOrderReady(order)
      : order;
    return { ok: true, order: dispatched, id: dispatched.id, orderId: dispatched.orderId, status: dispatched.status };
  }

  @Post(['courier/presence', 'demo/courier/presence'])
  courierPresence(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    return this.dispatch.heartbeat(this.access.principal(request), body);
  }

  @Post(['courier/offers', 'demo/courier/offers'])
  courierOffers(@Req() request: OrdersRequest) {
    return this.dispatch.offers(this.access.principal(request));
  }

  @Post(['courier/offers/accept', 'demo/courier/offers/accept'])
  courierAccept(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    return this.dispatch.accept(this.access.principal(request), body);
  }

  @Post(['courier/offers/reject', 'demo/courier/offers/reject'])
  courierReject(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    return this.dispatch.reject(this.access.principal(request), body);
  }
}
