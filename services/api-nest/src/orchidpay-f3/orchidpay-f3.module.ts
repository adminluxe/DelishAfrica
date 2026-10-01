import { Module } from '@nestjs/common';
import { OrchidpayF3Service } from './orchidpay-f3.service';

@Module({
  providers: [OrchidpayF3Service],
  exports: [OrchidpayF3Service],
})
export class OrchidpayF3Module {}
