import type { GuestSqlExecutor } from './guest-checkout-ledger';
import type { IndependentOpsCoverageApprovals } from './guest-merchant-coverage-strict';

/**
 * Read-only PostgreSQL adapter for *independent* operations approval.
 * LAB ONLY. It never grants or edits approvals.
 * A production checkout DB principal must hold SELECT but not INSERT/UPDATE.
 */
export class PostgresGuestCoverageOpsApprovals implements IndependentOpsCoverageApprovals {
  constructor(private readonly db: GuestSqlExecutor) {}

  async isApproved(input: {
    partnerSlug: string;
    coverageDigestSha256: string;
  }): Promise<boolean> {
    if (!input || !/^[a-z][a-z0-9_-]{2,119}$/.test(input.partnerSlug) ||
        !/^[a-f0-9]{64}$/.test(input.coverageDigestSha256)) {
      return false;
    }
    try {
      const r = await this.db.query<{ approved: number }>(
        `SELECT 1::int AS approved
           FROM da_guest_coverage_ops_approvals
          WHERE partner_slug=$1 AND coverage_sha256=$2
            AND revoked_at IS NULL
            AND approved_at<=now() AND expires_at>now()
          LIMIT 1`,
        [input.partnerSlug,input.coverageDigestSha256],
      );
      return r.rowCount === 1 && r.rows[0]?.approved === 1;
    } catch {
      return false;
    }
  }
}
