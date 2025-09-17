import { Module } from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';

@Module({
  controllers: [MerchantsController],
  providers: [MerchantsService],
})
export class MerchantsModule {}
