// services/api/src/couriers/couriers.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { CouriersService } from './couriers.service';

type Status =
  | 'available'
  | 'accepted'
  | 'assigned'
  | 'picked_up'
  | 'en_route'
  | 'delivered'
  | 'canceled';

class UpdatePositionDto {
  lat!: number;
  lng!: number;
  ts?: number;
}

@Controller('couriers')
export class CouriersController {
  constructor(private readonly svc: CouriersService) {}

  @Get('jobs/available')
  async getAvailableJobs() {
    const items = await this.svc.getAvailableJobs();
    return { ok: true, items };
  }

  @Get('my')
  async getMyJobs(@Req() req: Request) {
    const courierId =
      (req.headers['x-courier-id'] as string) || 'demo_courier_0001';
    const items = await this.svc.getMyJobs(courierId);
    return { ok: true, items };
  }

  @Post('reset')
  async resetDemo() {
    await this.svc.resetDemoData();
    return { ok: true };
  }

  @Post('seed-demo')
  async seedDemo() {
    await this.svc.resetDemoData();
    return { ok: true };
  }

  @Post('jobs/:id/accept')
  async accept(@Param('id') id: string, @Req() req: Request) {
    const courierId =
      (req.headers['x-courier-id'] as string) || 'demo_courier_0001';
    const res = await this.svc.acceptJob(id, courierId);
    return this.okOrThrow(res, 'accepted');
  }

  @Post('jobs/:id/assign')
  async assign(@Param('id') id: string, @Req() req: Request) {
    const courierId =
      (req.headers['x-courier-id'] as string) || 'demo_courier_0001';
    const res = await this.svc.assignJob(id, courierId);
    return this.okOrThrow(res, 'assigned');
  }

  @Post('jobs/:id/pickup')
  async pickup(@Param('id') id: string, @Req() req: Request) {
    const courierId =
      (req.headers['x-courier-id'] as string) || 'demo_courier_0001';
    const res = await this.svc.markPickedUp(id, courierId);
    return this.okOrThrow(res, 'picked_up');
  }

  @Post('jobs/:id/start')
  async start(@Param('id') id: string, @Req() req: Request) {
    const courierId =
      (req.headers['x-courier-id'] as string) || 'demo_courier_0001';
    const res = await this.svc.startDelivery(id, courierId);
    return this.okOrThrow(res, 'en_route');
  }

  @Post('jobs/:id/delivered')
  async delivered(@Param('id') id: string, @Req() req: Request) {
    const courierId =
      (req.headers['x-courier-id'] as string) || 'demo_courier_0001';
    const res = await this.svc.markDelivered(id, courierId);
    return this.okOrThrow(res, 'delivered');
  }

  // NEW: upsert de la position du coursier
  @Post('position')
  async updatePosition(@Body() body: UpdatePositionDto, @Req() req: Request) {
    const courierId =
      (req.headers['x-courier-id'] as string) || 'demo_courier_0001';
    const { lat, lng, ts } = body || ({} as any);
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new HttpException(
        { ok: false, message: 'lat/lng requis' },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.svc.upsertPosition(courierId, lat, lng, ts ?? Date.now());
    return { ok: true };
  }

  // Helper uniforme pour mutations
  private okOrThrow(
    res: { ok?: boolean; id?: string; status?: Status; [k: string]: any } | null,
    expected?: Status,
  ) {
    if (!res || res.ok === false) {
      throw new HttpException(
        { ok: false, status: res?.status ?? 'KO' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (expected && res.status !== expected) res.status = expected;
    return { ok: true, id: res.id, status: res.status, ...res };
  }
}
