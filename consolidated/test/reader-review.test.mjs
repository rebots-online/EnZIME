import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function reader(fetcher){const elements=new Map();const element=tag=>({tag,children:[],style:{},value:'',scrollTop:0,textContent:'',replaceChildren(...c){this.children=c;},append(c){this.children.push(c);},querySelector(selector){return this.children.find(c=>selector.split(',').includes(c.tag))||null;}});const document={getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id);},createElement:element};const context=vm.createContext({document,fetch:async(url,opts)=>{if(url==='/api/config')return {ok:true,json:async()=>({checkoutReady:false})};if(url==='/api/assets')return {ok:true,json:async()=>[]};return fetcher(url,opts);}});await vm.runInContext('(async()=>{'+source+';globalThis.reader={save,openAsset,set(values){current=values.current;page=values.page??1;font=values.font??19;}};})()',context);return {api:context.reader,get:document.getElementById.bind(document),element};}
const json=value=>({ok:true,json:async()=>value});
test('a save uses its initiating asset and reader snapshot despite navigation',async()=>{const pending=deferred();const writes=[];const r=await reader(async(url,opts)=>{assert.equal(opts.method,'POST');writes.push([url,JSON.parse(opts.body)]);return pending.promise;});r.api.set({current:{id:'old'},page:7,font:23});r.get('reading').scrollTop=150;r.get('reading').append({...r.element('audio'),currentTime:31});const saving=r.api.save({note:'original'});r.api.set({current:{id:'new'},page:1,font:19});r.get('reading').scrollTop=0;pending.resolve(json({note:'original'}));await saving;assert.deepEqual(writes,[['/api/state/old',{note:'original',page:7,scroll:150,font:23,time:31}]]);});
test('late text loading cannot append the prior work into the current reader',async()=>{const pending=deferred();const r=await reader(async url=>url.endsWith('/bytes')?pending.promise:json({}));const loading=r.api.openAsset({id:'old',name:'Old',kind:'final',size:5});await new Promise(setImmediate);await r.api.openAsset({id:'new',name:'New',kind:'model',size:5});pending.resolve({ok:true,text:async()=>'old text'});await loading;assert.equal(r.get('work-title').textContent,'New');assert.equal(r.get('reading').children.length,1);assert.match(r.get('reading').children[0].textContent,/Local inference/);assert.equal(r.get('status').textContent,'Opened New');});
test('pausing media sends only its snapshotted time as an atomic patch',async()=>{const pending=deferred();const writes=[];const r=await reader(async(url,opts)=>{if(opts){writes.push(JSON.parse(opts.body));return pending.promise;}return json({note:'keep'});});await r.api.openAsset({id:'audio',name:'Audio',kind:'audio'});const media=r.get('reading').children[0];media.currentTime=42;const saving=media.onpause();media.currentTime=0;pending.resolve(json({note:'keep',time:42}));await saving;assert.deepEqual(writes,[{time:42}]);});

test('an older upload finishing last cannot take over the latest file selection',async()=>{
  const pending=deferred(),started=deferred(),requests=[];
  const old={id:'old',name:'Old.mp3',kind:'audio'},latest={id:'new',name:'New.mp3',kind:'audio'};
  const r=await reader(async(url,opts)=>{
    requests.push(url);
    if(url.startsWith('/api/assets?')){
      assert.equal(opts.method,'POST');
      if(opts.body.name===old.name){started.resolve();return pending.promise;}
      return json(latest);
    }
    return json({});
  });
  const oldImport=r.get('upload').onchange({target:{files:[{name:old.name}]}});await started.promise;
  await r.get('upload').onchange({target:{files:[{name:latest.name}]}});
  pending.resolve(json(old));await oldImport;
  assert.equal(r.get('work-title').textContent,latest.name);
  assert.equal(r.get('reading').children[0].src,'/api/assets/new/bytes');
  assert.equal(r.get('status').textContent,'Opened New.mp3');
  assert.equal(requests.includes('/api/state/old'),false,'The stale import must not start opening its reader');
});

test('selecting another upload invalidates the first import reader while the new upload is pending',async()=>{
  const oldRead=deferred(),readStarted=deferred(),newUpload=deferred(),uploadStarted=deferred();
  const old={id:'old',name:'Old.txt',kind:'final',size:5},latest={id:'new',name:'New.mp3',kind:'audio'};
  const r=await reader(async(url,opts)=>{
    if(url.startsWith('/api/assets?')){
      if(opts.body.name===old.name)return json(old);
      uploadStarted.resolve();return newUpload.promise;
    }
    if(url==='/api/assets/old/bytes'){readStarted.resolve();return oldRead.promise;}
    return json({});
  });
  const oldImport=r.get('upload').onchange({target:{files:[{name:old.name}]}});await readStarted.promise;
  const latestImport=r.get('upload').onchange({target:{files:[{name:latest.name}]}});await uploadStarted.promise;
  oldRead.resolve({ok:true,text:async()=>'Text from the old upload'});await oldImport;
  assert.equal(r.get('reading').children.length,0);
  assert.match(r.get('status').textContent,/Importing/);
  newUpload.resolve(json(latest));await latestImport;
  assert.equal(r.get('work-title').textContent,latest.name);
  assert.equal(r.get('reading').children[0].src,'/api/assets/new/bytes');
});
