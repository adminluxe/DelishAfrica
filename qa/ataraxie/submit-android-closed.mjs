#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const releases = {
  client: { id: '7296cb3f-5221-49a6-b683-12984b4ad9d2', code: '14' },
  merchant: { id: '61ad22b0-e0ae-4ede-a8c6-dca37459ec97', code: '15' },
  courier: { id: 'dbe33aae-d880-4dea-8d21-53adfb9e4a92', code: '13' },
};
const [app, evidenceDir, option] = process.argv.slice(2);
if (!releases[app] || !evidenceDir || (option && option !== '--check')) {
  throw new Error('Usage: submit-android-closed.mjs <client|merchant|courier> <evidence-dir> [--check]');
}
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cwd = path.join(repo, 'apps', app);
const env = { ...process.env, EAS_BUILD_PLATFORM: 'android', DA_ATARAXIE_ANDROID_BUILD: '1' };
const run = (args, timeout = 120000) => spawnSync('eas', args, {
  cwd, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout,
});
const easJson = JSON.parse(fs.readFileSync(path.join(cwd, 'eas.json'), 'utf8'));
const target = easJson.submit?.['ataraxie-closed']?.android;
if (target?.track !== 'alpha' || target?.releaseStatus !== 'completed'
    || target?.changesNotSentForReview !== false
    || target?.applicationId !== 'com.delishafrica.' + app) {
  throw new Error('Only the explicit Android alpha submission profile is allowed.');
}
const view = run(['build:view', releases[app].id, '--json']);
if (view.status !== 0) throw new Error('Could not verify the selected build.');
const build = JSON.parse(view.stdout);
const resolved = run(['config', '--platform', 'android', '--profile', 'ataraxie-closed', '--json', '--non-interactive']);
if (resolved.status !== 0) throw new Error('Could not resolve the app identity.');
const { appConfig } = JSON.parse(resolved.stdout);
const native = JSON.parse(fs.readFileSync(path.join(evidenceDir, app + '-native-aab-review.json'), 'utf8'));
const checks = {
  completed: build.status === 'FINISHED',
  android: build.platform === 'ANDROID',
  exactBuild: build.id === releases[app].id && build.appBuildVersion === releases[app].code,
  appVersion: build.appVersion === '3.0.4' && native.version === '3.0.4',
  project: build.project?.id === appConfig.extra?.eas?.projectId,
  package: native.package === 'com.delishafrica.' + app,
  nativeVersionCode: native.versionCode === releases[app].code,
  nativeQaApi: native.qaApiEmbedded === true,
  nativeReviewPassed: native.passed === true,
  nativeMaps: app === 'merchant' || native.nativeMapsValueConfigured === true,
  closedTrack: target.track === 'alpha',
};
console.log(JSON.stringify({ app, buildId: build.id, version: build.appVersion, code: build.appBuildVersion, track: 'alpha', checks }, null, 2));
if (!Object.values(checks).every(Boolean)) throw new Error('Submission preflight failed. Nothing submitted.');
if (option !== '--check') {
  const submitted = run(['submit', '--platform', 'android', '--profile', 'ataraxie-closed', '--id', build.id, '--non-interactive', '--wait'], 900000);
  process.stdout.write(submitted.stdout || '');
  process.stderr.write(submitted.stderr || '');
  process.exit(submitted.status || (submitted.error ? 1 : 0));
}
