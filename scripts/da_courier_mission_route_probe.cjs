'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const servicePath = path.join(
  __dirname,
  '..',
  'services',
  'api-nest',
  'dist',
  'routes-preview',
  'routes-preview.service.js',
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  delete process.env.GOOGLE_ROUTES_API_KEY_FILE;
  delete process.env.GOOGLE_ROUTES_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_API_KEY;

  delete require.cache[require.resolve(servicePath)];
  const { RoutesPreviewService } = require(servicePath);

  const input = {
    origin: { lat: 50.8466, lng: 4.3528 },
    destination: { lat: 50.8359, lng: 4.3717 },
    mode: 'DRIVE',
    orderId: 'MISSION-CURRENT-PROBE',
    source: 'courier-mission-probe',
  };

  const fallbackService = new RoutesPreviewService();
  const fallback = await fallbackService.preview(input);
  assert(fallback.ok === true, 'fallback must remain usable');
  assert(fallback.provider === 'fallback_haversine', 'missing key must use explicit haversine fallback');
  assert(fallback.fallback === true, 'fallback flag must be true');
  assert(fallback.meta.trafficAware === false, 'fallback must never claim traffic awareness');
  assert(fallback.etaMinutes > 0, 'fallback ETA must be positive');
  assert(fallbackService.providerReady() === false, 'provider must be not ready without key');

  const keyFile = path.join(os.tmpdir(), `da-routes-probe-${process.pid}.key`);
  fs.writeFileSync(keyFile, 'probe-file-key\n', { mode: 0o600 });
  process.env.GOOGLE_ROUTES_API_KEY_FILE = keyFile;
  const originalFetch = global.fetch;
  let providerCalls = 0;
  global.fetch = async (_url, options = {}) => {
    providerCalls += 1;
    const headers = options.headers || {};
    const requestBody = JSON.parse(String(options.body || '{}'));
    assert(headers['X-Goog-Api-Key'] === 'probe-file-key', 'server key must be read from backend secret file');
    assert(requestBody.travelMode === 'DRIVE', 'courier baseline must request DRIVE');
    assert(
      requestBody.routingPreference === 'TRAFFIC_AWARE',
      'courier DRIVE baseline must request TRAFFIC_AWARE',
    );
    assert(
      String(headers['X-Goog-FieldMask'] || '').includes('routes.polyline.encodedPolyline'),
      'route field mask must request polyline',
    );
    assert(
      String(headers['X-Goog-FieldMask'] || '').includes('routes.legs.steps.navigationInstruction.instructions'),
      'route field mask must request navigation instructions',
    );
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          routes: [
            {
              distanceMeters: 2040,
              duration: '420s',
              polyline: { encodedPolyline: 'route-polyline-probe' },
              legs: [
                {
                  steps: [
                    {
                      distanceMeters: 230,
                      navigationInstruction: {
                        instructions: 'Tournez à droite sur Rue du Bailli',
                        maneuver: 'TURN_RIGHT',
                      },
                    },
                    {
                      distanceMeters: 620,
                      navigationInstruction: {
                        instructions: 'Continuez tout droit',
                        maneuver: 'STRAIGHT',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        };
      },
    };
  };

  const liveService = new RoutesPreviewService();
  assert(liveService.providerReady() === true, 'provider must be ready from secret file');
  const live = await liveService.preview(input);
  global.fetch = originalFetch;
  fs.rmSync(keyFile, { force: true });
  delete process.env.GOOGLE_ROUTES_API_KEY_FILE;

  assert(providerCalls === 1, 'traffic-aware preview should make one provider call');
  assert(live.provider === 'google_routes', 'provider route must be identified');
  assert(live.fallback === false, 'provider route must not be marked fallback');
  assert(live.meta.trafficAware === true, 'provider route must declare traffic awareness');
  assert(live.distanceMeters === 2040, 'distance must be preserved');
  assert(live.etaMinutes === 7, '420s must normalize to 7 min');
  assert(Boolean(live.polyline), 'provider polyline must be preserved');
  assert(Array.isArray(live.maneuvers) && live.maneuvers.length === 2, 'provider maneuvers must be normalized');
  assert(live.maneuvers[0].maneuver === 'TURN_RIGHT', 'first maneuver type mismatch');
  assert(live.maneuvers[0].distanceMeters === 230, 'first maneuver distance mismatch');
  assert(live.maneuvers[0].instruction.includes('Rue du Bailli'), 'first maneuver instruction mismatch');
  assert(Array.isArray(fallback.maneuvers) && fallback.maneuvers.length === 0, 'fallback must not invent maneuvers');

  console.log(
    JSON.stringify(
      {
        ok: true,
        fallback: {
          provider: fallback.provider,
          etaMinutes: fallback.etaMinutes,
          trafficAware: fallback.meta.trafficAware,
        },
        provider: {
          provider: live.provider,
          etaMinutes: live.etaMinutes,
          trafficAware: live.meta.trafficAware,
          polyline: Boolean(live.polyline),
          providerCalls,
        },
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(70);
});
