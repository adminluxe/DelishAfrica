#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
const app = args[0];
const checkOnly = args.length === 2 && args[1] === '--check';
if (!['client', 'merchant', 'courier'].includes(app) || (args.length > 1 && !checkOnly)) {
  throw new Error('Usage: node qa/ataraxie/build-android-closed.mjs <client|merchant|courier> [--check]');
}
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cwd = path.join(repo, 'apps', app);
const env = { ...process.env, EAS_BUILD_PLATFORM: 'android', DA_ATARAXIE_ANDROID_BUILD: '1' };
const run = (command, options = {}) => spawnSync('eas', command, {
  cwd, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options,
});
const resolved = run(['config', '--platform', 'android', '--profile', 'ataraxie-closed', '--json', '--non-interactive'], { timeout: 120000 });
if (resolved.status !== 0) {
  process.stderr.write('Android closed-test configuration could not be resolved. No build requested.\n');
  process.exit(resolved.status || 1);
}
const { appConfig, buildProfile } = JSON.parse(resolved.stdout);
const expectedApi = 'https://ataraxie-api.delishafrica.me/api/v1';
const checks = {
  version: appConfig.version === '3.0.4',
  package: appConfig.android?.package === 'com.delishafrica.' + app,
  channel: buildProfile.channel === 'ataraxie-closed',
  storeBundle: buildProfile.distribution === 'store' && (buildProfile.android?.buildType || buildProfile.buildType) === 'app-bundle',
  qaApi: appConfig.extra?.EXPO_PUBLIC_API_BASE_URL === expectedApi && appConfig.extra?.EXPO_PUBLIC_API_URL === expectedApi,
  runtime: appConfig.runtimeVersion?.policy === 'appVersion',
};
if (app !== 'merchant') checks.androidMapsKeyPresent = !!appConfig.android?.config?.googleMaps?.apiKey?.trim();
console.log(JSON.stringify({ app, platform: 'android', version: appConfig.version, profile: 'ataraxie-closed', checks }, null, 2));
if (!Object.values(checks).every(Boolean)) {
  throw new Error('Closed-test preflight failed. No build requested.');
}
if (!checkOnly) {
  // Queue only. Uploading or publishing to a Play track is a separate operation.
  const queued = run(['build', '--platform', 'android', '--profile', 'ataraxie-closed', '--non-interactive', '--no-wait', '--json'], { timeout: 180000 });
  process.stdout.write(queued.stdout || '');
  process.stderr.write(queued.stderr || '');
  process.exit(queued.status || (queued.error ? 1 : 0));
}
