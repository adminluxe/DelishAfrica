#!/usr/bin/env node
/**
 * DelishAfrica passive main-branch safety check.
 * Does not execute project code, open credentials or change any file.
 * Pair with separate GitHub Secret Scanning, CodeQL and financial CI.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const tracked=execFileSync('git',['ls-files','-z'],{
  encoding:'buffer',maxBuffer:16*1024*1024,
}).toString('utf8').split('\0').filter(Boolean);
const failures=[];
let workflows=0;
for(const path of tracked){
  const name=path.split('/').pop()||'';
  const isEnvironment=name==='.env'||name.startsWith('.env.');
  const example=['.env.example','.env.sample','.env.template'];
  if(isEnvironment&&!example.includes(name)){
    failures.push({path,reason:'environment-file-committed'});
  }
  if(['.p12','.pfx','.jks','.keystore','.mobileprovision'].some(
    suffix=>name.toLowerCase().endsWith(suffix))){
    failures.push({path,reason:'signing-artifact-committed'});
  }
  if(path.startsWith('.github/workflows/') &&
     (path.endsWith('.yml')||path.endsWith('.yaml'))){
    workflows++;
    const body=readFileSync(path,'utf8');
    if(body.includes('pull_request_target:')&&
       (body.includes('run:')||body.includes('actions/checkout'))){
      failures.push({path,reason:'privileged-pr-trigger-needs-review'});
    }
    if(body.includes('permissions: write-all')){
      failures.push({path,reason:'overprivileged-workflow'});
    }
  }
}
console.log('P0_MAIN_REPOSITORY_MANIFEST='+JSON.stringify({
  trackedFiles:tracked.length,workflows,issues:failures.slice(0,60),
}));
if(failures.length){
  console.error('P0_MAIN_SAFETY_GATE=FAIL_REVIEW_REQUIRED');
  process.exitCode=1;
}else{
  console.log('P0_MAIN_SAFETY_GATE=PASS_MANIFEST_SCOPE');
}
