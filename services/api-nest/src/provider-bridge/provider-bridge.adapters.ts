import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { ProviderBridgeService } from './provider-bridge.service';
import type {
  EmailVerificationStartInput,
  EmailVerificationStartResult,
  SmsVerificationCheckInput,
  SmsVerificationCheckResult,
  SmsVerificationStartInput,
  SmsVerificationStartResult,
  VerificationProvider,
} from './provider-bridge.types';

const text = (value: unknown, max = 300): string =>
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const providerFailure = (
  provider: VerificationProvider | 'postmark',
  status: number,
  payload: any,
): HttpException => {
  const body = {
    ok: false,
    code: status === 429 ? 'verification_capacity_limited' : 'verification_provider_failed',
    provider,
    providerStatus: status,
    retryable: status === 429 || status >= 500 || status === 0,
    message: status === 429
      ? 'Le canal est temporairement saturé. Patientez avant de réessayer.'
      : 'Le fournisseur de vérification n’a pas accepté la demande.',
    providerCode: text(payload?.ErrorCode || payload?.code || payload?.errorCode || status, 60),
    providerMessage: text(payload?.Message || payload?.message || payload?.error || payload?.raw || `HTTP ${status}`, 180),
  };
  return status === 429
    ? new HttpException(body, HttpStatus.TOO_MANY_REQUESTS)
    : new ServiceUnavailableException(body);
};

async function jsonRequestBody(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; data: any }> {
  try {
    const response = await fetch(url, { method, headers, body });
    const raw = await response.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw: raw.slice(0, 500) }; }
    return { status: response.status, data };
  } catch (error: any) {
    return { status: 0, data: { message: text(error?.message || error, 180) } };
  }
}

async function jsonRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  payload?: Record<string, unknown>,
): Promise<{ status: number; data: any }> {
  return jsonRequestBody(method, url, headers, payload ? JSON.stringify(payload) : undefined);
}

const SINCH_CONTENT_TYPE = 'application/json';
const SINCH_START_PATH = '/verification/v1/verifications';

export function normalizeSinchVerificationExpirySeconds(value: unknown): number {
  const seconds = Number(value ?? process.env.DA_SINCH_SMS_VERIFICATION_EXPIRY_SECONDS ?? '300');
  if (Number.isFinite(seconds) && seconds >= 60 && seconds <= 900) return Math.floor(seconds);
  return 300;
}

export function formatSinchSmsExpiry(seconds: number): string {
  const safe = normalizeSinchVerificationExpirySeconds(seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = safe % 60;
  return [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, '0')).join(':');
}

export function buildSinchApplicationRequest(input: {
  method: string;
  path: string;
  payload: Record<string, unknown>;
  applicationKey: string;
  applicationSecret: string;
  timestamp?: string;
  acceptLanguage?: string;
}): { body: string; headers: Record<string, string> } {
  const method = input.method.toUpperCase();
  const body = JSON.stringify(input.payload);
  const timestamp = input.timestamp || new Date().toISOString();
  const contentMd5 = createHash('md5').update(body, 'utf8').digest('base64');
  const secret = Buffer.from(String(input.applicationSecret || '').trim(), 'base64');
  if (!input.applicationKey || !secret.length) {
    throw new ServiceUnavailableException({
      code: 'sinch_application_signing_credentials_invalid',
      provider: 'sinch',
      message: 'La signature Application Sinch ne peut pas être calculée avec les identifiants configurés.',
    });
  }
  const canonicalTimestamp = `x-timestamp:${timestamp}`;
  const stringToSign = [method, contentMd5, SINCH_CONTENT_TYPE, canonicalTimestamp, input.path].join('\n');
  const signature = createHmac('sha256', secret).update(stringToSign, 'utf8').digest('base64');
  return {
    body,
    headers: {
      authorization: `Application ${input.applicationKey}:${signature}`,
      'content-type': SINCH_CONTENT_TYPE,
      accept: 'application/json',
      'x-timestamp': timestamp,
      ...(input.acceptLanguage ? { 'accept-language': input.acceptLanguage } : {}),
    },
  };
}

async function formRequest(
  url: string,
  authorization: string,
  values: Record<string, string>,
): Promise<{ status: number; data: any }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization,
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams(values).toString(),
    });
    const raw = await response.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw: raw.slice(0, 500) }; }
    return { status: response.status, data };
  } catch (error: any) {
    return { status: 0, data: { message: text(error?.message || error, 180) } };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

@Injectable()
export class GooglePlacesProviderAdapter {
  constructor(private readonly bridge: ProviderBridgeService) {}
  readiness() { return this.bridge.readiness().providers.googlePlaces; }
  async validateAddress(): Promise<never> {
    throw new ServiceUnavailableException({ code: 'location_trust_is_active_boundary' });
  }
}

@Injectable()
export class SmsProviderAdapter {
  constructor(private readonly bridge: ProviderBridgeService) {}
  readiness() { return this.bridge.readiness().providers.sms; }

  private providerConfigured(provider: VerificationProvider): boolean {
    const runtime = this.bridge.runtime();
    return provider === 'sinch' ? runtime.sinch.configured : runtime.twilio.configured;
  }
  private order(input: SmsVerificationStartInput): VerificationProvider[] {
    const runtime = this.bridge.runtime();
    if (input.route === 'alternate') return [runtime.secondary];
    if (input.route === 'primary') return [runtime.primary];
    return input.automaticFallback === false ? [runtime.primary] : [runtime.primary, runtime.secondary];
  }
  private requireLive() {
    const runtime = this.bridge.runtime();
    if (!runtime.externalCallsEnabled) {
      throw new ServiceUnavailableException({
        code: 'provider_external_calls_disabled', provider: 'sms', version: 'v1d',
        message: 'Le routeur d’identité est configuré mais pas encore activé.',
      });
    }
    return runtime;
  }
  private async startSinch(input: SmsVerificationStartInput): Promise<SmsVerificationStartResult> {
    const runtime = this.bridge.runtime();
    const verificationExpirySeconds = normalizeSinchVerificationExpirySeconds(
      process.env.DA_SINCH_SMS_VERIFICATION_EXPIRY_SECONDS,
    );
    const payload = {
      identity: { type: 'number', endpoint: input.destination },
      method: 'sms',
      smsOptions: { expiry: formatSinchSmsExpiry(verificationExpirySeconds) },
      ...(input.customerReference ? { reference: input.customerReference } : {}),
    };
    const signed = buildSinchApplicationRequest({
      method: 'POST',
      path: SINCH_START_PATH,
      payload,
      applicationKey: runtime.sinch.applicationKey,
      applicationSecret: runtime.sinch.applicationSecret,
      acceptLanguage: 'fr-FR',
    });
    const { status, data } = await jsonRequestBody(
      'POST',
      `https://verification.api.sinch.com${SINCH_START_PATH}`,
      signed.headers,
      signed.body,
    );
    if (status < 200 || status >= 300 || !data?.id) throw providerFailure('sinch', status, data);
    const interceptionTimeout = Number(data?.sms?.interceptionTimeout);
    const providerInterceptionTimeoutSeconds = Number.isFinite(interceptionTimeout) && interceptionTimeout > 0
      ? Math.min(900, Math.floor(interceptionTimeout))
      : undefined;
    return {
      provider: 'sinch',
      providerReference: text(data.id, 180),
      providerStatus: text(data.status || 'pending', 60),
      alternateAvailable: runtime.twilio.configured,
      verificationExpirySeconds,
      customerReference: input.customerReference,
      providerInterceptionTimeoutSeconds,
    };
  }
  private async startTwilio(input: SmsVerificationStartInput): Promise<SmsVerificationStartResult> {
    const runtime = this.bridge.runtime();
    const authorization = `Basic ${Buffer.from(`${runtime.twilio.accountSid}:${runtime.twilio.authToken}`).toString('base64')}`;
    const { status, data } = await formRequest(
      `https://verify.twilio.com/v2/Services/${encodeURIComponent(runtime.twilio.serviceSid)}/Verifications`,
      authorization, { To: input.destination, Channel: 'sms', CustomFriendlyName: 'DelishAfrica' },
    );
    if (status < 200 || status >= 300 || !data?.sid) throw providerFailure('twilio', status, data);
    return {
      provider: 'twilio',
      providerReference: text(data.sid, 180),
      providerStatus: text(data.status || 'pending', 60),
      alternateAvailable: runtime.sinch.configured,
      customerReference: input.customerReference,
    };
  }
  async startVerification(input: SmsVerificationStartInput): Promise<SmsVerificationStartResult> {
    this.requireLive();
    const providers = this.order(input).filter((item, index, all) => all.indexOf(item) === index);
    let lastError: unknown = null;
    for (const provider of providers) {
      if (!this.providerConfigured(provider)) continue;
      try { return provider === 'sinch' ? await this.startSinch(input) : await this.startTwilio(input); }
      catch (error) { lastError = error; if (input.route === 'primary' || input.route === 'alternate') throw error; }
    }
    if (lastError) throw lastError;
    throw new ServiceUnavailableException({ code: 'sms_verification_not_configured', message: 'Aucune route SMS sécurisée n’est disponible.' });
  }
  private async checkSinch(input: SmsVerificationCheckInput): Promise<SmsVerificationCheckResult> {
    const runtime = this.bridge.runtime();
    const path = `/verification/v1/verifications/id/${encodeURIComponent(input.providerReference)}`;
    const payload = { method: 'sms', sms: { code: input.code } };
    const signed = buildSinchApplicationRequest({
      method: 'PUT',
      path,
      payload,
      applicationKey: runtime.sinch.applicationKey,
      applicationSecret: runtime.sinch.applicationSecret,
    });
    const { status, data } = await jsonRequestBody(
      'PUT',
      `https://verification.api.sinch.com${path}`,
      signed.headers,
      signed.body,
    );
    if (status < 200 || status >= 300) throw providerFailure('sinch', status, data);
    const providerStatus = text(data?.status || data?.result || 'pending', 60);
    const providerReason = text(data?.reason || data?.failureReason || '', 120) || undefined;
    const reasonCode = providerReason ? providerReason.toLowerCase().replace(/[^a-z0-9]+/g, '_') : undefined;
    const expired = reasonCode === 'expired';
    return {
      provider: 'sinch',
      approved: providerStatus.toUpperCase() === 'SUCCESSFUL',
      providerStatus,
      providerReason,
      reasonCode,
      expired,
    };
  }
  private async checkTwilio(input: SmsVerificationCheckInput): Promise<SmsVerificationCheckResult> {
    const runtime = this.bridge.runtime();
    const authorization = `Basic ${Buffer.from(`${runtime.twilio.accountSid}:${runtime.twilio.authToken}`).toString('base64')}`;
    const { status, data } = await formRequest(
      `https://verify.twilio.com/v2/Services/${encodeURIComponent(runtime.twilio.serviceSid)}/VerificationCheck`,
      authorization, { To: input.destination, Code: input.code },
    );
    if (status < 200 || status >= 300) throw providerFailure('twilio', status, data);
    const providerStatus = text(data?.status || 'pending', 60);
    return { provider: 'twilio', approved: providerStatus === 'approved', providerStatus };
  }
  async checkVerification(input: SmsVerificationCheckInput): Promise<SmsVerificationCheckResult> {
    this.requireLive();
    return input.provider === 'sinch' ? this.checkSinch(input) : this.checkTwilio(input);
  }
}

@Injectable()
export class EmailProviderAdapter {
  constructor(private readonly bridge: ProviderBridgeService) {}
  readiness() { return this.bridge.readiness().providers.email; }

  async sendVerification(input: EmailVerificationStartInput): Promise<EmailVerificationStartResult> {
    const runtime = this.bridge.runtime();
    if (!runtime.externalCallsEnabled || !runtime.postmark.configured) {
      throw new ServiceUnavailableException({
        code: 'email_verification_not_configured',
        provider: 'postmark',
        message: 'La route email sécurisée n’est pas encore disponible.',
      });
    }
    const safeCode = escapeHtml(input.code);
    const roleLabel = input.role === 'merchant' ? 'Partenaire' : input.role === 'courier' ? 'Coursier' : 'Client';
    const { status, data } = await jsonRequest(
      'POST',
      'https://api.postmarkapp.com/email',
      {
        'X-Postmark-Server-Token': runtime.postmark.serverToken,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      {
        From: `DelishAfrica <${runtime.postmark.fromEmail}>`,
        To: input.destination,
        Subject: 'Votre code de vérification DelishAfrica',
        TextBody: `Votre code DelishAfrica est ${input.code}. Il expire dans 10 minutes. Ne le communiquez à personne.`,
        HtmlBody: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px"><p style="font-size:12px;letter-spacing:2px;color:#7d593f;font-weight:700">DELISHAFRICA · ${roleLabel.toUpperCase()}</p><h1 style="color:#1f1008">Confirmez votre e-mail</h1><p>Votre code de vérification :</p><div style="font-size:34px;letter-spacing:8px;font-weight:800;padding:18px 20px;background:#f4e5d6;border-radius:16px;color:#1f1008">${safeCode}</div><p style="color:#6d5b50">Ce code expire dans 10 minutes. DelishAfrica ne vous demandera jamais de le partager.</p></div>`,
        MessageStream: runtime.postmark.messageStream,
        Tag: 'identity-proof-email',
        Metadata: { role: input.role, purpose: 'identity-proof' },
      },
    );
    const accepted = status >= 200 && status < 300 && Number(data?.ErrorCode ?? 0) === 0 && Boolean(data?.MessageID);
    if (!accepted) throw providerFailure('postmark', status, data);
    return {
      provider: 'postmark',
      providerReference: text(data.MessageID, 180),
      providerStatus: 'accepted',
      validForSeconds: 600,
    };
  }
}
