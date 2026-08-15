import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { DA_OIDC_CONFIG } from '../auth/daOidcConfig';
import {
  establishOidcSession,
  loadOidcSession,
  logoutOidcSession,
  refreshOidcSession,
} from '../auth/daOidcSession';
import type { DaOidcSession } from '../auth/daOidcTypes';

function anonymous(reason?: string): DaOidcSession {
  return {
    status: 'anonymous',
    provider: 'keycloak',
    role: DA_OIDC_CONFIG.role,
    reason,
  };
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
  const [nonce, setNonce] = useState<string | null>(null);
  const [session, setSession] = useState<DaOidcSession>(() => anonymous('initializing'));
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [trace, setTrace] = useState<string[]>([]);
  const consumedStates = useRef(new Set<string>());
  const loginInFlight = useRef(false);

  const pushTrace = useCallback((label: string) => {
    setTrace((previous) => [label, ...previous].slice(0, 8));
  }, []);

  const rotateNonce = useCallback(async () => {
    try {
      setNonce(await createNonce());
    } catch {
      setNonce(null);
      setLastError('nonce_generation_failed');
    }
  }, []);

  useEffect(() => {
    void rotateNonce();
    void loadOidcSession().then((next) => {
      setSession(next);
      pushTrace(next.status === 'authenticated' ? 'Session restaurée' : 'Session OIDC prête');
    });
  }, [pushTrace, rotateNonce]);

  const redirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ native: DA_OIDC_CONFIG.redirectUri }),
    [],
  );

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: DA_OIDC_CONFIG.clientId,
      responseType: AuthSession.ResponseType.Code,
      redirectUri,
      scopes: [...DA_OIDC_CONFIG.scopes],
      usePKCE: true,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      extraParams: nonce ? { nonce } : {},
    },
    discovery,
  );

  const signIn = useCallback(async () => {
    if (busy || loginInFlight.current) return session;
    if (!discovery) {
      setLastError('discovery_not_ready');
      return session;
    }
    if (!request || !nonce) {
      setLastError('authorization_request_not_ready');
      return session;
    }

    loginInFlight.current = true;
    setBusy(true);
    setLastError(null);
    pushTrace('Ouverture de la connexion sécurisée');
    try {
      const result = await promptAsync();
      if (result.type === 'cancel' || result.type === 'dismiss') {
        pushTrace('Connexion annulée');
        return session;
      }
      if (result.type !== 'success') {
        setLastError('authorization_failed');
        return session;
      }

      const code = result.params.code;
      const returnedState = result.params.state;
      if (!code || !returnedState || returnedState !== request.state) {
        setLastError('authorization_state_mismatch');
        return session;
      }
      if (consumedStates.current.has(returnedState)) {
        setLastError('authorization_response_replayed');
        return session;
      }
      consumedStates.current.add(returnedState);

      const verifier = request.codeVerifier;
      if (!verifier) {
        setLastError('pkce_verifier_missing');
        return session;
      }

      pushTrace('Échange du code PKCE');
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: DA_OIDC_CONFIG.clientId,
          code,
          redirectUri,
          extraParams: { code_verifier: verifier },
        },
        discovery,
      );
      const next = await establishOidcSession(tokenResponse, nonce);
      setSession(next);
      pushTrace('Session Keycloak validée');
      return next;
    } catch (error) {
      const code = error instanceof Error ? error.name || 'oidc_login_failed' : 'oidc_login_failed';
      setLastError(code);
      pushTrace('Connexion sécurisée interrompue');
      return session;
    } finally {
      loginInFlight.current = false;
      setBusy(false);
      await rotateNonce();
    }
  }, [busy, discovery, nonce, promptAsync, pushTrace, redirectUri, request, rotateNonce, session]);

  const restore = useCallback(async () => {
    setBusy(true);
    setLastError(null);
    try {
      const next = await loadOidcSession();
      setSession(next);
      pushTrace('Session relue');
      return next;
    } finally {
      setBusy(false);
    }
  }, [pushTrace]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setLastError(null);
    try {
      const next = await refreshOidcSession();
      setSession(next);
      pushTrace(next.status === 'authenticated' ? 'Session rafraîchie' : 'Réauthentification requise');
      return next;
    } finally {
      setBusy(false);
    }
  }, [pushTrace]);

  const logout = useCallback(async () => {
    setBusy(true);
    setLastError(null);
    try {
      const next = await logoutOidcSession();
      setSession(next);
      pushTrace('Déconnexion locale terminée');
      return next;
    } finally {
      setBusy(false);
      await rotateNonce();
    }
  }, [pushTrace, rotateNonce]);

  return {
    session,
    busy,
    lastError,
    trace,
    discoveryReady: Boolean(discovery),
    requestReady: Boolean(request && nonce),
    redirectUri,
    signIn,
    restore,
    refresh,
    logout,
  };
}
