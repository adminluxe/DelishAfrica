import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import type { EnrollmentApp } from './daEnrollmentContract';

WebBrowser.maybeCompleteAuthSession();

const ISSUER = 'https://keycloak.afritaste.delishafrica.me/realms/afritaste';
const API = 'https://api.delishafrica.me/api/v1';
const PROFILES: Record<EnrollmentApp, {
  clientId: string; packageId: string; scheme: string; redirectUri: string;
}> = {
  client: {
    clientId: 'delishafrica-client',
    packageId: 'com.delishafrica.client',
    scheme: 'delishafricaclient',
    redirectUri: 'delishafricaclient://auth/callback',
  },
  merchant: {
    clientId: 'delishafrica-merchant',
    packageId: 'com.delishafrica.merchant',
    scheme: 'delishafricamerchant',
    redirectUri: 'delishafricamerchant://auth/callback',
  },
  courier: {
    clientId: 'delishafrica-courier',
    packageId: 'com.delishafrica.courier',
    scheme: 'delishafricacourier',
    redirectUri: 'delishafricacourier://auth/callback',
  },
};

export type ProductionRegistrationState = Readonly<{
  phase: 'idle' | 'opening' | 'verifying' | 'registered' | 'error';
  busy: boolean;
  email?: string;
  notice?: string;
}>;

let state: ProductionRegistrationState = Object.freeze({ phase: 'idle', busy: false });
let epoch = 0;
let running = false;
const listeners = new Set<() => void>();

export function productionRegistrationSnapshot(): ProductionRegistrationState { return state; }
export function subscribeProductionRegistration(listener: () => void): () => void {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
function publish(next: ProductionRegistrationState): void {
  state = Object.freeze(next); listeners.forEach((fn) => fn());
}
function schemeAllowed(raw: unknown, expected: string): boolean {
  if (typeof raw === 'string') return raw === expected;
  return Array.isArray(raw) && raw.includes(expected);
}
export function productionRegistrationAvailable(application: EnrollmentApp): boolean {
  const profile = PROFILES[application];
  const config = Constants.expoConfig;
  const packageId = Platform.OS === 'ios' ? config?.ios?.bundleIdentifier : config?.android?.package;
  return Boolean(
    (Platform.OS === 'ios' || Platform.OS === 'android')
    && packageId === profile.packageId
    && schemeAllowed(config?.scheme, profile.scheme)
    && !config?.extra?.daEnrollment,
  );
}
function current(generation: number): void {
  if (generation !== epoch) throw new Error('registration_cancelled');
}
function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('registration_timeout')), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); });
  });
}
function decodeJwt(token?: string): Record<string, any> {
  if (!token || token.split('.').length !== 3) return {};
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const B: any = (globalThis as any).Buffer;
    const raw = B
      ? B.from(padded, 'base64').toString('utf8')
      : decodeURIComponent(Array.prototype.map.call(
          atob(padded),
          (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2),
        ).join(''));
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
function audienceIncludes(value: unknown, expected: string): boolean {
  return value === expected || (Array.isArray(value) && value.includes(expected));
}
function safeNotice(error: unknown): string {
  const raw = String(error instanceof Error ? error.message : error || '');
  if (/cancel|dismiss|registration_cancelled/.test(raw)) return '';
  if (/email_not_verified/.test(raw))
    return 'Confirmez votre adresse email dans la fenêtre sécurisée avant de revenir dans DelishAfrica®.';
  if (/registration_not_available|registration_disabled/.test(raw))
    return 'La création de compte est momentanément fermée. Réessayez un peu plus tard.';
  if (/network|fetch|timeout|discovery/.test(raw))
    return 'La connexion sécurisée est momentanément indisponible. Vérifiez votre réseau et réessayez.';
  return 'Votre inscription n’a pas pu être finalisée. Si le compte existe déjà, choisissez « Reprendre mon inscription ».';
}

export function cancelProductionRegistration(): void {
  epoch += 1; running = false;
  try { WebBrowser.dismissAuthSession(); } catch { /* no browser */ }
  publish({ phase: 'idle', busy: false });
}

export async function startProductionRegistration(
  application: EnrollmentApp,
  intent: 'register' | 'resume',
): Promise<void> {
  if (running) return;
  if (!productionRegistrationAvailable(application)) {
    publish({ phase: 'error', busy: false, notice: 'Cette porte d’inscription n’est pas disponible dans cette version.' });
    return;
  }
  const profile = PROFILES[application];
  const generation = ++epoch;
  running = true;
  publish({ phase: 'opening', busy: true });
  let discovery: AuthSession.DiscoveryDocument | null = null;
  let tokens: AuthSession.TokenResponse | null = null;
  try {
    discovery = await timeout(AuthSession.fetchDiscoveryAsync(ISSUER), 12000);
    current(generation);
    const oidc = `${ISSUER}/protocol/openid-connect`;
    if (
      discovery.discoveryDocument?.issuer !== ISSUER
      || discovery.authorizationEndpoint !== `${oidc}/auth`
      || discovery.tokenEndpoint !== `${oidc}/token`
      || discovery.revocationEndpoint !== `${oidc}/revoke`
    ) throw new Error('registration_provider_untrusted');

    const nonce = Crypto.randomUUID();
    const request = new AuthSession.AuthRequest({
      clientId: profile.clientId,
      redirectUri: profile.redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      extraParams: { nonce, ...(intent === 'register' ? { prompt: 'create' } : { prompt: 'login' }) },
    });
    const authorizationEndpoint = intent === 'register'
      ? `${oidc}/registrations`
      : `${oidc}/auth`;
    const result = await request.promptAsync({ ...discovery, authorizationEndpoint });
    current(generation);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      publish({ phase: 'idle', busy: false }); return;
    }
    if (result.type !== 'success' || !result.params?.code || !request.codeVerifier) {
      throw new Error('registration_callback_denied');
    }
    tokens = await timeout(AuthSession.exchangeCodeAsync({
      clientId: profile.clientId,
      code: result.params.code,
      redirectUri: profile.redirectUri,
      scopes: ['openid', 'profile', 'email'],
      extraParams: { code_verifier: request.codeVerifier },
    }, discovery), 12000);
    current(generation);
    if (!tokens.accessToken || !tokens.idToken) throw new Error('registration_tokens_missing');

    const id = decodeJwt(tokens.idToken);
    if (id.iss !== ISSUER) throw new Error('registration_issuer_mismatch');
    if (!audienceIncludes(id.aud, profile.clientId)) throw new Error('registration_audience_mismatch');
    if (id.nonce !== nonce) throw new Error('registration_nonce_mismatch');
    if (typeof id.sub !== 'string' || !id.sub) throw new Error('registration_subject_missing');
    if (id.email_verified !== true) throw new Error('email_not_verified');

    publish({ phase: 'verifying', busy: true });
    const response = await timeout(fetch(`${API}/auth/registration/verify`, {
      method: 'POST',
      redirect: 'error',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ application, token: tokens.accessToken }),
    }), 12000);
    current(generation);
    const body = await response.json().catch(() => null);
    if (
      !response.ok || response.redirected || body?.ok !== true
      || body?.identityVerified !== true || body?.emailVerified !== true
      || body?.professionalAccessGranted !== false || body?.subject !== id.sub
    ) throw new Error('registration_server_verification_failed');

    publish({
      phase: 'registered',
      busy: false,
      email: typeof body.email === 'string' ? body.email : undefined,
      notice: application === 'client'
        ? 'Votre identité et votre email sont vérifiés. Revenez à la connexion pour ouvrir votre espace.'
        : 'Votre identité et votre email sont vérifiés. Aucun accès professionnel n’a été ouvert automatiquement.',
    });
  } catch (error) {
    if (generation === epoch) publish({ phase: 'error', busy: false, notice: safeNotice(error) });
  } finally {
    if (tokens && discovery) {
      await Promise.allSettled([
        tokens.refreshToken
          ? timeout(AuthSession.revokeAsync({
              clientId: profile.clientId,
              token: tokens.refreshToken,
              tokenTypeHint: AuthSession.TokenTypeHint.RefreshToken,
            }, discovery), 5000)
          : Promise.resolve(),
        timeout(AuthSession.revokeAsync({
          clientId: profile.clientId,
          token: tokens.accessToken || '',
          tokenTypeHint: AuthSession.TokenTypeHint.AccessToken,
        }, discovery), 5000),
      ]);
    }
    tokens = null;
    if (generation === epoch) { running = false; publish({ ...state, busy: false }); }
  }
}
