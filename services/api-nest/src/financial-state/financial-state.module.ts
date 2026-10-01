import { Module } from '@nestjs/common';
import { FinancialStateRepository } from './financial-state.repository';

@Module({
  providers: [FinancialStateRepository],
  exports: [FinancialStateRepository],
})
export class FinancialStateModule {}
