export type AtmosphereMode =
  | 'clear'
  | 'cloud'
  | 'mist'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'heat';

export type AtmosphereTuning = {
  rain: number;
  wetness: number;
  condensation: number;
  mist: number;
  glint: number;
  motion: number;
};

export type AtmosphereMetrics = {
  temperatureC: number | null;
  humidityPct: number | null;
  precipitationMm: number | null;
  windKmh: number | null;
  cloudPct: number | null;
  symbolCode: string | null;
};

export type AtmosphereCurrent = {
  ok: true;
  mode: AtmosphereMode;
  source: 'live' | 'override' | 'stale' | 'fallback';
  market: string;
  observedAt: string;
  checkedAt: string;
  metrics: AtmosphereMetrics;
  tuning: AtmosphereTuning;
  attribution: {
    label: 'MET Norway';
    license: 'CC BY 4.0';
    url: 'https://api.met.no/';
  };
};
