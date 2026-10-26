'use strict';
const assert=require('node:assert/strict');
const {trustedRequesterIdentity}=require('../dist/requester-identity/trusted-requester-identity.js');
process.env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE='NGINX_REALIP_ON_LOOPBACK_VERIFIED';
const mk=(peer,headers={})=>({socket:{remoteAddress:peer},headers});
const tests=[
 ['verified-A',mk('172.19.0.1',{'x-real-ip':'203.0.113.10'}),'203.0.113.10'],
 ['verified-B',mk('172.19.0.1',{'x-real-ip':'203.0.113.20'}),'203.0.113.20'],
 ['forged-forwarded',mk('172.19.0.22',{'x-real-ip':'203.0.113.30','x-forwarded-for':'203.0.113.100'}),'172.19.0.22'],
 ['forged-cf',mk('172.19.0.22',{'cf-connecting-ip':'203.0.113.99'}),'172.19.0.22'],
 ['comma-injection',mk('172.19.0.1',{'x-real-ip':'203.0.113.10, 203.0.113.11'}),'172.19.0.1'],
 ['newline-injection',mk('172.19.0.1',{'x-real-ip':'203.0.113.10\n'}),'172.19.0.1'],
 ['ipv6-mapped',mk('::ffff:172.19.0.1',{'x-real-ip':'2001:db8::10'}),'2001:db8::10'],
 ['no-trusted-header',mk('172.19.0.1',{'x-forwarded-for':'203.0.113.1'}),'172.19.0.1']
];
for(const [name,req,expected] of tests)assert.equal(trustedRequesterIdentity(req),expected,name);
process.env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE='UNTRUSTED';
assert.equal(trustedRequesterIdentity(mk('172.19.0.1',{'x-real-ip':'203.0.113.99'})),'172.19.0.1');
console.log('R6Q_TRUSTED_PROXY_IP_REGRESSIONS=9/9_PASS');
