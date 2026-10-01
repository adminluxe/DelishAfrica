import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FinancialStateRepository } from '../financial-state/financial-state.repository';
import { OrdersAccessService } from './orders.access.service';
import { OrdersDispatchService } from './orders.dispatch.service';
import { OrdersAuthGuard } from './orders.auth.guard';
import type { OrdersRequest } from './orders.access.types';
import {
  createDemoOrder,
  getDemoOrder,
  resetDemoOrders,
  updateDemoOrderStatus,
} from './orders.demo.store';
import {
  canonicalGetInterceptor,
  canonicalListInterceptor,
} from './orders.canonical.response';

type AnyRecord = Record<string, any>;

function matchesListFilter(order: AnyRecord, body: AnyRecord): boolean {
  const wantedStatus = String(body?.status || '').trim().toLowerCase();
  if (wantedStatus && String(order?.status || '').toLowerCase() !== wantedStatus) {
    return false;
  }

  const wantedMerchant = String(
    body?.merchantSlug || body?.partnerSlug || body?.partner || '',
  ).trim().toLowerCase();
  if (wantedMerchant) {
    const current = String(
      order?.merchantSlug || order?.partnerSlug || '',
    ).trim().toLowerCase();
    if (current && current !== wantedMerchant) return false;
  }

  return true;
}

@Controller('orders')
@UseGuards(OrdersAuthGuard)
export class OrdersController {
  constructor(
    private readonly access: OrdersAccessService,
    private readonly dispatch: OrdersDispatchService,
    private readonly financialState: FinancialStateRepository,
  ) {}

  @Post(['reset', 'demo/reset'])
  async reset(@Req() request: OrdersRequest) {
    const principal = this.access.principal(request);
    this.access.requireOps(principal);
    resetDemoOrders();
    await this.financialState.resetOrders();
    return {
      ok: true,
      message: 'orders reset ok',
      authority: 'postgres',
      count: 0,
      orders: [],
      items: [],
      data: [],
    };
  }

  @Post(['create', 'demo/create'])
  async create(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    const principal = this.access.principal(request);
    const requestedId = this.access.requestedId(body);
    const existing = requestedId
      ? await this.financialState.findOrder(requestedId)
      : null;

    const secured = await this.access.secureCreateInput(principal, body, existing);
    if (existing) {
      return {
        ok: true,
        order: existing,
        id: existing.id,
        orderId: existing.orderId,
        idempotentReplay: true,
        authority: 'postgres',
      };
    }

    const order = createDemoOrder(secured);
    await this.financialState.upsertOrder(order);

    return {
      ok: true,
      order,
      id: order.id,
      orderId: order.orderId,
      idempotentReplay: false,
      authority: 'postgres',
    };
  }

  @Post(['list', 'demo/list'])
  @UseInterceptors(canonicalListInterceptor)
  async list(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    const principal = this.access.principal(request);
    const source = (await this.financialState.listOrders()).filter((order) =>
      matchesListFilter(order, body),
    );
    const orders = await this.access.visibleOrders(principal, source);
    return {
      ok: true,
      authority: 'postgres',
      count: orders.length,
      orders,
      items: orders,
      data: orders,
    };
  }

  @Post(['get', 'demo/get'])
  @UseInterceptors(canonicalGetInterceptor)
  async get(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    const principal = this.access.principal(request);
    const id = body.id ?? body.orderId ?? body.publicId;
    const found = await this.financialState.findOrder(String(id || ''));
    const order = await this.access.requireReadable(principal, found);
    return {
      ok: true,
      authority: 'postgres',
      order,
      id: order.id,
      orderId: order.orderId,
    };
  }

  @Post(['status', 'demo/status'])
  async status(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    const principal = this.access.principal(request);
    const id = String(body.id ?? body.orderId ?? body.publicId ?? '').trim();
    const existing = await this.financialState.findOrder(id);
    await this.access.requireStatusTransition(principal, existing, body.status);

    if (existing && !getDemoOrder(id)) {
      createDemoOrder(existing);
    }

    const order = updateDemoOrderStatus(body);
    if (!order) throw new Error('order_disappeared_during_status_update');

    const dispatched = String(order.status || '').toLowerCase() === 'ready'
      ? await this.dispatch.onOrderReady(order)
      : order;

    await this.financialState.upsertOrder(dispatched);

    return {
      ok: true,
      authority: 'postgres',
      order: dispatched,
      id: dispatched.id,
      orderId: dispatched.orderId,
      status: dispatched.status,
    };
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
