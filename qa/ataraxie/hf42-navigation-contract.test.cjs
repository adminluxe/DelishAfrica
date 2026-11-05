const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ts = require(require.resolve('typescript', { paths: [path.join(root,'apps/courier'),root] }));
const source = fs.readFileSync(path.join(root,'packages/contracts/src/missionJourney.ts'),'utf8');
const js = ts.transpileModule(source, { compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021
}}).outputText;
const m = { exports: {} };
vm.runInNewContext(js, { module:m,exports:m.exports,require,console,Date,Math,Set }, { timeout:4000 });
const core = m.exports;
const polyline = '_p~iF~ps|U_ulLnnqC_mqNvxq' + String.fromCharCode(96) + '@';

test('HF42: verified Google polyline retains sanitized provider directions only', () => {
  const body = { ok:true,provider:'google_routes',fallback:false,
    polyline,distanceMeters:1000,durationSeconds:600,
    maneuvers:[
      {instruction:'Tournez <b>à gauche</b>',maneuver:'TURN_LEFT',distanceMeters:120},
      {instruction:'',maneuver:'STRAIGHT',distanceMeters:500},
      {instruction:'Continuez',maneuver:'STRAIGHT',distanceMeters:null},
    ],
    meta:{mode:'BICYCLE',computedAt:new Date().toISOString(),orderId:'HF42-QA-PUBLIC-MAPS'} };
  const route = core.verifiedJourneyRoute(body,'BICYCLE');
  assert.ok(route,'Verified Google response should provide an in-app route');
  assert.equal(route.maneuvers.length,1);
  assert.equal(route.maneuvers[0].instruction,'Tournez à gauche');
  assert.equal(route.maneuvers[0].distanceMeters,120);
  assert.ok(route.points.length >=2);
  assert.ok(core.journeyEta(route,route.points[0]));
});

test('HF42: no fake maneuver or ETA on fallback routes', () => {
  const data = {ok:true,provider:'fallback_haversine',fallback:true,polyline,
    maneuvers:[{instruction:'Tournez',maneuver:'TURN_LEFT',distanceMeters:100}],
    distanceMeters:1000,durationSeconds:600,meta:{mode:'BICYCLE'}};
  assert.equal(core.verifiedJourneyRoute(data,'BICYCLE'),null);
  assert.equal(core.verifiedJourneyRoute({...data,fallback:false},'BICYCLE'),null);
  assert.equal(core.verifiedJourneyRoute({...data,provider:'google_routes',fallback:false},'DRIVE'),null);
});

test('HF42: delivered order never remains an active routing mission', () => {
  const o = {publicId:'HF42-TEST',status:'delivered',assignmentProposal:{status:'accepted'}};
  assert.equal(core.isJourneyActive(o),false);
  assert.equal(core.isJourneyDelivered(o),true);
});
