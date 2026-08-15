import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { OrdersModule } from './orders/orders.module';
import { DispatchHttpModule } from './modules/dispatch-http/dispatch-http.module';
import { CourierPlatformModule } from './courier-platform/courier-platform.module';
import { PaymentsModule } from './payments/payments.module';
import { StripeWebhookModule } from './stripe/stripe-webhook.module';
import { AuthModule } from './auth/auth.module';
import { AssignmentIntelligenceModule } from './dispatch-intelligence/assignment-intelligence.module';
import { RoutesPreviewModule } from './routes-preview/routes-preview.module';
import { ProfileTrustModule } from './profile-trust/profile-trust.module';
import { LocationTrustModule } from './location-trust/location-trust.module';
import { IdentityProofModule } from './identity-proof/identity-proof.module';

import { ProviderBridgeModule } from './provider-bridge/provider-bridge.module';
import { CatalogFoundationModule } from './catalog-foundation/catalog-foundation.module';
import { MerchantCatalogGateModule } from './merchant-catalog-gate/merchant-catalog-gate.module';
import { OpsAuthorityModule } from './ops-authority/ops-authority.module';
import { MerchantInvitationsModule } from './merchant-invitations/merchant-invitations.module';

import { LegalModule } from './legal/legal.module';
// DA_J7B_LEGAL_MODULE
@Module({
  imports: [
    LegalModule,
    AssignmentIntelligenceModule,
    RoutesPreviewModule,
    OrdersModule,
    DispatchHttpModule,
    CourierPlatformModule,
    PaymentsModule,
    StripeWebhookModule,
    AuthModule,
    ProfileTrustModule,
    LocationTrustModule,
    IdentityProofModule,
    ProviderBridgeModule,
    CatalogFoundationModule,
    MerchantCatalogGateModule,
    OpsAuthorityModule,
    MerchantInvitationsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
