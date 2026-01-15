import { Module } from '@nestjs/common';
import { CourierPlatformController } from './courier-platform.controller';
import { CourierPlatformService } from './courier-platform.service';

@Module({
  controllers: [CourierPlatformController],
  providers: [CourierPlatformService],
})
export class CourierPlatformModule {}
