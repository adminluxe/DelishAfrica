import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { EmailProviderAdapter, SmsProviderAdapter } from '../provider-bridge/provider-bridge.adapters';
import { ProviderBridgeService } from '../provider-bridge/provider-bridge.service';
import type { VerificationProvider, VerificationRoute } from '../provider-bridge/provider-bridge.types';
import {
  IdentityProofAttemptStore,
  type IdentityAttemptFinalError,
  type IdentityAttemptRecord,
} from './identity-proof-attempt.store';
import { IdentityProofIdempotencyService } from './identity-proof-idempotency.service';

type IdentityChannel = 'sms' | 'email';
type IdentityRole = 'client' | 'merchant' | 'courier';
type RateEntry = { count: number; resetAt: number };
type AttemptProvider = VerificationProvider | 'postmark';

type ProofPayload = {
  v: 1;
  channel: IdentityChannel;
  role: IdentityRole;
  destinationHash: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

type AttemptPayload = {
  v: 2;
  channel: IdentityChannel;
  role: IdentityRole;
  destinationHash: string;
  provider: AttemptProvider;
  providerReference: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  codeDigest?: string;
};

type StartResponse = {
  ok: true;
  status: string;
  channel: IdentityChannel;
  role: IdentityRole;
  maskedDestination: string;
  attemptToken: string;
  provider: AttemptProvider;
  alternateAvailable: boolean;
  validForSeconds: number;
  expiresAt: string;
  reused: boolean;
  clientRequestId: string;
  notice: string;
};

type CheckResponse = {
  ok: boolean;
  approved: boolean;
  status: string;
  channel: IdentityChannel;
  role: IdentityRole;
  provider: AttemptProvider;
  maskedDestination: string;
  message?: string;
  expired?: boolean;
  reasonCode?: string;
  proofToken?: string;
  verifiedAt?: string;
  expiresAt?: string;
  notice?: string;
  replayed?: boolean;
};

function text(value: unknown, max = 260): string { return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max); }
function normalizePhone(value: unknown): string {
  const raw = text(value, 40).replace(/[()\s.-]/g, '');
  const international = raw.startsWith('00') ? `+${raw.slice(2)}` : raw;
  const sign = international.startsWith('+') ? '+' : '';
  return sign + international.replace(/\D/g, '');
}
function normalizeEmail(value: unknown): string { return text(value, 254).toLowerCase(); }
function normalizeDestination(channel: IdentityChannel, value: unknown): string { return channel === 'sms' ? normalizePhone(value) : normalizeEmail(value); }
function validDestination(channel: IdentityChannel, value: string): boolean {
  if (channel === 'sms') return /^\+[1-9]\d{7,14}$/.test(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function maskDestination(channel: IdentityChannel, value: string): string {
  if (channel === 'sms') {
    const tail = value.slice(-3);
    const prefix = value.slice(0, Math.min(4, Math.max(2, value.length - 6)));
    return `${prefix}${'•'.repeat(Math.max(4, value.length - prefix.length - 3))}${tail}`;
  }
  const [local = '', domain = ''] = value.split('@');
  return `${local.slice(0, 2)}${'•'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}
function base64Url(value: Buffer | string): string { return Buffer.from(value).toString('base64url'); }
function truthy(value: unknown): boolean { return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase()); }

@Injectable()
export class IdentityProofService {
  private readonly rate = new Map<string, RateEntry>();

  constructor(
    private readonly bridge: ProviderBridgeService,
    private readonly smsProvider: SmsProviderAdapter,
    private readonly emailProvider: EmailProviderAdapter,
    private readonly attempts: IdentityProofAttemptStore,
    private readonly idempotency: IdentityProofIdempotencyService,
  ) {}

  health() {
    const readiness = this.bridge.readiness();
    const runtime = this.bridge.runtime();
    return {
      ok: true,
      service: 'identity-proof',
      provider: 'provider_bridge_v1d',
      configured: readiness.providers.sms.state === 'ready' && readiness.providers.email.state === 'ready',
      channels: {
        sms: readiness.providers.sms.state === 'ready',
        email: readiness.providers.email.state === 'ready',
      },
      routes: readiness.providers.sms.routes,
      primary: readiness.providers.sms.primary,
      secondary: readiness.providers.sms.secondary,
      emailProvider: readiness.providers.email.route,
      proofToken: Boolean(runtime.signingSecret),
      fraudGuard: 'provider_managed_plus_server_rate_limits',
      persistence: false,
      remediation: {
        enabled: this.remediationEnabled(),
        store: 'memory_single_instance',
        startSingleFlight: true,
        reportSingleFlight: true,
        strictProviderReferenceBinding: true,
      },
      deviceDraftContinuity: true,
      proofExpiryDays: 30,
      policy: 'ownership_required_before_real_activation',
    };
  }

  private remediationEnabled(): boolean {
    return truthy(process.env.DA_IDENTITY_PROOF_REMEDIATION_V1_ENABLED);
  }

  private consume(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const current = this.rate.get(key);
    if (!current || current.resetAt <= now) {
      this.rate.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    if (current.count >= limit) throw new HttpException('Trop de tentatives rapprochées. Patientez avant de réessayer.', HttpStatus.TOO_MANY_REQUESTS);
    current.count += 1;
  }

  private parseRole(value: unknown): IdentityRole {
    const role = text(value, 20) as IdentityRole;
    return ['client', 'merchant', 'courier'].includes(role) ? role : 'client';
  }

  private parseChannel(value: unknown): IdentityChannel {
    const channel = text(value, 20) as IdentityChannel;
    if (!['sms', 'email'].includes(channel)) throw new BadRequestException('Canal de vérification invalide.');
    return channel;
  }

  private parseRoute(value: unknown): VerificationRoute {
    const route = text(value, 20) as VerificationRoute;
    return ['auto', 'primary', 'alternate'].includes(route) ? route : 'auto';
  }

  private destinationHash(value: string): string { return createHash('sha256').update(value).digest('hex'); }

  private signPayload(payload: object, secret: string): string {
    const encoded = base64Url(JSON.stringify(payload));
    const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
  }

  private decodeSigned<T>(token: string, secret: string): T | null {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;
    const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    try { return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T; } catch { return null; }
  }

  private requireSigningSecret(): string {
    const secret = this.bridge.runtime().signingSecret;
    if (!secret) throw new ServiceUnavailableException({ code: 'proof_signing_secret_missing', message: 'La signature des preuves n’est pas configurée.' });
    return secret;
  }

  private codeDigest(role: IdentityRole, destination: string, nonce: string, code: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(`email:${role}:${this.destinationHash(destination)}:${nonce}:${code}`)
      .digest('base64url');
  }

  private attemptTtlSeconds(providerSeconds?: number): number {
    const configured = Number(process.env.DA_IDENTITY_PROOF_ATTEMPT_TTL_SECONDS || '180');
    const provider = Number(providerSeconds);
    if (Number.isFinite(provider) && provider >= 30 && provider <= 900) return Math.floor(provider);
    if (Number.isFinite(configured) && configured >= 30 && configured <= 900) return Math.floor(configured);
    return 180;
  }

  private issueAttempt(
    channel: IdentityChannel,
    role: IdentityRole,
    destination: string,
    provider: AttemptProvider,
    providerReference: string,
    secret: string,
    validForSeconds: number,
    code?: string,
  ) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const nonce = randomUUID();
    const payload: AttemptPayload = {
      v: 2,
      channel,
      role,
      destinationHash: this.destinationHash(destination),
      provider,
      providerReference,
      issuedAt,
      expiresAt: issuedAt + validForSeconds,
      nonce,
      codeDigest: channel === 'email' && code ? this.codeDigest(role, destination, nonce, code, secret) : undefined,
    };
    return this.signPayload(payload, secret);
  }

  private verifyAttempt(
    token: string,
    channel: IdentityChannel,
    role: IdentityRole,
    destination: string,
    secret: string,
    allowExpired = false,
  ): AttemptPayload {
    const payload = this.decodeSigned<AttemptPayload>(token, secret);
    const now = Math.floor(Date.now() / 1000);
    const providerAllowed = channel === 'sms'
      ? payload?.provider === 'sinch' || payload?.provider === 'twilio'
      : payload?.provider === 'postmark';
    if (!payload || payload.v !== 2 || payload.channel !== channel || payload.role !== role ||
        payload.destinationHash !== this.destinationHash(destination) || (!allowExpired && payload.expiresAt <= now) ||
        !providerAllowed || !payload.providerReference) {
      throw new BadRequestException('La tentative de vérification a expiré. Demandez un nouveau code.');
    }
    return payload;
  }

  private verifyEmailCode(attempt: AttemptPayload, role: IdentityRole, destination: string, code: string, secret: string): boolean {
    if (!attempt.codeDigest) return false;
    const expected = this.codeDigest(role, destination, attempt.nonce, code, secret);
    const left = Buffer.from(attempt.codeDigest);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private issueProof(channel: IdentityChannel, role: IdentityRole, destination: string, secret: string) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 60 * 60 * 24 * 30;
    const payload: ProofPayload = { v: 1, channel, role, destinationHash: this.destinationHash(destination), issuedAt, expiresAt, nonce: randomUUID() };
    return { token: this.signPayload(payload, secret), issuedAt: new Date(issuedAt * 1000).toISOString(), expiresAt: new Date(expiresAt * 1000).toISOString() };
  }

  private verifyProofToken(token: string, channel: IdentityChannel, role: IdentityRole, destination: string, secret: string) {
    const payload = this.decodeSigned<ProofPayload>(token, secret);
    const now = Math.floor(Date.now() / 1000);
    const valid = Boolean(payload && payload.v === 1 && payload.channel === channel && payload.role === role && payload.destinationHash === this.destinationHash(destination) && payload.expiresAt > now);
    return { valid, reason: valid ? 'ok' : 'claims', expiresAt: payload?.expiresAt ? new Date(payload.expiresAt * 1000).toISOString() : null };
  }

  private conflict(code: string, message: string): HttpException {
    return new HttpException({ ok: false, code, message, retryable: false }, HttpStatus.CONFLICT);
  }

  private captureError(error: unknown): IdentityAttemptFinalError {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      return {
        statusCode: error.getStatus(),
        body: typeof response === 'object' && response !== null
          ? response as Record<string, unknown>
          : { ok: false, code: 'identity_proof_failed', message: text(response, 240) },
      };
    }
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      body: { ok: false, code: 'identity_proof_failed', message: 'Le fournisseur de vérification est indisponible.', retryable: false },
    };
  }

  private throwStoredError(error: IdentityAttemptFinalError): never {
    throw new HttpException(error.body, error.statusCode);
  }

  private reusedStart(record: IdentityAttemptRecord): StartResponse {
    if (record.finalError) this.throwStoredError(record.finalError);
    if (!record.startResponse) throw this.conflict('identity_attempt_incomplete', 'La tentative précédente est incomplète. Utilisez une nouvelle demande explicite.');
    return { ...(record.startResponse as StartResponse), reused: true };
  }

  private async startRemediated(
    input: any,
    requesterKey: string,
    channel: IdentityChannel,
    role: IdentityRole,
    destination: string,
    secret: string,
  ): Promise<StartResponse> {
    const route = this.parseRoute(input?.route);
    const clientRequestId = this.idempotency.normalizeClientRequestId(input?.clientRequestId);
    const canonicalKey = this.idempotency.canonicalKey(channel, role, destination);
    const explicitResend = input?.resend === true || input?.forceResend === true || route === 'alternate';

    // Join the canonical single-flight before reading a request placeholder. The first
    // caller registers a state=starting placeholder synchronously; reading it outside
    // the lock would make concurrent identical callers fail with an incomplete attempt.
    return this.attempts.runStartSingleFlight(canonicalKey, async () => {
      const repeatedByRequest = this.attempts.getByClientRequestId(clientRequestId);
      if (repeatedByRequest) return this.reusedStart(repeatedByRequest);

      const active = this.attempts.getActive(canonicalKey);
      if (active && !explicitResend) return this.reusedStart(active);
      if (active && explicitResend) this.attempts.supersede(active.attemptTokenHash);

      this.consume(`start:${requesterKey}:${channel}:${this.destinationHash(destination).slice(0, 16)}`, 4, 15 * 60_000);
      const customerReference = this.idempotency.customerReference(clientRequestId, canonicalKey);
      const placeholderHash = `request:${this.idempotency.hash(clientRequestId)}`;
      const placeholder: IdentityAttemptRecord = {
        attemptTokenHash: placeholderHash,
        clientRequestId,
        canonicalKey,
        destinationHash: this.destinationHash(destination),
        role,
        channel,
        customerReference,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.attemptTtlSeconds() * 1000).toISOString(),
        state: 'starting',
      };
      this.attempts.save(placeholder);

      try {
        let provider: AttemptProvider;
        let providerReference: string;
        let providerStatus: string;
        let alternateAvailable = false;
        let validForSeconds: number;
        let code: string | undefined;
        let notice: string;

        if (channel === 'sms') {
          const result = await this.smsProvider.startVerification({
            destination,
            role,
            route,
            customerReference,
            automaticFallback: false,
          });
          provider = result.provider;
          providerReference = result.providerReference;
          providerStatus = result.providerStatus || 'pending';
          alternateAvailable = result.alternateAvailable;
          validForSeconds = this.attemptTtlSeconds(result.verificationExpirySeconds);
          notice = result.provider === 'sinch'
            ? 'Code envoyé par la route compatible avec votre réseau.'
            : 'Code envoyé par la route de secours sécurisée.';
        } else {
          code = randomInt(0, 1_000_000).toString().padStart(6, '0');
          const result = await this.emailProvider.sendVerification({ destination, role, code });
          provider = result.provider;
          providerReference = result.providerReference;
          providerStatus = result.providerStatus;
          validForSeconds = this.attemptTtlSeconds(result.validForSeconds);
          notice = 'Code envoyé par Postmark. Vérifiez aussi vos courriers indésirables.';
        }

        const attemptToken = this.issueAttempt(
          channel,
          role,
          destination,
          provider,
          providerReference,
          secret,
          validForSeconds,
          code,
        );
        const attemptTokenHash = this.idempotency.tokenHash(attemptToken);
        const issuedAt = new Date();
        const expiresAt = new Date(issuedAt.getTime() + validForSeconds * 1000);
        const response: StartResponse = {
          ok: true,
          status: providerStatus,
          channel,
          role,
          maskedDestination: maskDestination(channel, destination),
          attemptToken,
          provider,
          alternateAvailable,
          validForSeconds,
          expiresAt: expiresAt.toISOString(),
          reused: false,
          clientRequestId,
          notice,
        };
        this.attempts.save({
          attemptTokenHash,
          attemptToken,
          clientRequestId,
          canonicalKey,
          destinationHash: this.destinationHash(destination),
          role,
          channel,
          provider,
          providerReference,
          customerReference,
          issuedAt: issuedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          state: 'pending',
          startResponse: response,
        });
        return response;
      } catch (error) {
        const finalError = this.captureError(error);
        this.attempts.update(placeholderHash, { state: 'failed', finalError });
        this.throwStoredError(finalError);
      }
    });
  }

  async start(input: any, requesterKey: string) {
    const channel = this.parseChannel(input?.channel);
    const role = this.parseRole(input?.role);
    const destination = normalizeDestination(channel, input?.destination);
    if (!validDestination(channel, destination)) throw new BadRequestException(channel === 'sms' ? 'Le numéro doit être au format international E.164.' : 'L’adresse email n’est pas valide.');
    const secret = this.requireSigningSecret();

    if (this.remediationEnabled()) {
      return this.startRemediated(input, requesterKey, channel, role, destination, secret);
    }

    this.consume(`start:${requesterKey}:${channel}:${this.destinationHash(destination).slice(0, 16)}`, 4, 15 * 60_000);
    if (channel === 'sms') {
      const result = await this.smsProvider.startVerification({ destination, role, route: this.parseRoute(input?.route) });
      const validForSeconds = this.attemptTtlSeconds(result.verificationExpirySeconds);
      const attemptToken = this.issueAttempt('sms', role, destination, result.provider, result.providerReference, secret, validForSeconds);
      return {
        ok: true,
        status: result.providerStatus || 'pending',
        channel,
        role,
        maskedDestination: maskDestination(channel, destination),
        attemptToken,
        provider: result.provider,
        alternateAvailable: result.alternateAvailable,
        validForSeconds,
        expiresAt: new Date(Date.now() + validForSeconds * 1000).toISOString(),
        notice: result.provider === 'sinch' ? 'Code envoyé par la route compatible avec votre réseau.' : 'Code envoyé par la route de secours sécurisée.',
      };
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const result = await this.emailProvider.sendVerification({ destination, role, code });
    const validForSeconds = this.attemptTtlSeconds(result.validForSeconds);
    const attemptToken = this.issueAttempt('email', role, destination, result.provider, result.providerReference, secret, validForSeconds, code);
    return {
      ok: true,
      status: result.providerStatus,
      channel,
      role,
      maskedDestination: maskDestination(channel, destination),
      attemptToken,
      provider: result.provider,
      alternateAvailable: false,
      validForSeconds,
      expiresAt: new Date(Date.now() + validForSeconds * 1000).toISOString(),
      notice: 'Code envoyé par Postmark. Vérifiez aussi vos courriers indésirables.',
    };
  }

  private async checkRemediated(
    requesterKey: string,
    channel: IdentityChannel,
    role: IdentityRole,
    destination: string,
    code: string,
    attemptToken: string,
    secret: string,
  ): Promise<CheckResponse> {
    const signed = this.verifyAttempt(attemptToken, channel, role, destination, secret, true);
    const tokenHash = this.idempotency.tokenHash(attemptToken);
    const record = this.attempts.getByTokenHash(tokenHash);
    if (!record) throw this.conflict('identity_attempt_not_registered', 'Cette tentative n’est plus active. Demandez un nouveau code.');
    if (record.finalError) this.throwStoredError(record.finalError);
    if (record.finalResult) return { ...(record.finalResult as CheckResponse), replayed: true };
    if (record.state === 'superseded') throw this.conflict('identity_attempt_superseded', 'Un code plus récent a été envoyé. Utilisez uniquement le dernier code reçu.');
    if (Date.parse(record.expiresAt) <= Date.now() || signed.expiresAt * 1000 <= Date.now()) {
      this.attempts.update(tokenHash, { state: 'expired' });
      throw this.conflict('identity_attempt_expired', 'Le code a expiré. Demandez un nouveau code.');
    }
    if (record.channel !== channel || record.role !== role || record.destinationHash !== this.destinationHash(destination) ||
        record.provider !== signed.provider || record.providerReference !== signed.providerReference) {
      throw this.conflict('identity_attempt_binding_mismatch', 'La tentative ne correspond pas à cette coordonnée.');
    }

    return this.attempts.runReportSingleFlight(tokenHash, async () => {
      const latest = this.attempts.getByTokenHash(tokenHash);
      if (!latest) throw this.conflict('identity_attempt_not_registered', 'Cette tentative n’est plus active.');
      if (latest.finalError) this.throwStoredError(latest.finalError);
      if (latest.finalResult) return { ...(latest.finalResult as CheckResponse), replayed: true };
      if (latest.state === 'superseded') throw this.conflict('identity_attempt_superseded', 'Un code plus récent a été envoyé. Utilisez uniquement le dernier code reçu.');
      if (Date.parse(latest.expiresAt) <= Date.now()) {
        this.attempts.update(tokenHash, { state: 'expired' });
        throw this.conflict('identity_attempt_expired', 'Le code a expiré. Demandez un nouveau code.');
      }

      this.consume(`check:${requesterKey}:${channel}:${this.destinationHash(destination).slice(0, 16)}`, 8, 10 * 60_000);
      this.attempts.update(tokenHash, { state: 'reporting' });
      try {
        let approved = false;
        let status = 'pending';
        let provider: AttemptProvider = signed.provider;
        let message = 'Le code n’a pas été validé.';

        if (channel === 'sms') {
          const result = await this.smsProvider.checkVerification({
            provider: latest.provider as VerificationProvider,
            providerReference: latest.providerReference || '',
            destination,
            code,
          });
          approved = result.approved;
          status = result.providerStatus;
          provider = result.provider;
          message = result.providerReason
            ? `Le code n’a pas été validé (${result.providerReason}).`
            : 'Le code n’a pas été validé.';
          const expired = result.expired === true || result.reasonCode === 'expired';
          if (expired) {
            const response: CheckResponse = {
              ok: false,
              approved: false,
              expired: true,
              reasonCode: 'expired',
              status,
              channel,
              role,
              provider,
              maskedDestination: maskDestination(channel, destination),
              message: 'Le code a expiré. Demandez un nouveau code.',
            };
            this.attempts.update(tokenHash, { state: 'expired', finalResult: response });
            return response;
          }
        } else {
          approved = this.verifyEmailCode(signed, role, destination, code, secret);
          status = approved ? 'approved' : 'rejected';
          provider = 'postmark';
        }

        if (!approved) {
          const response: CheckResponse = {
            ok: false,
            approved: false,
            status,
            channel,
            role,
            provider,
            maskedDestination: maskDestination(channel, destination),
            message,
          };
          this.attempts.update(tokenHash, { state: 'failed', finalResult: response });
          return response;
        }

        const proof = this.issueProof(channel, role, destination, secret);
        const response: CheckResponse = {
          ok: true,
          approved: true,
          status: 'approved',
          channel,
          role,
          provider,
          maskedDestination: maskDestination(channel, destination),
          proofToken: proof.token,
          verifiedAt: proof.issuedAt,
          expiresAt: proof.expiresAt,
          notice: 'La possession du contact est prouvée sans stocker le code.',
        };
        this.attempts.update(tokenHash, { state: 'approved', finalResult: response });
        return response;
      } catch (error) {
        const finalError = this.captureError(error);
        this.attempts.update(tokenHash, { state: 'failed', finalError });
        this.throwStoredError(finalError);
      }
    });
  }

  async check(input: any, requesterKey: string) {
    const channel = this.parseChannel(input?.channel);
    const role = this.parseRole(input?.role);
    const destination = normalizeDestination(channel, input?.destination);
    const code = text(input?.code, 12).replace(/\s+/g, '');
    if (!validDestination(channel, destination)) throw new BadRequestException('Destination de vérification invalide.');
    if (!/^\d{4,10}$/.test(code)) throw new BadRequestException('Le code doit contenir entre 4 et 10 chiffres.');
    const secret = this.requireSigningSecret();
    const attemptToken = text(input?.attemptToken, 4096);
    if (!attemptToken) throw new BadRequestException('La tentative de vérification est manquante. Demandez un nouveau code.');

    if (this.remediationEnabled()) {
      return this.checkRemediated(requesterKey, channel, role, destination, code, attemptToken, secret);
    }

    this.consume(`check:${requesterKey}:${channel}:${this.destinationHash(destination).slice(0, 16)}`, 8, 10 * 60_000);
    const attempt = this.verifyAttempt(attemptToken, channel, role, destination, secret);
    let approved = false;
    let status = 'pending';
    let provider: AttemptProvider = attempt.provider;

    if (channel === 'sms') {
      const result = await this.smsProvider.checkVerification({
        provider: attempt.provider as VerificationProvider,
        providerReference: attempt.providerReference,
        destination,
        code,
      });
      approved = result.approved;
      status = result.providerStatus;
      provider = result.provider;
    } else {
      approved = this.verifyEmailCode(attempt, role, destination, code, secret);
      status = approved ? 'approved' : 'rejected';
      provider = 'postmark';
    }

    if (!approved) return { ok: false, approved: false, status, channel, role, provider, maskedDestination: maskDestination(channel, destination), message: 'Le code n’a pas été validé.' };
    const proof = this.issueProof(channel, role, destination, secret);
    return { ok: true, approved: true, status: 'approved', channel, role, provider, maskedDestination: maskDestination(channel, destination), proofToken: proof.token, verifiedAt: proof.issuedAt, expiresAt: proof.expiresAt, notice: 'La possession du contact est prouvée sans stocker le code.' };
  }

  attest(input: any, requesterKey: string) {
    const channel = this.parseChannel(input?.channel);
    const role = this.parseRole(input?.role);
    const destination = normalizeDestination(channel, input?.destination);
    const proofToken = text(input?.proofToken, 4096);
    if (!validDestination(channel, destination) || !proofToken) throw new BadRequestException('Preuve de possession incomplète.');
    this.consume(`attest:${requesterKey}:${channel}:${this.destinationHash(destination).slice(0, 16)}`, 30, 60_000);
    const result = this.verifyProofToken(proofToken, channel, role, destination, this.requireSigningSecret());
    return { ok: result.valid, valid: result.valid, channel, role, expiresAt: result.expiresAt, reason: result.reason };
  }
}
