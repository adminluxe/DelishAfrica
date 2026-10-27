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

  @Post('segments/start')
  segmentStart(
    @Req() request: OrdersRequest,
    @Body() body: AnyRecord = {},
  ) {
    const principal = this.requireOps(request);
    this.requireEnabled();
    return {
      ok: true,
      labOnly: true,
      ...this.recordPaidSegmentBoundary(body, 'STARTED', principal.subject),
    };
  }

  @Post('segments/end')
  segmentEnd(
    @Req() request: OrdersRequest,
    @Body() body: AnyRecord = {},
  ) {
    const principal = this.requireOps(request);
    this.requireEnabled();
    return {
      ok: true,
      labOnly: true,
      ...this.recordPaidSegmentBoundary(body, 'ENDED', principal.subject),
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

  @Post('courier/statements')
  courierStatements(
    @Req() request: OrdersRequest,
    @Body() body: AnyRecord = {},
  ) {
    const principal = this.requireCourier(request);
    this.requireEnabled();
    const weekKey = String(body.weekKey || '').trim() || undefined;
    const courierId = this.access.courierId(principal);
    const statements = this.bridge.listStatementsForCourier(courierId, weekKey);
    return {
      ok: true,
      labOnly: true,
      courierId,
      statements,
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

  private recordPaidSegmentBoundary(
    body: AnyRecord,
    boundary: 'STARTED' | 'ENDED',
    operatorSubject: string,
  ) {
    const familyRaw = String(body.family || '').trim().toUpperCase();
    const family =
      familyRaw === 'REPOSITION'
        ? 'REPOSITION'
        : familyRaw === 'OTHER_PAID'
          ? 'OTHER_PAID'
          : null;
    const courierId = String(body.courierId || '').trim();
    const segmentId = String(body.segmentId || '').trim();
    const occurredAt = String(body.occurredAt || '').trim();
    if (
      !family ||
      !courierId ||
      !segmentId ||
      !occurredAt ||
      !Number.isFinite(Date.parse(occurredAt))
    ) {
      throw new ForbiddenException({
        ok: false,
        code: 'courier_payroll_paid_segment_input_invalid',
      });
    }
    const suppliedEvidence = Array.isArray(body.evidenceRefs)
      ? body.evidenceRefs
      : [];
    const evidenceRefs = [
      ...suppliedEvidence.map((value: unknown) => String(value || '').trim()),
      'ops-subject:' + String(operatorSubject || '').trim(),
    ].filter(Boolean);
    return this.bridge.recordExplicitPaidSegmentBoundary({
      family,
      boundary,
      courierId,
      segmentId,
      occurredAt,
      evidenceRefs,
      ...(body.orderId ? { orderId: String(body.orderId).trim() } : {}),
      ...(body.missionId ? { missionId: String(body.missionId).trim() } : {}),
    });
  }

  private requireCourier(request: OrdersRequest) {
    const principal = this.access.principal(request);
    if (principal.role !== 'courier') {
      throw new ForbiddenException({
        ok: false,
        code: 'courier_payroll_courier_role_required',
      });
    }
    return principal;
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
