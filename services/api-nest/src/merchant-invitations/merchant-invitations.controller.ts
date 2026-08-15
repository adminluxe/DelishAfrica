import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { createHash } from 'crypto';
import { OpsAuthorityService } from '../ops-authority/ops-authority.service';
import type { OpsAuthorityHeaderMap } from '../ops-authority/ops-authority.types';
import { MerchantInvitationsService } from './merchant-invitations.service';
import {
  MERCHANT_INVITATION_PREPARE_PATH,
  type MerchantInvitationPrepareBody,
  type MerchantInvitationTokenBody,
} from './merchant-invitations.types';

@Controller('ops/merchant-invitations')
export class MerchantInvitationsController {
  constructor(
    private readonly authority: OpsAuthorityService,
    private readonly invitations: MerchantInvitationsService,
  ) {}

  @Post('prepare')
  @HttpCode(202)
  async prepare(
    @Headers() headers: OpsAuthorityHeaderMap,
    @Body() body: MerchantInvitationPrepareBody,
  ) {
    const bodySha256 = createHash('sha256')
      .update(stableJson(body))
      .digest('hex');
    const context = await this.authority.authorizeRequest(
      headers,
      'POST',
      MERCHANT_INVITATION_PREPARE_PATH,
      bodySha256,
    );
    return this.invitations.prepare(body, {
      principalHash: context.principalHash,
      authorityAuditId: context.auditId,
    });
  }
}

@Controller('merchant-invitations')
export class MerchantInvitationAcceptanceController {
  constructor(private readonly invitations: MerchantInvitationsService) {}

  @Post('accept/preview')
  @HttpCode(200)
  preview(@Body() body: MerchantInvitationTokenBody) {
    return this.invitations.preview(body || {});
  }

  @Post('accept')
  @HttpCode(200)
  accept(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: MerchantInvitationTokenBody,
  ) {
    return this.invitations.accept(body || {}, authorization, requestId);
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}
