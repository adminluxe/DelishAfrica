import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import type {
  AtmosphereCurrent,
  AtmosphereMetrics,
  AtmosphereMode,
  AtmosphereTuning,
} from './atmosphere.types';

type CacheEntry = {
  value: AtmosphereCurrent;
  fetchedAt: number;
  lastModified?: string;
};

type OverridePayload = {
  mode?: AtmosphereMode | 'auto';
  updatedAt?: string;
  expiresAt?: string;
};

const MET_ENDPOINT = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const MET_USER_AGENT =
  process.env.DA_ATMOSPHERE_USER_AGENT ||
  'DelishAfrica/1.0 https://delishafrica.me';
const MARKET_LABEL =
  process.env.DA_ATMOSPHERE_MARKET_LABEL || 'Bruxelles / Ixelles';
const MARKET_LAT = finiteEnv('DA_ATMOSPHERE_MARKET_LAT', 50.83558, -90, 90);
const MARKET_LON = finiteEnv('DA_ATMOSPHERE_MARKET_LON', 4.36756, -180, 180);
const CACHE_TTL_MS = 15 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 3800;
const RUNTIME_DIR =
  process.env.DA_ATMOSPHERE_RUNTIME_DIR ||
  '/app/services/api-nest/.runtime/atmosphere';
const OVERRIDE_FILE = `${RUNTIME_DIR}/override.json`;

const ATTRIBUTION = {
  label: 'MET Norway' as const,
  license: 'CC BY 4.0' as const,
  url: 'https://api.met.no/' as const,
};

function finiteEnv(
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

function finiteOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

@Injectable()
export class AtmosphereService {
  private cache: CacheEntry | null = null;

  health() {
    const override = this.runtimeOverride();
    return {
      ok: true,
      service: 'atmosphere-current',
      provider: 'met_norway_locationforecast_2_compact',
      market: MARKET_LABEL,
      providerUserAgentConfigured: Boolean(MET_USER_AGENT),
      cacheTtlMs: CACHE_TTL_MS,
      cacheAgeMs: this.cache ? Math.max(0, Date.now() - this.cache.fetchedAt) : null,
      override: override?.mode || 'auto',
      privacy: {
        userGpsRequested: false,
        providerReceivesMarketAnchorOnly: true,
        marketCoordinatesReturnedToApps: false,
      },
      attribution: ATTRIBUTION,
    };
  }

  async current(): Promise<AtmosphereCurrent> {
    const override = this.runtimeOverride();
    if (override && override.mode && override.mode !== 'auto') {
      const base = this.cache?.value;
      const checkedAt = new Date().toISOString();
      return {
        ok: true,
        mode: override.mode,
        source: 'override',
        market: MARKET_LABEL,
        observedAt: override.updatedAt || checkedAt,
        checkedAt,
        metrics: base?.metrics || this.emptyMetrics(),
        tuning: this.tuningFor(override.mode, base?.metrics || this.emptyMetrics()),
        attribution: ATTRIBUTION,
      };
    }

    const now = Date.now();
    if (this.cache && now - this.cache.fetchedAt < CACHE_TTL_MS) {
      return {
        ...this.cache.value,
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      const fresh = await this.fetchLive();
      this.cache = fresh;
      return fresh.value;
    } catch {
      if (this.cache) {
        return {
          ...this.cache.value,
          source: 'stale',
          checkedAt: new Date().toISOString(),
        };
      }

      const checkedAt = new Date().toISOString();
      const metrics = this.emptyMetrics();
      return {
        ok: true,
        mode: 'clear',
        source: 'fallback',
        market: MARKET_LABEL,
        observedAt: checkedAt,
        checkedAt,
        metrics,
        tuning: this.tuningFor('clear', metrics),
        attribution: ATTRIBUTION,
      };
    }
  }

  private runtimeOverride(): OverridePayload | null {
    try {
      if (!fs.existsSync(OVERRIDE_FILE)) return null;
      const parsed = JSON.parse(fs.readFileSync(OVERRIDE_FILE, 'utf8')) as OverridePayload;
      const mode = String(parsed?.mode || '').trim() as AtmosphereMode | 'auto';
      if (!['auto', 'clear', 'cloud', 'mist', 'rain', 'storm', 'snow', 'heat'].includes(mode)) {
        return null;
      }

      if (parsed.expiresAt) {
        const expiry = Date.parse(parsed.expiresAt);
        if (Number.isFinite(expiry) && expiry <= Date.now()) return null;
      }

      return {
        mode,
        updatedAt:
          typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
        expiresAt:
          typeof parsed.expiresAt === 'string' ? parsed.expiresAt : undefined,
      };
    } catch {
      return null;
    }
  }

  private async fetchLive(): Promise<CacheEntry> {
    const fetchFn = (globalThis as any).fetch;
    const AbortControllerCtor = (globalThis as any).AbortController;
    if (typeof fetchFn !== 'function') throw new Error('fetch_unavailable');

    const controller =
      typeof AbortControllerCtor === 'function' ? new AbortControllerCtor() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
      : null;

    try {
      const url =
        `${MET_ENDPOINT}?lat=${MARKET_LAT.toFixed(4)}&lon=${MARKET_LON.toFixed(4)}`;
      const headers: Record<string, string> = {
        'user-agent': MET_USER_AGENT,
        accept: 'application/json',
      };
      if (this.cache?.lastModified) {
        headers['if-modified-since'] = this.cache.lastModified;
      }

      const response = await fetchFn(url, {
        method: 'GET',
        headers,
        signal: controller?.signal,
      });

      if (response.status === 304 && this.cache) {
        return {
          ...this.cache,
          fetchedAt: Date.now(),
        };
      }

      if (!response.ok) throw new Error(`met_http_${response.status}`);

      const raw = await response.json();
      const normalized = this.normalizeMet(raw);
      const value: AtmosphereCurrent = {
        ok: true,
        mode: normalized.mode,
        source: 'live',
        market: MARKET_LABEL,
        observedAt: normalized.observedAt,
        checkedAt: new Date().toISOString(),
        metrics: normalized.metrics,
        tuning: this.tuningFor(normalized.mode, normalized.metrics),
        attribution: ATTRIBUTION,
      };

      return {
        value,
        fetchedAt: Date.now(),
        lastModified: response.headers?.get?.('last-modified') || undefined,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private normalizeMet(raw: any): {
    mode: AtmosphereMode;
    observedAt: string;
    metrics: AtmosphereMetrics;
  } {
    const point = Array.isArray(raw?.properties?.timeseries)
      ? raw.properties.timeseries[0]
      : null;
    if (!point?.data?.instant?.details) throw new Error('invalid_met_payload');

    const instant = point.data.instant.details;
    const nextHour = point.data.next_1_hours || {};
    const metrics: AtmosphereMetrics = {
      temperatureC: finiteOrNull(instant.air_temperature),
      humidityPct: finiteOrNull(instant.relative_humidity),
      precipitationMm: finiteOrNull(nextHour?.details?.precipitation_amount),
      windKmh:
        finiteOrNull(instant.wind_speed) === null
          ? null
          : Number((Number(instant.wind_speed) * 3.6).toFixed(1)),
      cloudPct: finiteOrNull(instant.cloud_area_fraction),
      symbolCode:
        typeof nextHour?.summary?.symbol_code === 'string'
          ? nextHour.summary.symbol_code
          : null,
    };

    return {
      mode: this.classify(metrics),
      observedAt:
        typeof point.time === 'string' ? point.time : new Date().toISOString(),
      metrics,
    };
  }

  private classify(metrics: AtmosphereMetrics): AtmosphereMode {
    const symbol = (metrics.symbolCode || '').toLowerCase();
    const precipitation = metrics.precipitationMm || 0;
    const humidity = metrics.humidityPct || 0;
    const cloud = metrics.cloudPct || 0;
    const temperature = metrics.temperatureC;

    if (symbol.includes('thunder')) return 'storm';
    if (symbol.includes('snow') || symbol.includes('sleet')) return 'snow';
    if (
      symbol.includes('rain') ||
      symbol.includes('drizzle') ||
      precipitation >= 0.15
    ) {
      return 'rain';
    }
    if (symbol.includes('fog') || (humidity >= 92 && cloud >= 72)) return 'mist';
    if (temperature !== null && temperature >= 30 && precipitation < 0.05) {
      return 'heat';
    }
    if (cloud >= 62 || symbol.includes('cloud')) return 'cloud';
    return 'clear';
  }

  private tuningFor(
    mode: AtmosphereMode,
    metrics: AtmosphereMetrics,
  ): AtmosphereTuning {
    const presets: Record<AtmosphereMode, AtmosphereTuning> = {
      clear: {
        rain: 0.06,
        wetness: 0.42,
        condensation: 0.12,
        mist: 0.04,
        glint: 1.08,
        motion: 0.82,
      },
      cloud: {
        rain: 0.1,
        wetness: 0.58,
        condensation: 0.26,
        mist: 0.2,
        glint: 0.78,
        motion: 0.78,
      },
      mist: {
        rain: 0.05,
        wetness: 0.74,
        condensation: 0.82,
        mist: 0.92,
        glint: 0.36,
        motion: 0.52,
      },
      rain: {
        rain: 0.82,
        wetness: 0.92,
        condensation: 0.72,
        mist: 0.42,
        glint: 0.58,
        motion: 1,
      },
      storm: {
        rain: 1,
        wetness: 1,
        condensation: 0.86,
        mist: 0.5,
        glint: 0.34,
        motion: 1.18,
      },
      snow: {
        rain: 0.14,
        wetness: 0.68,
        condensation: 0.46,
        mist: 0.72,
        glint: 0.88,
        motion: 0.64,
      },
      heat: {
        rain: 0.02,
        wetness: 0.28,
        condensation: 0.05,
        mist: 0.03,
        glint: 1.22,
        motion: 0.7,
      },
    };

    const base = presets[mode];
    const precipitationBoost = clamp((metrics.precipitationMm || 0) / 3);
    const humidityBoost = clamp(((metrics.humidityPct || 45) - 55) / 45);
    const windBoost = clamp((metrics.windKmh || 0) / 55);

    return {
      rain: clamp(Math.max(base.rain, precipitationBoost)),
      wetness: clamp(
        Math.max(base.wetness, precipitationBoost * 0.9 + humidityBoost * 0.24),
      ),
      condensation: clamp(
        Math.max(base.condensation, humidityBoost * 0.92),
      ),
      mist: clamp(Math.max(base.mist, humidityBoost * 0.5)),
      glint: clamp(base.glint, 0.2, 1.25),
      motion: clamp(Math.max(base.motion, windBoost * 1.12), 0.35, 1.25),
    };
  }

  private emptyMetrics(): AtmosphereMetrics {
    return {
      temperatureC: null,
      humidityPct: null,
      precipitationMm: null,
      windKmh: null,
      cloudPct: null,
      symbolCode: null,
    };
  }
}
