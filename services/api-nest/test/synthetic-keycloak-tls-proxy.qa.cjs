'use strict';
/**
 * SINGLE-PURPOSE ephemeral HTTPS front end for fully isolated QA Keycloak.
 *
 * Not a production reverse proxy. Only allows traffic to the loopback
 * Keycloak HTTP test container within Docker's --network none namespace.
 * The ephemeral, locally generated TLS certificate must be checked through
 * NODE_EXTRA_CA_CERTS. NEVER disable TLS hostname validation.
 */
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const assert = require('node:assert/strict');

const QA_ORIGIN = 'https://127.0.0.1';
function guard() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'CI only');
  assert.equal(process.env.QA_SYNTHETIC_ONLY, 'YES', 'synthetic only');
  assert.equal(process.env.QA_HTTPS_ORIGIN, QA_ORIGIN, 'local origin only');
  assert.equal(process.env.NODE_EXTRA_CA_CERTS, '/qa-tls/qa.crt',
    'trust only the ephemeral CA from our QA fixture');
}
async function startQaHttpsProxy() {
  guard();
  const tls = https.createServer({
    key: fs.readFileSync('/qa-tls/qa.key'),
    cert: fs.readFileSync('/qa-tls/qa.crt'),
    minVersion: 'TLSv1.2',
  }, (req, res) => {
    if (!req.url || !req.url.startsWith('/') || req.url.startsWith('//') ||
        req.headers.host !== '127.0.0.1' && req.headers.host !== '127.0.0.1:443') {
      res.writeHead(400); res.end(); return;
    }
    const upstream = http.request({
      hostname: '127.0.0.1', port: 18195, protocol: 'http:',
      method: req.method, path: req.url,
      headers: {
        ...req.headers, host: '127.0.0.1:18195',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': '127.0.0.1',
        'x-forwarded-port': '443',
        'x-forwarded-for': '127.0.0.1',
      },
      timeout: 18000,
    }, response => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy(Error('local QA backend timeout')));
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  await new Promise((resolve, reject) => {
    tls.once('error', reject);
    tls.listen(443, '127.0.0.1', resolve);
  });
  return {
    origin: QA_ORIGIN,
    async close() {
      tls.closeAllConnections();
      await new Promise(resolve => tls.close(resolve));
    },
  };
}
module.exports = { QA_ORIGIN, startQaHttpsProxy };
