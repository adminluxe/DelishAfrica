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


// DA_C2_PKCE_SAFE_CORRELATION_HF2_TEMP
// Temporary diagnostic instrumentation. No code/verifier/nonce/token/password/cookie/raw callback values.
const daPkceRequestIds = new WeakMap<object, string>();
let daPkceRequestSeq = 0;

function daPkceRequestId(value: unknown): string {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return "none";
  const obj = value as object;
  const known = daPkceRequestIds.get(obj);
  if (known) return known;
  daPkceRequestSeq += 1;
  const id = `req-${daPkceRequestSeq}`;
  daPkceRequestIds.set(obj, id);
  return id;
}

function daPkceSafeTrace(event: string, fields: Record<string, unknown> = {}) {
  const allowed = new Set([
    "attemptId", "requestId", "phase", "responseType",
    "codePresent", "verifierPresent", "verifierLengthBucket",
    "exchangeStarted", "exchangeCompleted", "errorName", "errorCode"
  ]);
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (allowed.has(key)) safe[key] = value;
  }
  console.log("[DA_C2_PKCE_SAFE]", event, safe);
}

function daPkceVerifierLengthBucket(value: unknown): string {
  if (typeof value !== "string") return "missing";
  const n = value.length;
  if (n < 43) return "lt43";
  if (n <= 64) return "43-64";
  if (n <= 96) return "65-96";
  if (n <= 128) return "97-128";
  return "gt128";
}


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
  const daPkceAttemptSeq = useRef(0);

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
      daPkceAttemptSeq.current += 1;
      const daPkceAttemptId = `attempt-${daPkceAttemptSeq.current}`;
      const daPkceRequestIdBeforePrompt = daPkceRequestId(request);
      daPkceSafeTrace("PROMPT_STARTED", { attemptId: daPkceAttemptId, requestId: daPkceRequestIdBeforePrompt, phase: "prompt" });
      const result = await promptAsync();
      daPkceSafeTrace("PROMPT_RETURNED", { attemptId: daPkceAttemptId, requestId: daPkceRequestId(request), phase: "callback", responseType: result?.type, codePresent: Boolean((result as any)?.params?.code) });
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
      daPkceSafeTrace("VERIFIER_READY_FOR_EXCHANGE", { attemptId: typeof daPkceAttemptId !== "undefined" ? daPkceAttemptId : "unknown", requestId: daPkceRequestId(request), phase: "pre-exchange", verifierPresent: Boolean(verifier), verifierLengthBucket: daPkceVerifierLengthBucket(verifier) });
      if (!verifier) {
        setLastError('pkce_verifier_missing');
        return session;
      }

      pushTrace('Échange du code PKCE');
      daPkceSafeTrace("EXCHANGE_STARTED", { attemptId: typeof daPkceAttemptId !== "undefined" ? daPkceAttemptId : "unknown", requestId: daPkceRequestId(request), phase: "exchange", exchangeStarted: true });
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: DA_OIDC_CONFIG.clientId,
          code,
          redirectUri,
          extraParams: { code_verifier: verifier },
        },
        discovery,
      );
      daPkceSafeTrace("EXCHANGE_COMPLETED", { attemptId: typeof daPkceAttemptId !== "undefined" ? daPkceAttemptId : "unknown", requestId: daPkceRequestId(request), phase: "exchange", exchangeCompleted: true });
      const next = await establishOidcSession(tokenResponse, nonce);
      setSession(next);
      pushTrace('Session Keycloak validée');
      return next;
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
          ? String((error as { code: string }).code)
          : error instanceof Error
            ? error.name || 'oidc_login_failed'
            : 'oidc_login_failed';
      console.log(`[DA_C2_LOGIN_SAFE_ERROR] ${JSON.stringify({ code })}`);
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
