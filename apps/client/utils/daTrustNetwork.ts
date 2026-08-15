export type DaAddressSuggestion = {
  placeId: string;
  fullText: string;
  primaryText: string;
  secondaryText: string;
  types: string[];
};

export type DaResolvedAddress = {
  ok: boolean;
  status: 'confirmed' | 'review';
  address: {
    placeId: string;
    formattedAddress: string;
    latitude: number;
    longitude: number;
    precision: string;
    deliverable: boolean;
    evidence: string;
    resolvedAt: string;
  };
  territory: {
    key: string;
    countryCode: string;
    country: string;
    city: string;
    adminArea: string;
    postalCode: string;
    launchTarget: boolean;
  };
  message: string;
  notice: string;
};

export type DaTerritoryContext = {
  ok: boolean;
  detected: boolean;
  coordinates: { latitude: number; longitude: number };
  territory: {
    key: string;
    countryCode: string;
    country: string;
    city: string;
    adminArea: string;
    launchTarget: boolean;
  };
  formattedAddress: string;
  source: string;
  notice: string;
};

export type DaIdentityChannel = 'sms' | 'email';
export type DaIdentityRole = 'client' | 'merchant' | 'courier';
export type DaIdentityRoute = 'auto' | 'alternate';

export type DaIdentityProof = {
  token: string;
  verifiedAt: string;
  expiresAt: string;
  destination: string;
};

export type DaTrustNetworkError = Error & {
  code?: string;
  status?: number;
  providerStatus?: number;
  retryable?: boolean;
};

export type DaLocationErrorState = {
  blocked: boolean;
  code: string;
  message: string;
};

function apiBase(): string {
  const env = (globalThis as any)?.process?.env || {};
  const raw = env.EXPO_PUBLIC_API_BASE_URL || env.EXPO_PUBLIC_API_URL || 'https://api.delishafrica.me/api/v1';
  const clean = String(raw).replace(/\/+$/, '');
  return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
}

function buildNetworkError(data: any, responseStatus: number): DaTrustNetworkError {
  const error = new Error(
    String(data?.message || `Service indisponible (${responseStatus}).`),
  ) as DaTrustNetworkError;
  error.code = String(data?.code || 'network_request_failed');
  error.status = responseStatus;
  const providerStatus = Number(data?.providerStatus);
  if (Number.isFinite(providerStatus)) error.providerStatus = providerStatus;
  error.retryable = Boolean(data?.retryable ?? responseStatus >= 500);
  return error;
}

async function postJson<T>(path: string, body: Record<string, unknown>, timeout = 12_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw buildNetworkError(data, response.status);
    return data as T;
  } catch (error: any) {
    if (String(error?.name) === 'AbortError') {
      const timeoutError = new Error(
        'La v\u00e9rification a expir\u00e9. V\u00e9rifiez la connexion puis r\u00e9essayez.',
      ) as DaTrustNetworkError;
      timeoutError.code = 'network_timeout';
      timeoutError.retryable = true;
      throw timeoutError;
    }
    if (error instanceof Error) throw error;
    throw new Error('La v\u00e9rification est momentan\u00e9ment indisponible.');
  } finally {
    clearTimeout(timer);
  }
}

export function daDescribeLocationError(error: unknown): DaLocationErrorState {
  const value = (error || {}) as DaTrustNetworkError;
  const code = String(value.code || 'location_unknown_error');
  const providerStatus = Number(value.providerStatus || 0);
  const blocked =
    code === 'location_provider_not_configured' ||
    code === 'location_provider_blocked' ||
    code === 'location_provider_forbidden' ||
    providerStatus === 403;

  if (blocked) {
    return {
      blocked: true,
      code,
      message:
        "La vérification d’adresse est momentanément indisponible. Aucune saisie libre ne sera acceptée.",
    };
  }

  return {
    blocked: false,
    code,
    message: value.message || 'La recherche d\u2019adresse est momentan\u00e9ment indisponible.',
  };
}

export async function daAutocompleteAddress(input: {
  text: string;
  sessionToken: string;
  latitude?: number;
  longitude?: number;
  countryCodes?: string[];
}) {
  return postJson<{
    ok: boolean;
    sessionToken: string;
    suggestions: DaAddressSuggestion[];
  }>('/location-trust/autocomplete', {
    input: input.text,
    sessionToken: input.sessionToken,
    latitude: input.latitude,
    longitude: input.longitude,
    countryCodes: input.countryCodes || [],
  });
}

export async function daResolveAddress(placeId: string, sessionToken?: string) {
  return postJson<DaResolvedAddress>('/location-trust/resolve', { placeId, sessionToken });
}

export async function daResolveTerritory(latitude: number, longitude: number) {
  return postJson<DaTerritoryContext>('/location-trust/context', { latitude, longitude });
}

export function daNewIdentityRequestId(prefix = 'proof'): string {
  const cryptoObject = (globalThis as any)?.crypto;
  const uuid = typeof cryptoObject?.randomUUID === 'function'
    ? cryptoObject.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  return `${prefix}-${uuid}`;
}

export async function daStartIdentityProof(input: {
  channel: DaIdentityChannel;
  role: DaIdentityRole;
  destination: string;
  route?: DaIdentityRoute;
  clientRequestId?: string;
  resend?: boolean;
}) {
  return postJson<{
    ok: boolean;
    status: string;
    channel: DaIdentityChannel;
    maskedDestination: string;
    validForSeconds: number;
    expiresAt?: string;
    attemptToken?: string;
    clientRequestId?: string;
    reused?: boolean;
    provider?: 'sinch' | 'twilio' | 'postmark';
    alternateAvailable?: boolean;
    notice?: string;
  }>('/identity-proof/start', input);
}

export async function daCheckIdentityProof(input: {
  channel: DaIdentityChannel;
  role: DaIdentityRole;
  destination: string;
  code: string;
  attemptToken?: string;
}) {
  return postJson<{
    ok: boolean;
    approved: boolean;
    status: string;
    proofToken?: string;
    verifiedAt?: string;
    expiresAt?: string;
    provider?: 'sinch' | 'twilio' | 'postmark';
    message?: string;
    expired?: boolean;
    reasonCode?: string;
    replayed?: boolean;
  }>('/identity-proof/check', input);
}

export async function daAttestIdentityProof(input: {
  channel: DaIdentityChannel;
  role: DaIdentityRole;
  destination: string;
  proofToken: string;
}) {
  return postJson<{ ok: boolean; valid: boolean; expiresAt?: string | null; reason?: string }>(
    '/identity-proof/attest',
    input,
  );
}
