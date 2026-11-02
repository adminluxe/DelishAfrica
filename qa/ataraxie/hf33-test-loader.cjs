const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),ts=require('typescript'),babel=require('@babel/core');
const plugin=require('babel-preset-expo/build/inline-env-vars').expoInlineEnvVars;
const QA='https://ataraxie-api.delishafrica.me/api/v1';
function loader(options={}){
 const calls=[],cache=new Map();
 const config=options.config||{EXPO_PUBLIC_API_BASE_URL:QA,EXPO_PUBLIC_API_URL:QA,EXPO_PUBLIC_RELEASE_RING:'ataraxie-ios-qa'};
 const native=options.native||{expoConfig:{extra:{...config}}};
 const mocks={'expo-constants':{__esModule:true,default:native},...(options.mocks||{})};
 const fetch=options.fetch||(async(url,init)=>{calls.push({url:String(url),init});return {ok:true,status:200,json:async()=>({ok:true}),text:async()=>JSON.stringify({ok:true})}});
 function load(relative){
  const filename=path.resolve(root,relative);if(cache.has(filename))return cache.get(filename).exports;
  const source=process.env.DA_HF33_BASELINE==='1' ? require('node:child_process').execFileSync('git',['show','528360b722f2a9f238ec7132b319d3631f13e707:'+path.relative(root,filename)],{cwd:root,encoding:'utf8'}) : fs.readFileSync(filename,'utf8');
  let js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,jsx:ts.JsxEmit.React}}).outputText;
  const previous={};for(const key of ['EXPO_PUBLIC_API_BASE_URL','EXPO_PUBLIC_API_URL','EXPO_PUBLIC_RELEASE_RING']){previous[key]=process.env[key];if(config[key]===undefined)delete process.env[key];else process.env[key]=config[key];}
  try{js=babel.transformSync(js,{filename,configFile:false,babelrc:false,plugins:[plugin],caller:{name:'metro',isDev:false,platform:'ios',isServer:false}}).code;}
  finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
  const module={exports:{}};cache.set(filename,module);
  const requireHere=name=>{
   if(name in mocks)return mocks[name];
   if(name.startsWith('.')){let p=path.resolve(path.dirname(filename),name);if(!path.extname(p))p+='.ts';return load(p);}
   if(name==='expo-secure-store')return {getItemAsync:async()=>null,deleteItemAsync:async()=>{},setItemAsync:async()=>{},isAvailableAsync:async()=>true};
   return require(name);
  };
  vm.runInNewContext(js,{module,exports:module.exports,require:requireHere,fetch,console,Date,Set,Map,URL,Headers,AbortController,Promise,setTimeout,clearTimeout,process:{env:{NODE_ENV:'production'}},__DEV__:false},{filename});
  return module.exports;
 }
 return {load,calls};
}
module.exports={loader,QA};
