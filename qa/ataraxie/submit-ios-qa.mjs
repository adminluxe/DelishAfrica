#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const app=process.argv[2];
const targets={
 client:{id:'c2291084-75a1-4cd7-85d3-8a7cba56fbc7',code:'29',asc:'6807363823',project:'b9aebdae-10b4-4638-a576-a5f61352ea97'},
 merchant:{id:'8860e30b-df77-47b3-b9c1-8b699b6b0b87',code:'22',asc:'6807369989',project:'394e7d6f-559b-4536-81a9-fbc0cdb0c68f'},
 courier:{id:'d308ab74-d1fc-4ce2-895e-8ccf47b6edc6',code:'15',asc:'6807372575',project:'5d1b6b85-9e64-4cc2-9cbe-7d698feccc84'},
};
if(!targets[app]||process.argv.length!==3)throw Error('Usage: submit-ios-qa.mjs <client|merchant|courier>');
const target=targets[app],repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),cwd=path.join(repo,'apps',app);
const root='/home/afripayadmin/DA_RUNTIME/DA_ATARAXIE_20261031/apply-ios-20261102';
const proof=JSON.parse(fs.readFileSync(root+'/'+app+'-ios-native-review.json','utf8'));
const build=JSON.parse(fs.readFileSync(root+'/'+app+'-ios-build-current-private.json','utf8'));
const eas=JSON.parse(fs.readFileSync(path.join(cwd,'eas.json'),'utf8'));
if(!proof.passed||proof.version!=='3.0.4'||proof.buildNumber!==target.code||proof.bundleIdentifier!=='com.delishafrica.'+app)throw Error('IPA proof does not match candidate');
if(build.id!==target.id||build.status!=='FINISHED'||build.platform!=='IOS'||build.project?.id!==target.project||build.appVersion!=='3.0.4'||build.appBuildVersion!==target.code)throw Error('EAS build identity mismatch');
const profile=eas.submit?.['ataraxie-ios-qa'];
if(profile?.ios?.ascAppId!==target.asc||profile.android)throw Error('Unexpected iOS submit profile');
const env={...process.env,EAS_BUILD_PLATFORM:'ios',DA_ATARAXIE_IOS_BUILD:'1'};delete env.DA_ATARAXIE_ANDROID_BUILD;
const result=spawnSync('eas',['submit','--platform','ios','--profile','ataraxie-ios-qa','--id',target.id,'--non-interactive','--wait'],{cwd,env,encoding:'utf8',maxBuffer:16*1024*1024,timeout:900000});
const output=(result.stdout||'')+'\n'+(result.stderr||'');
fs.writeFileSync(root+'/'+app+'-ios-submit.stdout',result.stdout||'',{mode:0o600});
fs.writeFileSync(root+'/'+app+'-ios-submit.stderr',result.stderr||'',{mode:0o600});
const url=output.match(/https:\/\/expo\.dev\/accounts\/[^\s/]+\/projects\/[^\s/]+\/submissions\/[0-9a-f-]+/i)?.[0]||null;
const summary={app,version:'3.0.4',buildNumber:target.code,buildId:target.id,ascAppId:target.asc,exitCode:result.status,transferSucceeded:result.status===0,submissionConsoleUrl:url,at:new Date().toISOString(),testflightAvailabilityVerified:false,appStorePublicReleaseRequested:false};
fs.writeFileSync(root+'/'+app+'-ios-submission-304.json',JSON.stringify(summary,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(summary));
if(result.status!==0)process.exit(result.status||1);
