"use strict";
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const ids={client:'b9aebdae-10b4-4638-a576-a5f61352ea97',merchant:'394e7d6f-559b-4536-81a9-fbc0cdb0c68f',courier:'5d1b6b85-9e64-4cc2-9cbe-7d698feccc84'};
const assert=(b,m)=>{if(!b)throw Error(m)};
const expectedLock='84df04082ec517db345d78a1a52296d060c45d91b843fa911f8ff9357ea3863b';
assert(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'pnpm-lock.yaml'))).digest('hex')===expectedLock,'BASELINE_LOCK_CHANGED');
for(const app of Object.keys(ids)){
 const cwd=path.join(root,'apps',app),eas=JSON.parse(fs.readFileSync(path.join(cwd,'eas.json'),'utf8'));
 const build=eas.build['android-partner-closed'],submit=eas.submit['android-partner-closed'].android;
 assert(build.extends==='production'&&build.channel==='production'&&build.android.resourceClass==='medium'&&build.android.buildType==='app-bundle','BUILD_PROFILE_'+app);
 assert(submit.track==='alpha'&&submit.releaseStatus==='draft'&&submit.changesNotSentForReview===true,'NO_PUBLIC_ROLLOUT_'+app);
 assert(submit.applicationId==='com.delishafrica.'+app,'SUBMIT_PACKAGE_'+app);
 const env={...process.env,...eas.build.production.env,CI:'1',EXPO_NO_TELEMETRY:'1',EAS_BUILD_PLATFORM:'android',APP_VARIANT:'production'};
 delete env.DA_ATARAXIE_ANDROID_BUILD;delete env.DA_ATARAXIE_IOS_BUILD;
 const r=cp.spawnSync('pnpm',['exec','expo','config','--type','public','--json'],{cwd,env,encoding:'utf8',timeout:90000,maxBuffer:10000000});
 assert(r.status===0,'EXPO_CONFIG_FAILED_'+app);
 const c=JSON.parse(r.stdout),x=c.extra||{};
 assert(c.version==='3.0.4','VERSION_'+app);
 assert(c.android.package==='com.delishafrica.'+app,'PACKAGE_'+app);
 assert(x.eas.projectId===ids[app],'PROJECT_'+app);
 assert(x.EXPO_PUBLIC_API_BASE_URL==='https://api.delishafrica.me/api/v1'&&x.EXPO_PUBLIC_API_URL===x.EXPO_PUBLIC_API_BASE_URL,'API_'+app);
 assert(x.EXPO_PUBLIC_RELEASE_RING==='production','RING_'+app);
 assert(!(c.android.permissions||[]).some(x=>x.includes('ACCESS_BACKGROUND_LOCATION')),'UNEXPECTED_BACKGROUND_LOCATION_'+app);
 console.log(JSON.stringify({app,version:c.version,package:c.android.package,api:x.EXPO_PUBLIC_API_URL,channel:build.channel,playTrack:submit.track,submitStatus:submit.releaseStatus,result:'PASS_ANDROID_CLOSED_CONFIG'}));
}
