import { Module } from '@nestjs/common';
import { OpsAuthorityController } from './ops-authority.controller';
import { OpsAuthorityRepository } from './ops-authority.repository';
import { OpsAuthorityService } from './ops-authority.service';

@Module({
  controllers: [OpsAuthorityController],
  providers: [OpsAuthorityRepository, OpsAuthorityService],
  exports: [OpsAuthorityService],
})
export class OpsAuthorityModule {}
