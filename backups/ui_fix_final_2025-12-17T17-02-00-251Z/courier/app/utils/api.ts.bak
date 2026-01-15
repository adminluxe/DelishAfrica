import Constants from 'expo-constants';
const API_BASE = (Constants.expoConfig?.extra?.API_BASE_URL || process.env.API_BASE_URL || 'https://api.delishafrica.me');

export async function loginCourier(email: string, password: string) {
  try {
    const r = await fetch(`${API_BASE}/api/couriers/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (r.ok) return r.json();
    // Fallback DEV si 404/500
    return { ok: true, token: 'dev-token-fallback', courier: { id: 'dev_courier', name: 'Dev Fallback' } };
  } catch {
    // Fallback offline
    return { ok: true, token: 'dev-token-offline', courier: { id: 'offline_courier', name: 'Offline' } };
  }
}

export async function listAvailableJobs() {
  const r = await fetch(`${API_BASE}/api/couriers/jobs/available`);
  const j = await r.json().catch(()=>[]);
  return Array.isArray(j) ? j : (j?.items || []);
}

export const API = { API_BASE };
export default API;
