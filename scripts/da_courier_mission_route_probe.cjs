'use strict';

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

  process.env.GOOGLE_ROUTES_API_KEY = 'probe-key';
  const originalFetch = global.fetch;
  let providerCalls = 0;
  global.fetch = async (_url, options = {}) => {
    providerCalls += 1;
    const headers = options.headers || {};
    const requestBody = JSON.parse(String(options.body || '{}'));
    assert(headers['X-Goog-Api-Key'] === 'probe-key', 'server key must be sent only from backend');
    assert(requestBody.travelMode === 'DRIVE', 'courier baseline must request DRIVE');
    assert(
      requestBody.routingPreference === 'TRAFFIC_AWARE',
      'courier DRIVE baseline must request TRAFFIC_AWARE',
    );
    assert(
      String(headers['X-Goog-FieldMask'] || '').includes('routes.polyline.encodedPolyline'),
      'route field mask must request polyline',
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
            },
          ],
        };
      },
    };
  };

  const liveService = new RoutesPreviewService();
  const live = await liveService.preview(input);
  global.fetch = originalFetch;

  assert(providerCalls === 1, 'traffic-aware preview should make one provider call');
  assert(live.provider === 'google_routes', 'provider route must be identified');
  assert(live.fallback === false, 'provider route must not be marked fallback');
  assert(live.meta.trafficAware === true, 'provider route must declare traffic awareness');
  assert(live.distanceMeters === 2040, 'distance must be preserved');
  assert(live.etaMinutes === 7, '420s must normalize to 7 min');
  assert(Boolean(live.polyline), 'provider polyline must be preserved');

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
