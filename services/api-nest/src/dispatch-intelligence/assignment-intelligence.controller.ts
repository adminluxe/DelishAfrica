import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from '@nestjs/common';
import { OrdersAccessService } from '../orders/orders.access.service';
import type { OrdersRequest } from '../orders/orders.access.types';
import { OrdersAuthGuard } from '../orders/orders.auth.guard';
import { getDemoOrder } from '../orders/orders.demo.store';
import { AssignmentIntelligenceService } from './assignment-intelligence.service';
import type { AssignmentAcceptInput, AssignmentPreviewInput, AssignmentProposeInput } from './assignment-intelligence.types';

@Controller('dispatch/assignment')
@UseGuards(OrdersAuthGuard)
export class AssignmentIntelligenceController {
  constructor(
    private readonly assignmentIntelligence: AssignmentIntelligenceService,
    private readonly access: OrdersAccessService,
  ) {}

  @Post('preview')
  async preview(@Req() request: OrdersRequest, @Body() body: AssignmentPreviewInput = {}) {
    const principal = this.access.principal(request);
    const orderId = String(body.orderId || body.publicId || body.id || '').trim();
    if (orderId) await this.access.requireReadable(principal, getDemoOrder(orderId));
    else this.access.requireOps(principal);
    return this.assignmentIntelligence.preview(body || {});
  }

  @Post('accept')
  accept(@Req() request: OrdersRequest, @Body() body: AssignmentAcceptInput = {}) {
    const principal = this.access.principal(request);
    if (principal.role !== 'courier') {
      throw new ForbiddenException({ ok: false, code: 'courier_role_required' });
    }
    return this.assignmentIntelligence.accept({
      ...body,
      courierId: this.access.courierId(principal),
      confirmed: true,
      source: 'courier-authenticated-offer',
      decisionMode: 'courier_confirmed',
    });
  }

  @Post('propose')
  propose(@Req() request: OrdersRequest, @Body() body: AssignmentProposeInput = {}) {
    const principal = this.access.principal(request);
    this.access.requireOps(principal);
    return this.assignmentIntelligence.propose({ ...body, source: 'ops-dispatch-console' });
  }
}
