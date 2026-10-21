import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IdentityLifecycleController } from './identity-lifecycle.controller';
import { IdentityLifecycleRepository } from './identity-lifecycle.repository';
import { IdentityLifecycleService } from './identity-lifecycle.service';

@Module({
  imports: [AuthModule],
  controllers: [IdentityLifecycleController],
  providers: [IdentityLifecycleRepository, IdentityLifecycleService],
  exports: [IdentityLifecycleService],
})
export class IdentityLifecycleModule {}
