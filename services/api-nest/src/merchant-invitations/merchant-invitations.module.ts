import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OpsAuthorityModule } from '../ops-authority/ops-authority.module';
import {
  MerchantInvitationAcceptanceController,
  MerchantInvitationsController,
} from './merchant-invitations.controller';
import { MerchantInvitationsCrypto } from './merchant-invitations.crypto';
import { MerchantInvitationsProvider } from './merchant-invitations.provider';
import { MerchantInvitationsRepository } from './merchant-invitations.repository';
import { MerchantInvitationsService } from './merchant-invitations.service';

@Module({
  imports: [OpsAuthorityModule, AuthModule],
  controllers: [
    MerchantInvitationsController,
    MerchantInvitationAcceptanceController,
  ],
  providers: [
    MerchantInvitationsCrypto,
    MerchantInvitationsProvider,
    MerchantInvitationsRepository,
    MerchantInvitationsService,
  ],
})
export class MerchantInvitationsModule {}
