import { Injectable } from '@nestjs/common';
import type { CourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import { createBelgiumEmployeeLabPolicy } from './adapters/belgium';
import { createFranceIndependentReferencePolicy } from './adapters/france';
import { FileCourierPayrollLedger } from './file-ledger-repository';
import {
  assertCourierFairPayLabEnabled,
  courierFairPayLabEnabled,
} from './lab-config';
import { assertSingleIsoWeek } from './iso-week';
import { sealCountryPayPolicy } from './policy-ledger';
import { runClockNormalizationJob } from './clock-normalization-job';
import { runWeeklyCalculationJob } from './weekly-calculation-job';
import { buildRuntimeOrderClockEvents } from './runtime-producer-adapters';

const POLICY_BE = 'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1';
const POLICY_FR = 'FR-INDEPENDENT-ARPE-2026-09-01-v1';

@Injectable()
export class CourierPayrollRuntimeBridge {
  private ledgerInstance: FileCourierPayrollLedger | null = null;

  enabled(): boolean {
    return courierFairPayLabEnabled();
  }

  status() {
    if (!this.enabled()) {
      return {
        enabled: false,
        productionWiring: false,
        counts: null,
      };
    }
    const config = this.runtimeConfig();
    return {
      enabled: true,
      productionWiring: false,
      countryCode: config.countryCode,
      policyId: config.policyId,
      counts: this.ledger().counts(),
    };
  }

  bootstrapActivePolicy(sealedBy = 'delish-runtime') {
    assertCourierFairPayLabEnabled();
    const config = this.runtimeConfig();
    return this.bootstrapKnownPolicy(config.policyId, sealedBy);
  }

  captureOrder(order: Record<string, any>) {
    if (!this.enabled()) {
      return {
        enabled: false as const,
        ok: true as const,
        recorded: 0,
        replayed: 0,
        normalization: null,
      };
    }

    try {
      this.bootstrapActivePolicy('delish-orders-runtime');
      const observed = this.observeOrder(order);
      return {
        ok: true as const,
        ...observed,
      };
    } catch (error) {
      return {
        enabled: true as const,
        ok: false as const,
        recorded: 0,
        replayed: 0,
        normalization: null,
        error:
          error instanceof Error
            ? error.message
            : 'COURIER_PAYROLL_RUNTIME_CAPTURE_FAILED',
      };
    }
  }

  bootstrapKnownPolicy(policyId: string, sealedBy: string) {
    assertCourierFairPayLabEnabled();
    const ledger = this.ledger();
    const existing = ledger.getPolicy(policyId);
    if (existing) {
      return {
        policy: existing,
        persistence: { inserted: false, idempotentReplay: true },
      };
    }

    const policy =
      policyId === POLICY_BE
        ? createBelgiumEmployeeLabPolicy()
        : policyId === POLICY_FR
          ? createFranceIndependentReferencePolicy()
          : null;

    if (!policy) throw new Error('COURIER_PAYROLL_UNKNOWN_POLICY_BOOTSTRAP');
    const config = this.runtimeConfig();
    if (config.policyId !== policyId) {
      throw new Error('COURIER_PAYROLL_ACTIVE_POLICY_MISMATCH');
    }
    if (config.countryCode !== policy.countryCode) {
      throw new Error('COURIER_PAYROLL_ACTIVE_COUNTRY_MISMATCH');
    }

    const sealed = sealCountryPayPolicy(
      policy,
      new Date().toISOString(),
      sealedBy,
    );
    return {
      policy: sealed,
      persistence: ledger.appendPolicy(sealed),
    };
  }

  observeOrder(order: Record<string, any>) {
    if (!this.enabled()) {
      return { enabled: false, recorded: 0, normalization: null };
    }

    const config = this.runtimeConfig();
    const ledger = this.ledger();
    const policy = ledger.getPolicy(config.policyId);
    if (!policy) throw new Error('COURIER_PAYROLL_LAB_POLICY_NOT_BOOTSTRAPPED');

    const proposal = order.assignmentProposal || {};
    const courierId = String(proposal.courierId || '').trim();
    const acceptedAt = String(proposal.acceptedAt || '').trim();
    if (!courierId || !acceptedAt) {
      return { enabled: true, recorded: 0, normalization: null };
    }

    const timestamps = [
      acceptedAt,
      order.readyAt,
      order.courierArrivedPickupAt,
      order.pickedUpAt,
      order.deliveredAt,
    ]
      .filter((value) => typeof value === 'string' && value.trim())
      .map(String);

    const weekKey = assertSingleIsoWeek(
      timestamps,
      policy.policy.payrollTimeZone,
    );
    const events = buildRuntimeOrderClockEvents(order, {
      countryCode: config.countryCode,
      weekKey,
      policyId: config.policyId,
      courierId,
      missionId: `${String(order.id || order.orderId || order.publicId)}:delivery`,
      ...(Number.isSafeInteger(order.payrollActivityEstimateSeconds)
        ? { estimatedActivitySeconds: order.payrollActivityEstimateSeconds }
        : {}),
    });

    const writes = ledger.appendClockEvents(events);
    const normalization = runClockNormalizationJob(
      ledger,
      courierId,
      weekKey,
      config.policyId,
    );

    return {
      enabled: true,
      recorded: writes.filter((item) => item.inserted).length,
      replayed: writes.filter((item) => item.idempotentReplay).length,
      weekKey,
      normalization,
    };
  }

  appendMonetaryFact(fact: CourierPayrollFact) {
    assertCourierFairPayLabEnabled();
    const config = this.runtimeConfig();
    if (fact.countryCode.toUpperCase() !== config.countryCode) {
      throw new Error('COURIER_PAYROLL_MONEY_COUNTRY_MISMATCH');
    }
    if (fact.policyId !== config.policyId) {
      throw new Error('COURIER_PAYROLL_MONEY_POLICY_MISMATCH');
    }
    return this.ledger().appendFact(fact);
  }

  calculateWeek(courierId: string, weekKey: string) {
    assertCourierFairPayLabEnabled();
    const config = this.runtimeConfig();
    const ledger = this.ledger();
    const policy = ledger.getPolicy(config.policyId);
    if (!policy) throw new Error('COURIER_PAYROLL_LAB_POLICY_NOT_BOOTSTRAPPED');

    const normalization = runClockNormalizationJob(
      ledger,
      courierId,
      weekKey,
      config.policyId,
    );
    if (!normalization.complete) {
      return {
        finalizable: false as const,
        normalization,
        statement: null,
      };
    }

    const calculation = runWeeklyCalculationJob(ledger, {
      courierId,
      weekKey,
      sealedPolicy: policy,
      mode: 'LAB',
    });
    return {
      finalizable: true as const,
      normalization,
      ...calculation,
    };
  }

  getStatement(statementId: string) {
    assertCourierFairPayLabEnabled();
    return this.ledger().getStatement(statementId);
  }

  private ledger(): FileCourierPayrollLedger {
    if (!this.ledgerInstance) {
      const rootDir = String(
        process.env.DA_COURIER_FAIR_PAY_LAB_LEDGER_DIR ||
          '.runtime/courier-fair-pay-lab-ledger',
      ).trim();
      if (!rootDir) throw new Error('COURIER_PAYROLL_LAB_LEDGER_DIR_REQUIRED');
      this.ledgerInstance = new FileCourierPayrollLedger({ rootDir });
    }
    return this.ledgerInstance;
  }

  private runtimeConfig() {
    assertCourierFairPayLabEnabled();
    const countryCode = String(
      process.env.DA_COURIER_FAIR_PAY_COUNTRY_CODE || '',
    )
      .trim()
      .toUpperCase();
    const policyId = String(
      process.env.DA_COURIER_FAIR_PAY_POLICY_ID || '',
    ).trim();

    if (!countryCode) {
      throw new Error('COURIER_PAYROLL_ACTIVE_COUNTRY_REQUIRED');
    }
    if (!policyId) {
      throw new Error('COURIER_PAYROLL_ACTIVE_POLICY_REQUIRED');
    }

    return { countryCode, policyId };
  }
}
