import { Module } from '@nestjs/common';
import { ProviderBridgeModule } from '../provider-bridge/provider-bridge.module';
import { IdentityProofAttemptStore } from './identity-proof-attempt.store';
import { IdentityProofController } from './identity-proof.controller';
import { IdentityProofIdempotencyService } from './identity-proof-idempotency.service';
import { IdentityProofService } from './identity-proof.service';

@Module({
  imports: [ProviderBridgeModule],
  controllers: [IdentityProofController],
  providers: [
    IdentityProofService,
    IdentityProofAttemptStore,
    IdentityProofIdempotencyService,
  ],
  exports: [
    IdentityProofService,
    IdentityProofAttemptStore,
    IdentityProofIdempotencyService,
  ],
})
export class IdentityProofModule {}
