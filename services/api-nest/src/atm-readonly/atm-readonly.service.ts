import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { QAOperationsPostgresSource, QAOperationsReadSource } from './operations-source.qa';
import { AuthService } from '../auth/auth.service';
import { CatalogFoundationService } from '../catalog-foundation/catalog-foundation.service';
import { FinancialStateRepository } from '../financial-state/financial-state.repository';
import { OrchidBridgeScopedShadowSource, ServerOnlyOrchidBridgeRead } from './orchid-bridge-source.qa';
import {
  AtmReadonlyCore, ReadDenied, approvedMerchantTokenBinding,
  type DataPorts, type ReadArea, type ReadScope,
} from './atm-readonly.core';

export const ATM_READ_PORT = Symbol('ATM_READ_PORT');

/** No registered finance, stock or supplier data source may be fabricated. */
@Injectable()
export class DisabledReadSource implements DataPorts {
  readFinance(_scope: ReadScope): Promise<unknown> { throw new Error('source_not_certified'); }
  readInventory(_scope: ReadScope): Promise<unknown> { throw new Error('source_not_certified'); }
  readSuppliers(_scope: ReadScope): Promise<unknown> { throw new Error('source_not_certified'); }
}
/** Server-scoped source; requires two independent QA opt-ins and a root-owned secret file. */
@Injectable()
export class QAFinanceReadSource extends DisabledReadSource implements OnModuleDestroy {
  private readonly operations = new QAOperationsPostgresSource();
  constructor(private readonly finance: FinancialStateRepository) { super(); }
  async readInventory(scope: ReadScope): Promise<unknown> {
    const db = await this.operations.getPool();
    return new QAOperationsReadSource(db).readInventory(scope);
  }
  async readSuppliers(scope: ReadScope): Promise<unknown> {
    const db = await this.operations.getPool();
    return new QAOperationsReadSource(db).readSuppliers(scope);
  }
  async onModuleDestroy(): Promise<void> { await this.operations.dispose(); }
  readFinance(scope: ReadScope): Promise<unknown> {
    const bridge = new OrchidBridgeScopedShadowSource({
      listRecentMerchantPaymentReferences: (slug, limit) =>
        this.finance.listRecentMerchantPaymentReferences(slug, limit),
    }, new ServerOnlyOrchidBridgeRead());
    return bridge.readFinance(scope);
  }
}
@Injectable()
export class AtmReadonlyService {
  private readonly core: AtmReadonlyCore;
  constructor(
    private readonly auth: AuthService,
    private readonly catalog: CatalogFoundationService,
    @Inject(ATM_READ_PORT) source: DataPorts,
  ) {
    this.core = new AtmReadonlyCore({
      resolveBearer: async authHeader => {
        const resolution = await this.auth.resolvePrincipalFromAuthorization(authHeader);
        if ('reason' in resolution ||
            !approvedMerchantTokenBinding(resolution.payload.azp, resolution.payload.aud))
          return null;
        return resolution.principal;
      },
      listOwned: subject => this.catalog.listOwnedBySubject(subject),
      listMemberships: (issuer, subject) =>
        this.catalog.listMerchantMembershipsBySubject(issuer, subject),
    }, source);
  }
  read(area: ReadArea, authorization: string | undefined, slug?: string) {
    return this.core.read(area, authorization, slug);
  }
}
export { ReadDenied };
