export type DaProfileTrustIssue = {
  field: 'name' | 'phone' | 'email' | 'address' | 'city' | 'request';
  code: string;
  message: string;
  severity: 'error' | 'review';
};

export type DaProfileTrustResult = {
  ok: boolean;
  decision: 'accept' | 'reject' | 'review';
  score: number;
  normalized: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
  };
  phone: { status: string };
  email: { domain: string; status: string; provider: string };
  issues: DaProfileTrustIssue[];
  checkedAt: string;
  notice: string;
};

function apiBase(): string {
  const env = (globalThis as any)?.process?.env || {};
  const raw = env.EXPO_PUBLIC_API_BASE_URL || env.EXPO_PUBLIC_API_URL || 'https://api.delishafrica.me/api/v1';
  const clean = String(raw).replace(/\/+$/, '');
  return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
}

export async function daInspectProfileTrust(input: {
  role: 'client' | 'merchant' | 'courier';
  name: string;
  phone: string;
  email: string;
  address?: string;
  city?: string;
}): Promise<DaProfileTrustResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${apiBase()}/profile-trust/inspect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      throw new Error(data?.message || `Contrôle indisponible (${response.status}).`);
    }
    return data as DaProfileTrustResult;
  } catch (error: any) {
    if (String(error?.name) === 'AbortError') {
      throw new Error('Le contrôle a expiré. Vérifiez votre connexion puis réessayez.');
    }
    throw new Error(error?.message || 'Le contrôle de confiance est indisponible.');
  } finally {
    clearTimeout(timer);
  }
}
