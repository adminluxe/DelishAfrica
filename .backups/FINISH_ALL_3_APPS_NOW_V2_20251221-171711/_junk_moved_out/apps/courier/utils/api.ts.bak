import Constants from 'expo-constants';
import { getToken, getRefresh, setTokens, clearToken } from './auth';

const EXTRA = Constants.expoConfig?.extra || {};
const API_BASE = (EXTRA.API_BASE_URL || EXTRA.API_URL || 'https://api.delishafrica.me').replace(/\/+$/,'');

async function doFetch(url:string, init:RequestInit){
  const token = await getToken();
  const headers = new Headers(init.headers || {});
  headers.set('Accept', 'application/json');

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!headers.has('Content-Type') && init.body && !isFormData) headers.set('Content-Type','application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export async function apiFetch(path:string, init:RequestInit = {}) {
  let res = await doFetch(`${API_BASE}${path}`, init);
  if (res.status !== 401) return res;

  // tentative de refresh
  const rt = await getRefresh();
  if (!rt) return res;

  const r2 = await fetch(`${API_BASE}/api/auth/refresh`, {
    method:'POST', headers:{'content-type':'application/json','accept':'application/json'},
    body: JSON.stringify({ refreshToken: rt })
  });
  if (!r2.ok) return res;
  const data = await r2.json();
  if (data?.accessToken) await setTokens(data.accessToken, data.refreshToken);

  // rejoue la requête
  res = await doFetch(`${API_BASE}${path}`, init);
  if (res.status === 401) await clearToken();
  return res;
}

export { API_BASE };
