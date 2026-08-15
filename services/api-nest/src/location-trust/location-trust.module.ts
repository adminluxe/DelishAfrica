import { Module } from '@nestjs/common';
import { LocationTrustController } from './location-trust.controller';
import { LocationTrustService } from './location-trust.service';

@Module({
  controllers: [LocationTrustController],
  providers: [LocationTrustService],
  exports: [LocationTrustService],
})
export class LocationTrustModule {}
