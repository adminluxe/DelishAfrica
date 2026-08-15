import { Injectable } from '@nestjs/common';

export type MerchantInvitationProviderReadiness = {
  provider: 'postmark';
  externalCallsEnabled: boolean;
  credentialsConfigured: boolean;
  readyToSend: boolean;
};

@Injectable()
export class MerchantInvitationsProvider {
  readiness(): MerchantInvitationProviderReadiness {
    const externalCallsEnabled =
      String(process.env.DA_PROVIDER_BRIDGE_EXTERNAL_CALLS || '0').trim() === '1';
    const credentialsConfigured = Boolean(
      String(process.env.POSTMARK_SERVER_TOKEN || '').trim() &&
        String(process.env.POSTMARK_FROM_EMAIL || '').trim(),
    );
    return {
      provider: 'postmark',
      externalCallsEnabled,
      credentialsConfigured,
      readyToSend: externalCallsEnabled && credentialsConfigured,
    };
  }
}
