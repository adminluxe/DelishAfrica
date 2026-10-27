import {
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrdersAccessService } from '../orders/orders.access.service';
import type { OrdersRequest } from '../orders/orders.access.types';
import { OrdersAuthGuard } from '../orders/orders.auth.guard';
import { CourierPayrollRuntimeBridge } from './runtime-bridge.service';

type AnyRecord = Record<string, any>;

@Controller('courier-payroll/lab')
@UseGuards(OrdersAuthGuard)
export class CourierPayrollLabController {
  constructor(
    private readonly access: OrdersAccessService,
    private readonly bridge: CourierPayrollRuntimeBridge,
  ) {}

  @Post('status')
  status(@Req() request: OrdersRequest) {
    this.requireOps(request);
    return {
      ok: true,
      labOnly: true,
      ...this.bridge.status(),
    };
  }

  @Post('bootstrap')
  bootstrap(@Req() request: OrdersRequest) {
    const principal = this.requireOps(request);
    this.requireEnabled();
    const result = this.bridge.bootstrapActivePolicy(
      'ops:' + String(principal.subject || principal.role),
    );
    return {
      ok: true,
      labOnly: true,
      ...result,
    };
  }

  @Post('calculate')
  calculate(
    @Req() request: OrdersRequest,
    @Body() body: AnyRecord = {},
  ) {
    this.requireOps(request);
    this.requireEnabled();
    const courierId = String(body.courierId || '').trim();
    const weekKey = String(body.weekKey || '').trim();
    if (!courierId || !weekKey) {
      throw new ForbiddenException({
        ok: false,
        code: 'courier_payroll_lab_calculation_scope_required',
      });
    }
    return {
      ok: true,
      labOnly: true,
      ...this.bridge.calculateWeek(courierId, weekKey),
    };
  }

  @Post('orchidpay/preview')
  orchidPayPreview(
    @Req() request: OrdersRequest,
    @Body() body: AnyRecord = {},
  ) {
    this.requireOps(request);
    this.requireEnabled();
    const statementId = String(body.statementId || '').trim();
    if (!statementId) {
      throw new ForbiddenException({
        ok: false,
        code: 'courier_payroll_statement_id_required',
      });
    }
    const generatedAt = String(body.generatedAt || '').trim() || new Date().toISOString();
    return {
      ok: true,
      labOnly: true,
      sent: false,
      intent: this.bridge.buildOrchidPayShadowIntent(statementId, generatedAt),
    };
  }

  @Post('orchidpay/send-shadow')
  async orchidPaySendShadow(
    @Req() request: OrdersRequest,
    @Body() body: AnyRecord = {},
  ) {
    this.requireOps(request);
    this.requireEnabled();
    const statementId = String(body.statementId || '').trim();
    if (!statementId) {
      throw new ForbiddenException({
        ok: false,
        code: 'courier_payroll_statement_id_required',
      });
    }
    const generatedAt = String(body.generatedAt || '').trim() || new Date().toISOString();
    return {
      ok: true,
      labOnly: true,
      ...(await this.bridge.sendOrchidPayShadowIntent(statementId, generatedAt)),
    };
  }

  @Post('statement')
  statement(
    @Req() request: OrdersRequest,
    @Body() body: AnyRecord = {},
  ) {
    this.requireOps(request);
    this.requireEnabled();
    const statementId = String(body.statementId || '').trim();
    if (!statementId) {
      throw new ForbiddenException({
        ok: false,
        code: 'courier_payroll_statement_id_required',
      });
    }
    const statement = this.bridge.getStatement(statementId);
    if (!statement) {
      throw new NotFoundException({
        ok: false,
        code: 'courier_payroll_statement_not_found',
      });
    }
    return {
      ok: true,
      labOnly: true,
      statement,
    };
  }

  private requireOps(request: OrdersRequest) {
    const principal = this.access.principal(request);
    this.access.requireOps(principal);
    return principal;
  }

  private requireEnabled(): void {
    if (!this.bridge.enabled()) {
      throw new ForbiddenException({
        ok: false,
        code: 'courier_fair_pay_lab_disabled',
      });
    }
  }
}
