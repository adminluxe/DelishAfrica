import { Module } from '@nestjs/common';
import { CouriersController } from './couriers.controller';
import { CouriersService } from './couriers.service';

@Module({
  controllers: [CouriersController],
  providers: [CouriersService],
})
export class CouriersModule {}
