import { equal, notEqual, ok, rejects } from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import { IdentityProofAttemptStore } from './identity-proof-attempt.store';
import { IdentityProofIdempotencyService } from './identity-proof-idempotency.service';
import { IdentityProofService } from './identity-proof.service';

type FakeSms = {
  startCalls: number;
  checkCalls: number;
  failStart: boolean;
  checkResult: 'approved' | 'expired';
  startVerification: (input: any) => Promise<any>;
  checkVerification: (input: any) => Promise<any>;
};

function makeHarness() {
  process.env.DA_IDENTITY_PROOF_REMEDIATION_V1_ENABLED = '1';
  process.env.DA_IDENTITY_PROOF_ATTEMPT_TTL_SECONDS = '180';
  const bridge = {
    readiness: () => ({ providers: {
      sms: { state: 'ready', routes: [], primary: 'sinch', secondary: 'twilio' },
      email: { state: 'ready', route: 'postmark' },
    } }),
    runtime: () => ({ signingSecret: 'unit-test-signing-secret' }),
  };
  const sms: FakeSms = {
    startCalls: 0,
    checkCalls: 0,
    failStart: false,
    checkResult: 'approved',
    async startVerification(input: any) {
      this.startCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (this.failStart) {
        throw new ServiceUnavailableException({
          ok: false,
          code: 'fake_provider_5xx',
          message: 'Fake provider failure.',
          retryable: false,
        });
      }
      return {
        provider: 'sinch',
        providerReference: `fake-ref-${this.startCalls}`,
        providerStatus: 'pending',
        alternateAvailable: false,
        verificationExpirySeconds: 300,
        providerInterceptionTimeoutSeconds: 180,
        customerReference: input.customerReference,
      };
    },
    async checkVerification() {
      this.checkCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (this.checkResult === 'expired') {
        return {
          provider: 'sinch',
          approved: false,
          providerStatus: 'FAIL',
          providerReason: 'Expired',
          reasonCode: 'expired',
          expired: true,
        };
      }
      return { provider: 'sinch', approved: true, providerStatus: 'SUCCESSFUL' };
    },
  };
  const email = { async sendVerification() { return {
    provider: 'postmark',
    providerReference: 'fake-email-ref',
    providerStatus: 'accepted',
    validForSeconds: 600,
  }; } };
  const store = new IdentityProofAttemptStore();
  const idempotency = new IdentityProofIdempotencyService();
  const service = new IdentityProofService(bridge as any, sms as any, email as any, store, idempotency);
  return { service, sms };
}

const startInput = (clientRequestId: string, extra: Record<string, unknown> = {}) => ({
  channel: 'sms', role: 'client', destination: '+32470000000', route: 'auto', clientRequestId, ...extra,
});

async function rejectStatus(promise: Promise<unknown>, expected: number): Promise<void> {
  await rejects(promise, (error: any) => {
    const status = typeof error?.getStatus === 'function' ? error.getStatus() : error?.status;
    equal(status, expected);
    return true;
  });
}

afterEach(() => {
  delete process.env.DA_IDENTITY_PROOF_REMEDIATION_V1_ENABLED;
  delete process.env.DA_IDENTITY_PROOF_ATTEMPT_TTL_SECONDS;
});

test('20 concurrent identical starts produce one provider POST and one attempt', async () => {
  const { service, sms } = makeHarness();
  const results = await Promise.all(Array.from({ length: 20 }, () => service.start(startInput('client-request-0001'), 'requester-a')));
  equal(sms.startCalls, 1);
  equal(new Set(results.map((item: any) => item.attemptToken)).size, 1);
  ok(results.every((item: any) => item.clientRequestId === 'client-request-0001'));
});

test('different request IDs for the same active destination reuse one start', async () => {
  const { service, sms } = makeHarness();
  const results = await Promise.all(Array.from({ length: 20 }, (_, index) =>
    service.start(startInput(`client-request-${String(index).padStart(4, '0')}`), 'requester-b')));
  equal(sms.startCalls, 1);
  equal(new Set(results.map((item: any) => item.attemptToken)).size, 1);
});

test('explicit resend supersedes the old attempt and permits one new POST', async () => {
  const { service, sms } = makeHarness();
  const first = await service.start(startInput('client-request-first'), 'requester-c');
  const second = await service.start(startInput('client-request-resend', { resend: true, route: 'alternate' }), 'requester-c');
  equal(sms.startCalls, 2);
  notEqual(second.attemptToken, first.attemptToken);
  await rejectStatus(service.check({
    channel: 'sms', role: 'client', destination: '+32470000000', code: '123456', attemptToken: first.attemptToken,
  }, 'requester-c'), 409);
  equal(sms.checkCalls, 0);
});

test('20 concurrent reports produce one provider PUT and one final result', async () => {
  const { service, sms } = makeHarness();
  const started = await service.start(startInput('client-request-report'), 'requester-d');
  const results = await Promise.all(Array.from({ length: 20 }, () => service.check({
    channel: 'sms', role: 'client', destination: '+32470000000', code: '123456', attemptToken: started.attemptToken,
  }, 'requester-d')));
  equal(sms.checkCalls, 1);
  ok(results.every((item: any) => item.approved === true));
  equal(new Set(results.map((item: any) => item.proofToken)).size, 1);
});

test('same clientRequestId replays a provider start failure without a second call', async () => {
  const { service, sms } = makeHarness();
  sms.failStart = true;
  await Promise.all(Array.from({ length: 20 }, () =>
    service.start(startInput('client-request-failure'), 'requester-e').catch((error) => error)));
  equal(sms.startCalls, 1);
  await rejects(service.start(startInput('client-request-failure'), 'requester-e'));
  equal(sms.startCalls, 1);
});

test('provider selection stays explicit and automatic fallback remains disabled', async () => {
  const { service, sms } = makeHarness();
  const result = await service.start(startInput('client-request-route'), 'requester-f');
  equal(result.provider, 'sinch');
  equal(sms.startCalls, 1);
});

test('provider interception timeout never becomes verification validity', async () => {
  const { service } = makeHarness();
  const result = await service.start(startInput('client-request-expiry-contract'), 'requester-g');
  equal(result.validForSeconds, 300);
});

test('provider Expired becomes a stable expired result and allows one fresh start', async () => {
  const { service, sms } = makeHarness();
  sms.checkResult = 'expired';
  const started = await service.start(startInput('client-request-expired'), 'requester-h');
  const first = await service.check({
    channel: 'sms', role: 'client', destination: '+32470000000', code: '123456', attemptToken: started.attemptToken,
  }, 'requester-h');
  equal(first.approved, false);
  equal(first.expired, true);
  equal(first.reasonCode, 'expired');
  equal(sms.checkCalls, 1);

  const replay = await service.check({
    channel: 'sms', role: 'client', destination: '+32470000000', code: '123456', attemptToken: started.attemptToken,
  }, 'requester-h');
  equal(replay.expired, true);
  equal(replay.replayed, true);
  equal(sms.checkCalls, 1);

  const fresh = await service.start(startInput('client-request-after-expired'), 'requester-h');
  notEqual(fresh.attemptToken, started.attemptToken);
  equal(sms.startCalls, 2);
});
