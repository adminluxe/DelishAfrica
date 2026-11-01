import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogFoundationModule } from '../catalog-foundation/catalog-foundation.module';
import { FinancialStateModule } from '../financial-state/financial-state.module';
import { AtmReadonlyController } from './atm-readonly.controller';
import { AtmReadonlyService, ATM_READ_PORT, QAFinanceReadSource } from './atm-readonly.service';

/**
 * QA server only. AppModule imports this module only if
 * NODE_ENV != production AND DA_ATM_READONLY_QA_ENABLED=YES.
 */
@Module({
  imports: [AuthModule, CatalogFoundationModule, FinancialStateModule],
  controllers: [AtmReadonlyController],
  providers: [AtmReadonlyService, { provide: ATM_READ_PORT, useClass: QAFinanceReadSource }],
})
export class AtmReadonlyModule {}
