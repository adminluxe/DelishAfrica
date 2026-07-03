import { Body, Controller, Post } from '@nestjs/common';
import {
  createDemoOrder,
  getDemoOrder,
  listDemoOrders,
  resetDemoOrders,
  updateDemoOrderStatus,
} from './orders.demo.store';

type AnyRecord = Record<string, any>;

function resetResponse() {
  resetDemoOrders();

  return {
    ok: true,
    message: 'demo reset ok',
    count: 0,
    orders: [],
    items: [],
    data: [],
  };
}

function createResponse(body: AnyRecord = {}) {
  const order = createDemoOrder(body);

  return {
    ok: true,
    order,
    id: order.id,
    orderId: order.orderId,
  };
}

function listResponse(body: AnyRecord = {}) {
  const orders = listDemoOrders(body);

  return {
    ok: true,
    count: orders.length,
    orders,
    items: orders,
    data: orders,
  };
}

function getResponse(body: AnyRecord = {}) {
  const id = body.id ?? body.orderId;
  const order = getDemoOrder(id);

  if (!order) {
    return {
      ok: false,
      error: 'order_not_found',
      id,
      orderId: id,
      order: null,
    };
  }

  return {
    ok: true,
    order,
    id: order.id,
    orderId: order.orderId,
  };
}

function statusResponse(body: AnyRecord = {}) {
  const order = updateDemoOrderStatus(body);

  if (!order) {
    return {
      ok: false,
      error: 'order_not_found',
      id: body.id,
      orderId: body.orderId,
      order: null,
    };
  }

  return {
    ok: true,
    order,
    id: order.id,
    orderId: order.orderId,
    status: order.status,
  };
}

@Controller('orders')
export class OrdersController {
  @Post('demo/reset')
  reset() {
    return resetResponse();
  }

  @Post('demo/create')
  create(@Body() body: AnyRecord = {}) {
    return createResponse(body);
  }

  @Post('demo/list')
  list(@Body() body: AnyRecord = {}) {
    return listResponse(body);
  }

  @Post('demo/get')
  get(@Body() body: AnyRecord = {}) {
    return getResponse(body);
  }

  @Post('demo/status')
  status(@Body() body: AnyRecord = {}) {
    return statusResponse(body);
  }
}
