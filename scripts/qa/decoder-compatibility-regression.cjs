// Test the actual patched dependency through both legacy and current consumers.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{pathToFileURL}=require('node:url');
const decode=require('decode-uri-component');
assert.equal(typeof decode,'function');
if(process.argv.includes('--stress')){
 let payload='';for(let i=0;i<32000;i++)payload+='%'+Math.floor(i/256).toString(16).padStart(2,'0')+'%'+(i%256).toString(16).padStart(2,'0')+'x';payload+='%zz';
 const start=performance.now();const result=decode(payload);assert(result.endsWith('%zz'));console.log(JSON.stringify({bytes:payload.length,milliseconds:performance.now()-start}));process.exit(0);
}
(async()=>{
 const pnpm=path.resolve('node_modules/.pnpm'),folders=fs.readdirSync(pnpm),find=v=>{const hit=folders.find(x=>x==='query-string@'+v||x.startsWith('query-string@'+v+'_')||x.startsWith('query-string@'+v+'('));assert(hit,'Missing query-string '+v);return path.join(pnpm,hit,'node_modules/query-string/index.js');};
 const legacy=require(find('7.1.3')),current=(await import(pathToFileURL(find('9.3.1')).href)).default;
 const inputs=[['name=Caf%C3%A9',{name:'Café'}],['a=1&a=2',{a:['1','2']}],['empty=&missing',{empty:'',missing:null}],['bad=%E0%A4%A',{bad:'%E0%A4%A'}],['x=%25%32%35',{x:'%25'}]];
 let cases=0;
 for(const query of [legacy,current])for(const [input,expected]of inputs){assert.deepEqual(JSON.parse(JSON.stringify(query.parse(input))),expected);assert.equal(typeof query.stringify(query.parse(input)),'string');cases++;}
 for(const [input,expected]of [['Caf%C3%A9','Café'],['%','%'],['%zz','%zz'],['%C2','\uFFFD'],['%FE%FF','\uFFFD\uFFFD']]){assert.equal(decode(input),expected);cases++;}
 assert.throws(()=>decode(42),TypeError);cases++;
 const stress=cp.spawnSync(process.execPath,[__filename,'--stress'],{encoding:'utf8',timeout:10000,maxBuffer:1048576});if(stress.error)throw stress.error;assert.equal(stress.status,0,stress.stderr);
 console.log(JSON.stringify({scope:'SYNTHETIC_DECODER_COMPATIBILITY',cases,stress:JSON.parse(stress.stdout)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
