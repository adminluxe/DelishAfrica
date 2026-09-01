import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const ROLE = 'courier' as const;
const CLIENT_ID = 'delishafrica-courier';
const SCHEME = 'delishafricacourier';
const ISSUER = 'https://keycloak.afritaste.delishafrica.me/realms/afritaste';
const API = 'https://api.delishafrica.me/api/v1';
const OTHER_ROLE = 'merchant';
const EXPECTED_USERNAME = 'courier.acceptance';

type Json = Record<string, any>;
type GateHttp = { status: number; code: string };

export type Hf16IdentityResult = {
  ok: boolean;
  role: typeof ROLE;
  redirectUri: string;
  apiMe: number;
  clientBoundary: number;
  crossRoleBoundary: number;
  realmRole: boolean;
  audienceMatch: boolean;
  authorizedParty: boolean;
  expectedUser: boolean;
  username: string;
  subjectPresent: boolean;
  apiReason: string;
  proof: string;
  reason?: string;
};

function decodeJwt(token?: string): Json {
  if (!token || token.split('.').length < 2) return {};
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const B: any = (globalThis as any).Buffer;
    const raw = B
      ? B.from(padded, 'base64').toString('utf8')
      : decodeURIComponent(
          Array.prototype.map.call(
            atob(padded),
            (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2),
          ).join(''),
        );
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

function hasRole(payload: Json): boolean {
  const realm = stringArray(payload?.realm_access?.roles);
  const client = stringArray(payload?.resource_access?.[CLIENT_ID]?.roles);
  const flat = stringArray(payload?.roles);
  const single = typeof payload?.role === 'string' ? [payload.role] : [];
  return [...realm, ...client, ...flat, ...single].some((x) => x.toLowerCase() === ROLE);
}

function audienceIncludes(value: unknown, expected: string): boolean {
  if (typeof value === 'string') return value === expected;
  return Array.isArray(value) && value.some((x) => x === expected);
}

async function gateStatus(url: string, accessToken: string): Promise<GateHttp> {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    let code = '';
    try {
      const data = await response.json();
      code = typeof data?.code === 'string' ? data.code : typeof data?.reason === 'string' ? data.reason : '';
    } catch {}
    return { status: response.status, code: code.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80) };
  } catch {
    return { status: 0, code: 'network_error' };
  }
}

function resultFailure(redirectUri: string, reason: string): Hf16IdentityResult {
  return {
    ok: false,
    role: ROLE,
    redirectUri,
    apiMe: 0,
    clientBoundary: 0,
    crossRoleBoundary: 0,
    realmRole: false,
    audienceMatch: false,
    authorizedParty: false,
    expectedUser: false,
    username: '',
    subjectPresent: false,
    apiReason: '',
    proof: '',
    reason,
  };
}

export async function certifyHf16RealIdentity(): Promise<Hf16IdentityResult> {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: SCHEME, path: 'auth/callback' });
  try {
    const discovery = await AuthSession.fetchDiscoveryAsync(ISSUER);
    const request = new AuthSession.AuthRequest({
      clientId: CLIENT_ID,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'profile', 'email', 'roles'],
      usePKCE: true,
      extraParams: {
        prompt: 'login',
        max_age: '0',
        login_hint: EXPECTED_USERNAME,
      },
    });
    const authorization = await request.promptAsync(discovery);
    if (authorization.type !== 'success') return resultFailure(redirectUri, `authorization_${authorization.type}`);
    const code = typeof authorization.params?.code === 'string' ? authorization.params.code : '';
    const verifier = request.codeVerifier || '';
    if (!code || !verifier) return resultFailure(redirectUri, 'authorization_code_or_verifier_missing');

    const token = await AuthSession.exchangeCodeAsync(
      { clientId: CLIENT_ID, code, redirectUri, extraParams: { code_verifier: verifier } },
      discovery,
    );
    const accessToken = token.accessToken || '';
    if (!accessToken) return resultFailure(redirectUri, 'access_token_missing');

    const payload = decodeJwt(accessToken);
    const realmRole = hasRole(payload);
    const audienceMatch = audienceIncludes(payload?.aud, CLIENT_ID);
    const authorizedParty = typeof payload?.azp === 'string' && payload.azp === CLIENT_ID;
    const username = typeof payload?.preferred_username === 'string' ? payload.preferred_username : '';
    const expectedUser = username === EXPECTED_USERNAME;
    const subjectPresent = typeof payload?.sub === 'string' && payload.sub.length > 0;
    const apiMeGate = await gateStatus(`${API}/auth/${ROLE}/me`, accessToken);
    const clientGate = await gateStatus(`${API}/auth/client/me`, accessToken);
    const crossGate = await gateStatus(`${API}/auth/${OTHER_ROLE}/me`, accessToken);
    const ok =
      realmRole &&
      audienceMatch &&
      authorizedParty &&
      expectedUser &&
      subjectPresent &&
      apiMeGate.status === 200 &&
      clientGate.status === 403 &&
      crossGate.status === 403;
    const stamp = String(Date.now()).slice(-8);
    const proof = ok
      ? `HF16-${ROLE.toUpperCase()}-${stamp}-ME200-C403-X403-R1-AUD1-AZP1-U1-S1`
      : '';
    return {
      ok,
      role: ROLE,
      redirectUri,
      apiMe: apiMeGate.status,
      clientBoundary: clientGate.status,
      crossRoleBoundary: crossGate.status,
      realmRole,
      audienceMatch,
      authorizedParty,
      expectedUser,
      username,
      subjectPresent,
      apiReason: apiMeGate.code,
      proof,
      ...(ok ? {} : { reason: 'identity_gate_failed' }),
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error || 'hf16_identity_failed');
    return resultFailure(redirectUri, /^[A-Za-z0-9_.:-]{1,120}$/.test(raw) ? raw : 'hf16_identity_failed');
  }
}

export function hf16ExpectedIdentity() {
  return { role: ROLE, clientId: CLIENT_ID, username: EXPECTED_USERNAME } as const;
}
