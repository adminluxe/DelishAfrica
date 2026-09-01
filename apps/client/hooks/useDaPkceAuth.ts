import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { DA_OIDC_CONFIG } from '../auth/daOidcConfig';
import {
  establishOidcSession,
  loadOidcSession,
  logoutOidcSession,
  refreshOidcSession,
} from '../auth/daOidcSession';
import type { DaOidcSession } from '../auth/daOidcTypes';

// DA_SHARED_MERCHANT_PROVEN_PKCE_ENGINE_V1
WebBrowser.maybeCompleteAuthSession();

function anonymous(reason?: string): DaOidcSession {
  return { status: 'anonymous', provider: 'keycloak', role: DA_OIDC_CONFIG.role, reason } as DaOidcSession;
}

function failed(reason: string): DaOidcSession {
  return { status: 'error', provider: 'keycloak', role: DA_OIDC_CONFIG.role, reason } as DaOidcSession;
}

function safeErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; name?: unknown };
    if (typeof candidate.code === 'string' && /^[a-z0-9_.:-]{1,96}$/i.test(candidate.code)) return candidate.code;
    if (typeof candidate.name === 'string' && /^[a-z0-9_.:-]{1,96}$/i.test(candidate.name)) return candidate.name;
  }
  return 'oidc_login_failed';
}

function toBase64Url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const c = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const value = (a << 16) | (b << 8) | c;
    out += alphabet[(value >> 18) & 63];
    out += alphabet[(value >> 12) & 63];
    if (index + 1 < bytes.length) out += alphabet[(value >> 6) & 63];
    if (index + 2 < bytes.length) out += alphabet[value & 63];
  }
  return out;
}

async function createNonce(): Promise<string> {
  return toBase64Url(await Crypto.getRandomBytesAsync(32));
}

export function useDaPkceAuth() {
  const discovery = AuthSession.useAutoDiscovery(DA_OIDC_CONFIG.issuer);
  const [session, setSession] = useState<DaOidcSession>(() => anonymous('initializing'));
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [trace, setTrace] = useState<string[]>([]);
  const loginInFlight = useRef(false);

  const pushTrace = useCallback((label: string) => {
    setTrace((previous) => [label, ...previous].slice(0, 8));
  }, []);

  useEffect(() => {
    void loadOidcSession().then((next) => {
      setSession(next);
      pushTrace(next.status === 'authenticated' ? 'Session restaurée' : 'Session OIDC prête');
    });
  }, [pushTrace]);

  const redirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ native: DA_OIDC_CONFIG.redirectUri }),
    [],
  );

  const signIn = useCallback(async () => {
    if (busy || loginInFlight.current) return session;
    if (!discovery) {
      const next = failed('discovery_not_ready');
      setLastError(next.reason || 'discovery_not_ready');
      setSession(next);
      return next;
    }

    loginInFlight.current = true;
    setBusy(true);
    setLastError(null);
    pushTrace('Ouverture du navigateur système');

    try {
      const attemptNonce = await createNonce();
      const authRequest = new AuthSession.AuthRequest({
        clientId: DA_OIDC_CONFIG.clientId,
        responseType: AuthSession.ResponseType.Code,
        redirectUri,
        scopes: [...DA_OIDC_CONFIG.scopes],
        usePKCE: true,
        codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
        prompt: (AuthSession as any).Prompt?.Login || 'login',
        extraParams: { nonce: attemptNonce },
      });

      const result = await authRequest.promptAsync(discovery);
      if (result.type === 'cancel' || result.type === 'dismiss') return session;
      if (result.type !== 'success') {
        const next = failed(`authorization_${String(result.type || 'failed')}`);
        setLastError(next.reason || 'authorization_failed');
        setSession(next);
        return next;
      }

      const code = result.params?.code;
      if (!code) {
        const next = failed('authorization_code_missing');
        setLastError(next.reason || 'authorization_code_missing');
        setSession(next);
        return next;
      }
      if (!authRequest.codeVerifier) {
        const next = failed('pkce_verifier_missing');
        setLastError(next.reason || 'pkce_verifier_missing');
        setSession(next);
        return next;
      }

      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: DA_OIDC_CONFIG.clientId,
          code,
          redirectUri,
          scopes: [...DA_OIDC_CONFIG.scopes],
          extraParams: { code_verifier: authRequest.codeVerifier },
        },
        discovery,
      );

      const next = await establishOidcSession(tokenResponse, attemptNonce);
      setSession(next);
      setLastError(next.status === 'error' ? next.reason || 'oidc_session_failed' : null);
      pushTrace(next.status === 'authenticated' ? 'Session Client validée' : 'Session non confirmée');
      return next;
    } catch (error) {
      const code = safeErrorCode(error);
      const next = failed(code);
      setLastError(code);
      setSession(next);
      return next;
    } finally {
      loginInFlight.current = false;
      setBusy(false);
    }
  }, [busy, discovery, pushTrace, redirectUri, session]);

  const restore = useCallback(async () => {
    setBusy(true); setLastError(null);
    try {
      const next = await loadOidcSession();
      setSession(next);
      if (next.status === 'error') setLastError(next.reason || 'oidc_rehydrate_failed');
      return next;
    } finally { setBusy(false); }
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true); setLastError(null);
    try {
      const next = await refreshOidcSession();
      setSession(next);
      if (next.status === 'error') setLastError(next.reason || 'refresh_failed');
      return next;
    } finally { setBusy(false); }
  }, []);

  const logout = useCallback(async () => {
    setBusy(true); setLastError(null);
    try {
      const next = await logoutOidcSession();
      setSession(next);
      return next;
    } finally { setBusy(false); }
  }, []);

  return {
    session, busy, lastError, trace,
    discoveryReady: Boolean(discovery),
    requestReady: Boolean(discovery),
    redirectUri, signIn, restore, refresh, logout,
  };
}
