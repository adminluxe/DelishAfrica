import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { parseEnrollmentRuntime, parsePendingRegistration, type EnrollmentApp, type EnrollmentRuntime, type PendingRegistration } from './daEnrollmentContract';

// Module state survives a native callback route remount. No tokens are persisted.
WebBrowser.maybeCompleteAuthSession();
export type EnrollmentState = Readonly<{ phase: 'idle' | 'opening' | 'saving' | 'pending' | 'error'; busy: boolean; receipt?: PendingRegistration; notice?: string }>;
let state: EnrollmentState = Object.freeze({ phase: 'idle', busy: false });
let epoch = 0, running = false;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();
export function enrollmentSnapshot(): EnrollmentState { return state; }
export function subscribeEnrollment(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
function publish(next: EnrollmentState): void { state = Object.freeze(next); listeners.forEach(fn => fn()); }
export function enrollmentRuntime(application: EnrollmentApp): EnrollmentRuntime | null {
  const config = Constants.expoConfig;
  return parseEnrollmentRuntime(application, config?.extra?.daEnrollment, {
    platform: Platform.OS, scheme: config?.scheme,
    packageId: Platform.OS === 'ios' ? config?.ios?.bundleIdentifier : config?.android?.package,
  });
}
function randomUrl(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i+1] || 0) << 8) | (bytes[i+2] || 0);
    out += chars[(n >>> 18) & 63] + chars[(n >>> 12) & 63];
    if (i+1 < bytes.length) out += chars[(n >>> 6) & 63];
    if (i+2 < bytes.length) out += chars[n & 63];
  }
  return out;
}
function current(generation: number): void { if (generation !== epoch) throw new Error('signup_cancelled'); }
function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve,reject) => { const timer = setTimeout(() => reject(new Error('signup_timeout')), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); }); });
}
export function cancelEnrollment(): void {
  epoch++; controller?.abort(); controller = null; running = false;
  try { WebBrowser.dismissAuthSession(); } catch { /* No native browser active. */ }
  publish({ phase: 'idle', busy: false });
}
export async function startEnrollment(application: EnrollmentApp, intent: 'register' | 'resume'): Promise<void> {
  if (running) return;
  const runtime = enrollmentRuntime(application);
  if (!runtime) { publish({ phase: 'error', busy: false, notice: 'La cr\u00e9ation de compte n\u2019est pas encore disponible dans cette version. Votre compte existant reste accessible.' }); return; }
  const generation = ++epoch; running = true;
  publish({ phase: 'opening', busy: true });
  let discovery: AuthSession.DiscoveryDocument | null = null;
  let tokens: AuthSession.TokenResponse | null = null;
  try {
    discovery = await timeout(AuthSession.fetchDiscoveryAsync(runtime.issuer), 12000); current(generation);
    const oidc = `${runtime.issuer}/protocol/openid-connect`;
    if (discovery.discoveryDocument?.issuer !== runtime.issuer
      || discovery.authorizationEndpoint !== `${oidc}/auth`
      || discovery.tokenEndpoint !== `${oidc}/token`
      || discovery.revocationEndpoint !== `${oidc}/revoke`) throw new Error('signup_provider_untrusted');
    const nonce = randomUrl(await Crypto.getRandomBytesAsync(32)); current(generation);
    const request = new AuthSession.AuthRequest({ clientId: runtime.clientId, redirectUri: runtime.redirectUri,
      responseType: AuthSession.ResponseType.Code, scopes: ['openid','profile','email'], usePKCE: true,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      extraParams: { nonce, ...(intent === 'resume' ? { prompt: 'login' } : {}) },
    });
    const result = await request.promptAsync({ ...discovery,
      authorizationEndpoint: intent === 'register' ? `${oidc}/registrations` : `${oidc}/auth` });
    current(generation);
    if (result.type === 'cancel' || result.type === 'dismiss') { publish({ phase: 'idle', busy: true }); return; }
    if (result.type !== 'success' || !result.params.code || result.params.state !== request.state || !request.codeVerifier) throw new Error('signup_callback_denied');
    // Do not abandon an unobserved token exchange: a late result is revoked below.
    tokens = await AuthSession.exchangeCodeAsync({ clientId: runtime.clientId, code: result.params.code,
      redirectUri: runtime.redirectUri, scopes: ['openid','profile','email'], extraParams: { code_verifier: request.codeVerifier } }, discovery);
    current(generation);
    if (!tokens.accessToken || !tokens.idToken || tokens.accessToken.length > 12288 || tokens.idToken.length > 12288) throw new Error('signup_tokens_denied');
    publish({ phase: 'saving', busy: true }); const requestController = new AbortController(); controller = requestController;
    const abort = setTimeout(() => requestController.abort(), 12000);
    let receipt: PendingRegistration | null = null;
    try {
      const response = await fetch(`${runtime.apiOrigin}/qa-only/identity-enrollment`, {
        method: 'POST', redirect: 'error', signal: requestController.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.accessToken}` },
        body: JSON.stringify({ application, idToken: tokens.idToken, nonce, requestId: Crypto.randomUUID() }),
      });
      current(generation);
      const text = await response.text(); current(generation);
      if (!response.ok || response.redirected || text.length > 16384 || !String(response.headers.get('content-type')).includes('application/json')) throw new Error('signup_api_denied');
      receipt = parsePendingRegistration(application, JSON.parse(text));
      if (!receipt) throw new Error('signup_receipt_denied');
    } finally { clearTimeout(abort); if (generation === epoch) controller = null; }
    current(generation); publish({ phase: 'pending', busy: true, receipt });
  } catch {
    if (generation === epoch) publish({ phase: 'error', busy: true,
      notice: 'Votre inscription n\u2019a pas pu \u00eatre finalis\u00e9e. Si votre compte a d\u00e9j\u00e0 \u00e9t\u00e9 cr\u00e9\u00e9, choisissez \u00ab Reprendre mon inscription \u00bb.' });
  } finally {
    if (tokens && discovery) {
      // Best effort token revocation, NOT a claim that the browser SSO is logged out.
      await Promise.allSettled([
        tokens.refreshToken ? timeout(AuthSession.revokeAsync({ clientId: runtime.clientId, token: tokens.refreshToken, tokenTypeHint: AuthSession.TokenTypeHint.RefreshToken }, discovery), 5000) : Promise.resolve(),
        timeout(AuthSession.revokeAsync({ clientId: runtime.clientId, token: tokens.accessToken, tokenTypeHint: AuthSession.TokenTypeHint.AccessToken }, discovery), 5000),
      ]);
    }
    tokens = null;
    if (generation === epoch) { running = false; controller = null; publish({ ...state, busy: false }); }
  }
}
