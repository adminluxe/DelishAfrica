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

  async sendTemplate(input: {
    to: string;
    templateAlias: string;
    templateModel: Record<string, unknown>;
  }): Promise<{ messageId: string }> {
    const readiness = this.readiness();
    if (!readiness.readyToSend) {
      throw new Error('merchant_invitation_provider_not_ready');
    }

    const token = String(process.env.POSTMARK_SERVER_TOKEN || '').trim();
    const from = String(process.env.POSTMARK_FROM_EMAIL || '').trim();
    const messageStream =
      String(process.env.POSTMARK_MESSAGE_STREAM || 'outbound').trim() ||
      'outbound';

    const response = await fetch(
      'https://api.postmarkapp.com/email/withTemplate',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': token,
        },
        body: JSON.stringify({
          From: from,
          To: input.to,
          TemplateAlias: input.templateAlias,
          TemplateModel: input.templateModel,
          MessageStream: messageStream,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );

    const body = (await response
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok || Number(body.ErrorCode || 0) !== 0) {
      throw new Error(`postmark_delivery_failed_${response.status}`);
    }

    const messageId = String(body.MessageID || '').trim();
    if (!messageId) throw new Error('postmark_message_id_missing');
    return { messageId };
  }
}
