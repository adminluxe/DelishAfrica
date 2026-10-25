/**
 * DelishAfrica F4N / 2026-10-14 — financial read-only QA HTTP adapter.
 *
 * This controller is intentionally NOT imported by AppModule.
 * A disposable test harness may provide FINANCE_READONLY_QA_PORT using the
 * existing QaWalletVerifiedSessionBridge (Keycloak signed JWT + live session
 * + tenant membership + separate attestor + PG row-locked authority).
 *
 * Never mount this controller on the public production API.
 * No wallet writes, bank instructions, Stripe, payout, or admin credentials.
 */
import {
  ConflictException, Controller, ForbiddenException, Get, Header, Inject,
  Req, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import type { QaVerifiedWalletRead } from
  './merchant-courier-wallet-signed-session.pg-qa.bridge';

export const FINANCE_READONLY_QA_PORT =
  Symbol('FINANCE_READONLY_QA_PORT');
/**
 * A PRIVATE trusted QA attestor may classify an already-verified denial.
 * Never trust an HTTP-provided string, JWT claim or body as this error kind.
 * Generic and unknown errors always fail closed as 503.
 */
export class FinanceReadonlyQaPortError extends Error {
  constructor(
    readonly kind: 'unauthenticated' | 'forbidden' | 'conflict' | 'unavailable',
  ) {
    super('finance_qa_port_denied');
  }
}

export type FinanceReadonlyQaPort = Readonly<{
  readWallet: (
    authorization: unknown, limit?: number,
  ) => Promise<QaVerifiedWalletRead>;
}>;

function positiveMinor(raw: unknown): number {
  if ((typeof raw !== 'string' && typeof raw !== 'number') ||
      (typeof raw === 'string' && !/^\d{1,15}$/.test(raw))) {
    throw new Error('finance_invalid_amount');
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('finance_invalid_amount');
  }
  return value;
}
const deny = (): never => {
  throw new ServiceUnavailableException({
    ok: false, code: 'finance_not_certified_for_public_use',
  });
};
const typedDenial = (error: unknown): never => {
  if (error instanceof FinanceReadonlyQaPortError) {
    if (error.kind === 'unauthenticated') {
      throw new UnauthorizedException({
        ok: false, code: 'finance_qa_session_unverified',
      });
    }
    if (error.kind === 'forbidden') {
      throw new ForbiddenException({
        ok: false, code: 'finance_qa_scope_denied',
      });
    }
    if (error.kind === 'conflict') {
      throw new ConflictException({
        ok: false, code: 'finance_qa_identity_conflict',
      });
    }
  }
  // Do not leak detailed SQL, Keycloak, tenant or ledger error diagnostics.
  return deny();
};

@Controller('qa-isolated/partner-finance/v1')
export class PartnerFinanceReadonlyQaController {
  constructor(
    @Inject(FINANCE_READONLY_QA_PORT)
    private readonly reader: FinanceReadonlyQaPort,
  ) {}

  @Get('summary')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  async summary(@Req() request: {headers?: Record<string, string | string[] | undefined>}) {
    // CI-only. No accidental staging or production enablement.
    if (process.env.NODE_ENV === 'production' ||
        process.env.GITHUB_ACTIONS !== 'true' ||
        process.env.QA_SYNTHETIC_ONLY !== 'YES' ||
        !this.reader?.readWallet) {
      return deny();
    }
    const raw = request?.headers?.authorization;
    if (typeof raw !== 'string' || raw.length > 11000 ||
        !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(raw)) {
      throw new UnauthorizedException({
        ok: false, code: 'finance_qa_identity_required',
      });
    }
    try {
      // The independent bridge verifies signatures/issuer/azp/audience,
      // revocations, partner authority and SQL wallet ticket atomically.
      const report = await this.reader.readWallet(raw, 20);
      if (report.mode !== 'qa_synthetic_only' ||
          !['merchant', 'courier'].includes(report.ownerRole) ||
          report.withdrawableMinor !== 0 ||
          report.payoutEnabled !== false ||
          (report.ownerRole === 'courier' && report.merchantSlug !== null) ||
          (report.ownerRole === 'merchant' && !report.merchantSlug)) {
        return deny();
      }
      const s = report.summary;
      if (String(s.currency).trim() !== 'EUR' ||
          s.payout_enabled !== false) return deny();
      const accruedMinor = positiveMinor(s.accrued_minor);
      const pendingMinor = positiveMinor(s.pending_minor);
      const availableMinor = positiveMinor(s.available_minor);
      const heldMinor = positiveMinor(s.held_minor);
      if (accruedMinor !== pendingMinor + availableMinor + heldMinor ||
          positiveMinor(s.withdrawable_minor) !== 0) return deny();
      // Deliberately omit identities, tenant IDs, activities and secrets.
      return {
        ok: true,
        mode: 'qa_synthetic_only' as const,
        ownerRole: report.ownerRole,
        currency: 'EUR' as const,
        accruedMinor, pendingMinor, availableMinor, heldMinor,
        withdrawableMinor: 0 as const,
        payoutEnabled: false as const,
      };
    } catch (error: unknown) {
      return typedDenial(error);
    }
  }
}
