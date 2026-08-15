import { Body, Controller, Post } from '@nestjs/common';
import {
  createDemoOrder,
  getDemoOrder,
  listDemoOrders,
  resetDemoOrders,
  updateDemoOrderStatus,
} from './orders.demo.store';
import { UseInterceptors } from "@nestjs/common";
import { canonicalGetInterceptor, canonicalListInterceptor } from "./orders.canonical.response";



type AnyRecord = Record<string, any>;

@Controller('orders/demo')
export class OrdersDemoFlowController {
  @Post('reset')
  reset() {
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

  @Post('create')
  create(@Body() body: AnyRecord = {}) {
    const order = createDemoOrder(body);

    return {
      ok: true,
      order,
      id: order.id,
      orderId: order.orderId,
    };
  }

  @Post('list')
  @UseInterceptors(canonicalListInterceptor)
  list(@Body() body: AnyRecord = {}) {
    const orders = listDemoOrders(body);

    return {
      ok: true,
      count: orders.length,
      orders,
      items: orders,
      data: orders,
    };
  }

  @Post('get')
  @UseInterceptors(canonicalGetInterceptor)
  get(@Body() body: AnyRecord = {}) {
    const id = body.id ?? body.orderId;
    const order = getDemoOrder(id);

    if (!order) {
      return {
        ok: false,
        error: 'order_not_found',
        id,
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

  @Post('status')
  status(@Body() body: AnyRecord = {}) {
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
}

export class OrdersDemoFlowApiController extends OrdersDemoFlowController {}

export class OrdersDemoFlowUnderscoreController extends OrdersDemoFlowController {}

export class OrdersDemoFlowUnderscoreApiController extends OrdersDemoFlowController {}
