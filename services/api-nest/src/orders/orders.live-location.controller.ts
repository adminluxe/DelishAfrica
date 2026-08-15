import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { OrdersAccessService } from './orders.access.service';
import { OrdersAuthGuard } from './orders.auth.guard';
import type { OrdersRequest } from './orders.access.types';
import { getDemoOrder } from './orders.demo.store';
import {
  getDemoOrderLiveLocation,
  publishDemoOrderLiveLocation,
  stopDemoOrderLiveLocation,
} from './orders.live-location.store';

type AnyRecord = Record<string, any>;

@Controller(['orders/location', 'orders/demo/location'])
@UseGuards(OrdersAuthGuard)
export class OrdersLiveLocationController {
  constructor(private readonly access: OrdersAccessService) {}

  @Post('publish')
  @HttpCode(200)
  publish(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    const principal = this.access.principal(request);
    const id = body.orderId ?? body.publicId ?? body.id;
    this.access.requireLivePublisher(principal, getDemoOrder(id));
    return publishDemoOrderLiveLocation({
      ...body,
      courierId: this.access.courierId(principal),
      courierName: principal.name,
    });
  }

  @Post('get')
  @HttpCode(200)
  async get(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    const principal = this.access.principal(request);
    const id = body.orderId ?? body.publicId ?? body.id;
    await this.access.requireLiveRead(principal, getDemoOrder(id));
    return getDemoOrderLiveLocation(body);
  }

  @Post('stop')
  @HttpCode(200)
  stop(@Req() request: OrdersRequest, @Body() body: AnyRecord = {}) {
    const principal = this.access.principal(request);
    const id = body.orderId ?? body.publicId ?? body.id;
    this.access.requireLivePublisher(principal, getDemoOrder(id));
    return stopDemoOrderLiveLocation({
      ...body,
      courierId: this.access.courierId(principal),
    });
  }
}
