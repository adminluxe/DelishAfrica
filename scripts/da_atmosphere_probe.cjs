'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const runtime = path.join(os.tmpdir(), 'da_atmosphere_probe_runtime');
fs.rmSync(runtime, { recursive: true, force: true });
fs.mkdirSync(runtime, { recursive: true });

process.env.DA_ATMOSPHERE_RUNTIME_DIR = runtime;
process.env.DA_ATMOSPHERE_MARKET_LABEL = 'Probe Market';
process.env.DA_ATMOSPHERE_MARKET_LAT = '50.8356';
process.env.DA_ATMOSPHERE_MARKET_LON = '4.3676';

let fetchCalls = 0;
let lastHeaders = null;

global.fetch = async (_url, options = {}) => {
  fetchCalls += 1;
  lastHeaders = options.headers || {};
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return String(name).toLowerCase() === 'last-modified'
          ? 'Thu, 01 Oct 2026 22:00:00 GMT'
          : null;
      },
    },
    async json() {
      return {
        properties: {
          timeseries: [
            {
              time: '2026-10-01T22:00:00Z',
              data: {
                instant: {
                  details: {
                    air_temperature: 14,
                    relative_humidity: 94,
                    wind_speed: 6,
                    cloud_area_fraction: 90,
                  },
                },
                next_1_hours: {
                  summary: { symbol_code: 'heavyrainandthunder' },
                  details: { precipitation_amount: 3.2 },
                },
              },
            },
          ],
        },
      };
    },
  };
};

const { AtmosphereService } = require(
  path.join(
    __dirname,
    '..',
    'services',
    'api-nest',
    'dist',
    'atmosphere',
    'atmosphere.service.js',
  ),
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const service = new AtmosphereService();

  const first = await service.current();
  assert(first.source === 'live', 'first response must be live');
  assert(first.mode === 'storm', 'thunder payload must classify as storm');
  assert(fetchCalls === 1, 'first response should call MET once');
  assert(
    String(lastHeaders['user-agent'] || '').includes('DelishAfrica'),
    'MET request must identify DelishAfrica',
  );
  assert(first.tuning.rain === 1, 'storm rain tuning must saturate');
  assert(first.attribution.label === 'MET Norway', 'attribution missing');

  const second = await service.current();
  assert(second.source === 'live', 'cached response remains live truth');
  assert(fetchCalls === 1, 'cache must prevent duplicate upstream weather call');

  const overridePath = path.join(runtime, 'override.json');
  fs.writeFileSync(
    overridePath,
    JSON.stringify({
      mode: 'mist',
      updatedAt: '2026-10-01T22:01:00Z',
      expiresAt: '2099-01-01T00:00:00Z',
    }),
  );
  const forced = await service.current();
  assert(forced.source === 'override', 'override source mismatch');
  assert(forced.mode === 'mist', 'override mode mismatch');
  assert(fetchCalls === 1, 'override must not call upstream provider');

  fs.rmSync(overridePath, { force: true });
  service.cache.fetchedAt = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('probe_provider_down');
  };
  const stale = await service.current();
  assert(stale.source === 'stale', 'provider failure must preserve stale weather');
  assert(stale.mode === 'storm', 'stale weather must preserve last real mode');

  const health = service.health();
  assert(
    health.privacy.userGpsRequested === false,
    'global atmosphere must not request user GPS',
  );
  assert(
    health.privacy.providerReceivesMarketAnchorOnly === true,
    'provider must receive market anchor only',
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        fetchCalls,
        liveMode: first.mode,
        forcedMode: forced.mode,
        staleMode: stale.mode,
        cachePreventedSecondFetch: true,
        marketGpsRequested: health.privacy.userGpsRequested,
        attribution: first.attribution,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(70);
});
