/** One API environment per installed application. No production fallback on mobile. */
export type ApiEnvironmentInput = {
  apiBaseUrl?: unknown; apiUrl?: unknown; nativeApiBaseUrl?: unknown; nativeApiUrl?: unknown;
  releaseRing?: unknown; nativeReleaseRing?: unknown; development?: boolean;
};
export type ApiEnvironment = { baseUrl: string; origin: string; ring: string; scope: string };
export const QA_API_ORIGIN = 'https://ataraxie-api.delishafrica.me';
export const PRODUCTION_API_ORIGIN = 'https://api.delishafrica.me';
function splitAbsolute(value: string): { scheme: string; authority: string; path: string; query: string } {
  const match = /^([a-z]+):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?$/i.exec(value);
  if (!match || match[2].includes('@') || match[2].includes('\\')) throw new Error('api_environment_invalid');
  return { scheme: match[1].toLowerCase(), authority: match[2].toLowerCase(), path: match[3] || '', query: match[4] || '' };
}
function originOf(parts: ReturnType<typeof splitAbsolute>, development: boolean): string {
  const standard = parts.authority.replace(parts.scheme === 'https' ? /:443$/ : /:80$/, '');
  const origin = parts.scheme + '://' + standard;
  if ([QA_API_ORIGIN, PRODUCTION_API_ORIGIN].includes(origin)) return origin;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::([0-9]{1,5}))?$/.exec(parts.authority);
  if (development && local && ['http', 'https'].includes(parts.scheme)
    && (!local[2] || (Number(local[2]) > 0 && Number(local[2]) <= 65535))) return origin;
  throw new Error('api_environment_host_unapproved');
}
function normalize(value: unknown, development: boolean): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !value.trim()) throw new Error('api_environment_invalid');
  const parts = splitAbsolute(value.trim());
  if (parts.query) throw new Error('api_environment_invalid');
  const path = parts.path.replace(/\/+$/, '');
  if (!['', '/api', '/api/v1'].includes(path)) throw new Error('api_environment_path_invalid');
  return originOf(parts, development) + '/api/v1';
}
export function resolveApiEnvironment(input: ApiEnvironmentInput): ApiEnvironment {
  const bases = [input.apiBaseUrl, input.apiUrl, input.nativeApiBaseUrl, input.nativeApiUrl]
    .map(value => normalize(value, input.development === true)).filter((v): v is string => Boolean(v));
  if (!bases.length) throw new Error('api_environment_unconfigured');
  if (new Set(bases).size !== 1) throw new Error('api_environment_conflict');
  const rings = [input.releaseRing, input.nativeReleaseRing].filter(v => typeof v === 'string' && v.trim()).map(v => String(v).trim());
  if (new Set(rings).size > 1) throw new Error('api_release_ring_conflict');
  const baseUrl = bases[0], origin = baseUrl.slice(0, -'/api/v1'.length);
  const ring = rings[0] || (origin === QA_API_ORIGIN ? 'ataraxie' : origin === PRODUCTION_API_ORIGIN ? 'production' : 'development');
  if ((ring.startsWith('ataraxie') || ring === 'qa') && origin !== QA_API_ORIGIN) throw new Error('qa_api_environment_mismatch');
  if (ring === 'production' && origin !== PRODUCTION_API_ORIGIN) throw new Error('production_api_environment_mismatch');
  return { baseUrl, origin, ring, scope: baseUrl };
}
export function assertApiRequestTarget(input: string, environment: ApiEnvironment): string {
  const parts = splitAbsolute(input), origin = originOf(parts, environment.ring === 'development');
  let decoded: string; try { decoded = decodeURIComponent(parts.path); } catch { throw new Error('api_request_target_invalid'); }
  if (origin !== environment.origin || !(decoded === '/api/v1' || decoded.startsWith('/api/v1/'))
    || decoded.includes('\\') || decoded.split('/').some(part => part === '.' || part === '..')) throw new Error('api_request_target_outside_environment');
  return origin + parts.path + parts.query;
}
