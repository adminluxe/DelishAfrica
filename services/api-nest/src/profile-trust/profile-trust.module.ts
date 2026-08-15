import { Module } from '@nestjs/common';
import { ProfileTrustController } from './profile-trust.controller';
import { ProfileTrustService } from './profile-trust.service';

@Module({
  controllers: [ProfileTrustController],
  providers: [ProfileTrustService],
  exports: [ProfileTrustService],
})
export class ProfileTrustModule {}
