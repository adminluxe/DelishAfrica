'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const crypto = require('node:crypto');
const { NativeClientTrustedJwksResolver } =
  require('../src/auth/native-client-trusted-jwks.resolver');

const issuer = 'https://auth.qa.example.invalid/realms/da-client';
const uri = issuer + '/protocol/openid-connect/certs';
const discoveryUrl = issuer + '/.well-known/openid-configuration';
const { publicKey } = crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const key = { ...publicKey.export({format:'jwk'}),kid:'qa-kid-1',
  kty:'RSA',use:'sig',alg:'RS256' };
const discovery = {issuer,jwks_uri:uri};
const originalFetch = global.fetch;
function mocked(handler){
  let count=0;
  global.fetch=async (input,init)=>{
    count++;
    assert.equal(init.redirect,'manual','redirects must never be followed');
    assert.equal(init.cache,'no-store','discovery and JWKS cannot use shared HTTP caches');
    const url=String(input);
    assert(url===discoveryUrl||url===uri,'static trusted issuer only');
    return handler(url,count);
  };
  return ()=>count;
}
const json=(data)=>Response.json(data);

test('candidate resolver pins issuer, caches one strict HTTPS discovery and RSA keys',async()=>{
  const calls=mocked(url=>json(url===discoveryUrl?discovery:{keys:[key]}));
  try{
    const resolver=new NativeClientTrustedJwksResolver(issuer);
    const snaps=await Promise.all(Array.from({length:5},()=>resolver.loadTrustedJwks()));
    assert(snaps.every(x=>x.provenanceVerified===true&&x.issuer===issuer));
    assert(snaps.every(x=>x.keys.length===1&&x.keys[0].kid==='qa-kid-1'));
    assert.equal(calls(),2,'concurrent lookups must be single-flight');
    const cached=await resolver.loadTrustedJwks();
    assert.equal(cached, snaps[0]);
    assert.equal(calls(),2,'no redundant network call within TTL');
    assert(Object.isFrozen(cached.keys) && Object.isFrozen(cached.keys[0]));
    console.log('QA_JWKS_RESOLVER_CACHED_HTTPS=PASS');
  }finally{global.fetch=originalFetch;}
});

test('malformed issuer, URL credentials, port, fragments and non-HTTPS rejected',()=>{
  for(const value of [
    'http://auth.qa.example.invalid/realms/da-client',
    'https://user:pass@auth.qa.example.invalid/realms/da-client',
    'https://auth.qa.example.invalid:8443/realms/da-client',
    'https://auth.qa.example.invalid/realms/da-client?x=1',
    'https://auth.qa.example.invalid/realms/da-client#x',
    'https://auth.qa.example.invalid/realms/da-client/',
    'https://localhost/realms/da-client',
    'https://127.0.0.1/realms/da-client',
  ])assert.throws(()=>new NativeClientTrustedJwksResolver(value),/native_client_/);
});

test('OIDC discovery cannot choose a different issuer or JWK URI',async()=>{
  for(const bad of [
    {...discovery,issuer:'https://evil.qa.example.invalid/realms/da-client'},
    {...discovery,jwks_uri:'https://evil.qa.example.invalid/certs'},
    {...discovery,jwks_uri:uri+'?extra=1'},
  ]){
    mocked(url=>json(url===discoveryUrl?bad:{keys:[key]}));
    try{
      await assert.rejects(new NativeClientTrustedJwksResolver(issuer).loadTrustedJwks(),
        /native_client_oidc_issuer_or_jwks_mismatch/);
    }finally{global.fetch=originalFetch;}
  }
});

test('HTTP redirect or HTML response fails closed, never follows remote locations',async()=>{
  for(const handler of [
    ()=>new Response('',{status:302,headers:{location:'https://evil.example.invalid/'}}),
    ()=>new Response('<html>forged</html>',{status:200,
      headers:{'content-type':'text/html'}}),
    ()=>new Response('{}',{status:200,headers:{
      'content-type':'application/json','content-length':'99999999'}}),
  ]){
    mocked(handler);
    try{
      await assert.rejects(new NativeClientTrustedJwksResolver(issuer).loadTrustedJwks(),
        /native_client_discovery_/);
    }finally{global.fetch=originalFetch;}
  }
});

test('duplicate kid, injected key URL, private JWK material and foreign algorithms forbidden',async()=>{
  for(const keys of [
    [key,key],
    [{...key,x5u:'https://evil.example.invalid/jwk'}],
    [{...key,d:'private-key-material'}],
    [{...key,alg:'HS256'}],
    [{...key,kid:''}],
    Array(17).fill(key),
    [],
  ]){
    mocked(url=>json(url===discoveryUrl?discovery:{keys}));
    try{
      await assert.rejects(new NativeClientTrustedJwksResolver(issuer).loadTrustedJwks(),
        /native_client_jwks_/);
    }finally{global.fetch=originalFetch;}
  }
});

test('an expired cache never degrades to stale keys on HTTPS/JWKS outage',async()=>{
  const origNow=Date.now;
  let time=origNow();
  let offline=false;
  mocked(url=>{
    if(offline)throw Error('qa-network-disconnected');
    return json(url===discoveryUrl?discovery:{keys:[key]});
  });
  Date.now=()=>time;
  try{
    const resolver=new NativeClientTrustedJwksResolver(issuer);
    const first=await resolver.loadTrustedJwks();
    assert(first.provenanceVerified);
    time+=121000;
    offline=true;
    await assert.rejects(resolver.loadTrustedJwks(),/qa-network-disconnected/);
    await assert.rejects(resolver.loadTrustedJwks(),/qa-network-disconnected/);
    console.log('QA_JWKS_EXPIRED_AND_OFFLINE=FAIL_CLOSED');
  }finally{Date.now=origNow;global.fetch=originalFetch;}
});

test('ephemeral loopback issuer is allowed only with explicit disconnected CI flags',()=>{
  const old=[process.env.GITHUB_ACTIONS,process.env.QA_SYNTHETIC_ONLY,
    process.env.QA_HTTPS_ORIGIN];
  try{
    delete process.env.GITHUB_ACTIONS;
    delete process.env.QA_SYNTHETIC_ONLY;
    delete process.env.QA_HTTPS_ORIGIN;
    assert.throws(()=>new NativeClientTrustedJwksResolver(
      'https://127.0.0.1/realms/da-native-client-qa'),/loopback_forbidden/);
    process.env.GITHUB_ACTIONS='true';
    process.env.QA_SYNTHETIC_ONLY='YES';
    process.env.QA_HTTPS_ORIGIN='https://127.0.0.1';
    assert.equal(new NativeClientTrustedJwksResolver(
      'https://127.0.0.1/realms/da-native-client-qa').issuer,
    'https://127.0.0.1/realms/da-native-client-qa');
  }finally{
    for(let n=0;n<old.length;n++){
      const name=['GITHUB_ACTIONS','QA_SYNTHETIC_ONLY','QA_HTTPS_ORIGIN'][n];
      if(old[n]===undefined)delete process.env[name];
      else process.env[name]=old[n];
    }
  }
});
