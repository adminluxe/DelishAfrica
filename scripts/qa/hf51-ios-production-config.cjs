"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),cp=require("node:child_process"),path=require("node:path");
const ids={client:"b9aebdae-10b4-4638-a576-a5f61352ea97",merchant:"394e7d6f-559b-4536-81a9-fbc0cdb0c68f",courier:"5d1b6b85-9e64-4cc2-9cbe-7d698feccc84"};
const asc={client:"6807363823",merchant:"6807369989",courier:"6807372575"};
for(const app of Object.keys(ids)){
 const dir=path.resolve("apps",app),eas=JSON.parse(fs.readFileSync(path.join(dir,"eas.json"),"utf8"));
 const profile=eas.build.production;assert.equal(profile.channel,"production");assert.equal(profile.environment,"production");assert.equal(profile.ios.resourceClass,"medium");assert.equal(eas.submit.production.ios.ascAppId,asc[app]);
 const env={...process.env,...profile.env,APP_VARIANT:"production"};delete env.DA_ATARAXIE_IOS_BUILD;delete env.DA_ATARAXIE_ANDROID_BUILD;
 const run=cp.spawnSync("pnpm",["exec","expo","config","--json"],{cwd:dir,env,encoding:"utf8",timeout:60000,maxBuffer:4194304});
 if(run.error)throw run.error;assert.equal(run.status,0,"Expo config failed for "+app);
 const c=JSON.parse(run.stdout),x=c.extra||{};assert.equal(c.version,"3.0.4");assert.equal(c.ios.bundleIdentifier,"com.delishafrica."+app);assert.equal(x.eas.projectId,ids[app]);
 assert.equal(x.EXPO_PUBLIC_API_BASE_URL,"https://api.delishafrica.me/api/v1");assert.equal(x.EXPO_PUBLIC_API_URL,"https://api.delishafrica.me/api/v1");assert.equal(x.EXPO_PUBLIC_RELEASE_RING,"production");
 assert.ok(!x.daEnrollment,"QA enrollment must not enter production manifest");
 console.log(JSON.stringify({app,version:c.version,bundle:c.ios.bundleIdentifier,channel:profile.channel,environment:profile.environment,worker:profile.ios.resourceClass,result:"PASS_SOURCE_CONFIG_ONLY"}));
}
