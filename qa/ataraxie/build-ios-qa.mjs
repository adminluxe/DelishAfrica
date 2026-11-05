#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const args=process.argv.slice(2), app=args[0], checkOnly=args.length===2&&args[1]==='--check';
if(!['client','merchant','courier'].includes(app)||(args.length>1&&!checkOnly)) throw Error('Usage: build-ios-qa.mjs <client|merchant|courier> [--check]');
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const cwd=path.join(repo,'apps',app);
const root='/home/afripayadmin/DA_RUNTIME/DA_ATARAXIE_20261031/apply-ios-20261102';
fs.mkdirSync(root,{recursive:true,mode:0o700});
const env={...process.env,EAS_BUILD_PLATFORM:'ios',DA_ATARAXIE_IOS_BUILD:'1'};
delete env.DA_ATARAXIE_ANDROID_BUILD;
const run=(args,timeout=120000)=>spawnSync('eas',args,{cwd,env,encoding:'utf8',maxBuffer:16*1024*1024,timeout});
const save=(name,value)=>fs.writeFileSync(path.join(root,name),value,{mode:0o600});
const resolved=run(['config','--platform','ios','--profile','ataraxie-ios-qa','--json','--non-interactive']);
save(app+'-ios-config.stdout',resolved.stdout||'');save(app+'-ios-config.stderr',resolved.stderr||'');
if(resolved.status!==0)throw Error('iOS QA config resolution failed; no build requested.');
const {appConfig,buildProfile}=JSON.parse(resolved.stdout);
const projects={client:'b9aebdae-10b4-4638-a576-a5f61352ea97',merchant:'394e7d6f-559b-4536-81a9-fbc0cdb0c68f',courier:'5d1b6b85-9e64-4cc2-9cbe-7d698feccc84'};
const api='https://ataraxie-api.delishafrica.me/api/v1';
const checks={
 version:appConfig.version==='3.0.4',
 bundle:appConfig.ios?.bundleIdentifier==='com.delishafrica.'+app,
 project:appConfig.extra?.eas?.projectId===projects[app],
 channel:buildProfile.channel==='ataraxie-ios-qa',
 storeDeviceRelease:buildProfile.distribution==='store'&&(buildProfile.ios?.simulator??buildProfile.simulator)!==true&&(buildProfile.ios?.buildConfiguration||buildProfile.buildConfiguration)==='Release',
 qaApi:appConfig.extra?.EXPO_PUBLIC_API_BASE_URL===api&&appConfig.extra?.EXPO_PUBLIC_API_URL===api,
 runtime:appConfig.runtimeVersion?.policy==='appVersion',
 explicitIosOnly:buildProfile.env?.DA_ATARAXIE_IOS_BUILD==='1'&&!buildProfile.env?.DA_ATARAXIE_ANDROID_BUILD,
 releaseRing:buildProfile.env?.EXPO_PUBLIC_RELEASE_RING==='ataraxie-ios-qa',
};
const proof={app,platform:'ios',profile:'ataraxie-ios-qa',version:appConfig.version,checks};
save(app+'-ios-preflight.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
if(!Object.values(checks).every(Boolean))throw Error('iOS QA preflight failed; no build requested.');
if(!checkOnly){
 const result=run(['build','--platform','ios','--profile','ataraxie-ios-qa','--non-interactive','--freeze-credentials','--no-wait','--json'],180000);
 save(app+'-ios-queue.stdout',result.stdout||'');save(app+'-ios-queue.stderr',result.stderr||'');
 if(result.status!==0)throw Error('iOS build could not be queued; diagnostics saved privately.');
 const raw=JSON.parse(result.stdout), builds=Array.isArray(raw)?raw:[raw];
 const summary=builds.map(b=>({app,id:b.id,status:b.status,platform:b.platform,appVersion:b.appVersion,appBuildVersion:b.appBuildVersion,gitCommitHash:b.gitCommitHash,createdAt:b.createdAt}));
 save(app+'-ios-build-304.json',JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({queued:summary}));
}
