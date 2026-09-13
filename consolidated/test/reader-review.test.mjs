import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {JSDOM, VirtualConsole} from 'jsdom';
import {build} from 'esbuild';

// Exercise the PR3 reader through real DOM events, retaining the PR2 races.
// Only the local broker and media playback state are fixtures; the application
// and its dependencies are bundled in memory, with no private state exports.
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const bundle=await build({entryPoints:[fileURLToPath(new URL('../public/app.mjs',import.meta.url))],
  bundle:true,write:false,format:'esm',target:'es2022',external:['/vendor/*']});
const code=bundle.outputFiles[0].text;
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const asset=(id,name,kind='final')=>({id,name,kind,size:5,storage:'managed'});
const passage=item=>({source:{id:`${item.id}:text`,assetId:item.id,edition:item.id,title:item.name,
  key:'text',kind:item.kind,locator:{key:'text'}},key:'text',text:`Text belonging to ${item.name}`});

async function reader(t,assets,initial={}){
  const problems=[],requests=[],states=new Map(Object.entries(initial)),console=new VirtualConsole();
  console.on('jsdomError',error=>problems.push(error.message));
  const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});
  const {window}=dom,document=window.document;
  const r={window,document,requests,states,intercept:null,get:id=>document.getElementById(id)};
  t.after(()=>{window.close();assert.deepEqual(problems,[]);});
  window.fetch=async(input,options={})=>{
    const url=new URL(input,window.location.href),method=options.method||'GET';
    let body;try{body=typeof options.body==='string'?JSON.parse(options.body):options.body;}catch{assert.fail('Malformed UI request JSON');}
    const request={url,method,body};requests.push(request);
    const intercepted=await r.intercept?.(request);if(intercepted)return intercepted;
    const path=url.pathname;
    if(path==='/api/config')return Response.json({settings:{}});
    if(path==='/api/assets')return Response.json(assets);
    if(path==='/api/stats')return Response.json({storage:{managedBytes:0,mountedBytes:0,editions:assets.length,annotations:0},
      knowledge:{activeSources:assets.length},freeBytes:1024**3});
    if(path==='/api/annotations'||path==='/api/model-references')return Response.json([]);
    if(path==='/api/runtime')return Response.json({configured:false,status:{state:'idle'}});
    if(path.startsWith('/api/state/')){
      const id=path.slice('/api/state/'.length);
      if(method==='POST')states.set(id,{...(states.get(id)||{}),...body});
      return Response.json(states.get(id)||{});
    }
    const match=path.match(/^\/api\/assets\/([^/]+)\/read$/);
    if(match)return Response.json(passage(assets.find(item=>item.id===match[1])));
    throw Error(`Unexpected broker request: ${method} ${url}`);
  };
  r.wait=async(predicate,description='reader update')=>{
    for(let n=0;n<400;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}
    assert.fail(`Timed out waiting for ${description}: ${r.get('status').textContent}`);
  };
  r.settle=async()=>{for(let n=0;n<6;n++)await new Promise(setImmediate);};
  r.clickWork=id=>{
    const item=assets.find(value=>value.id===id);
    const card=[...document.querySelectorAll('.work-card')].find(node=>node.querySelector('h3').textContent===item.name);
    assert.ok(card);card.querySelector('button').click();
  };
  r.open=async id=>{
    r.clickWork(id);const item=assets.find(value=>value.id===id);
    await r.wait(()=>r.get('status').textContent===`Opened ${item.name}`);await r.settle();
  };
  await window.eval(`(async()=>{\n${code}\n})()`);
  assert.equal(r.get('status').classList.contains('error'),false,r.get('status').textContent);
  return r;
}

function selectUpload(r,name){
  const file=new r.window.File(['upload fixture'],name);
  Object.defineProperty(r.get('upload'),'files',{value:[file],configurable:true});
  r.get('upload').dispatchEvent(new r.window.Event('change',{bubbles:true}));
}

test('an older upload finishing last cannot take over the latest file selection',async t=>{
  const assets=[],r=await reader(t,assets),old=asset('old','Old.mp3','audio'),latest=asset('new','New.mp3','audio');
  const pending=deferred(),started=deferred();
  r.intercept=async request=>{
    if(request.url.pathname!=='/api/assets'||request.method!=='POST')return;
    const item=request.body.name===old.name?old:latest;
    if(item===old){started.resolve();await pending.promise;}
    assets.push(item);return Response.json(item);
  };
  selectUpload(r,old.name);await started.promise;selectUpload(r,latest.name);
  await r.wait(()=>r.get('status').textContent==='Import complete.');pending.resolve();await r.settle();
  assert.equal(r.get('work-title').textContent,latest.name);
  assert.equal(r.get('reading').querySelector('audio').getAttribute('src'),'/api/assets/new/bytes');
  assert.equal(r.get('status').textContent,'Import complete.');
  assert.equal(r.requests.some(request=>request.url.pathname==='/api/state/old'),false);
  assert.equal(r.document.querySelectorAll('.work-card').length,2,'Both successful imports stay in the library');
});

test('selecting another upload invalidates the first import reader while the new upload is pending',async t=>{
  const assets=[],r=await reader(t,assets),old=asset('old','Old.txt'),latest=asset('new','New.mp3','audio');
  const oldRead=deferred(),readStarted=deferred(),newUpload=deferred(),uploadStarted=deferred();
  r.intercept=async request=>{
    if(request.url.pathname==='/api/assets'&&request.method==='POST'){
      const item=request.body.name===old.name?old:latest;
      if(item===latest){uploadStarted.resolve();await newUpload.promise;}
      assets.push(item);return Response.json(item);
    }
    if(request.url.pathname==='/api/assets/old/read'){readStarted.resolve();return oldRead.promise;}
  };
  selectUpload(r,old.name);await readStarted.promise;selectUpload(r,latest.name);await uploadStarted.promise;
  oldRead.resolve(Response.json(passage(old)));await r.settle();
  assert.doesNotMatch(r.get('reading').textContent,/Text belonging to Old/);
  assert.equal(r.get('reading').querySelector('.paper'),null);
  assert.match(r.get('status').textContent,/Importing New\.mp3/);
  newUpload.resolve();await r.wait(()=>r.get('status').textContent==='Import complete.');await r.settle();
  assert.equal(r.get('work-title').textContent,latest.name);
  assert.equal(r.get('reading').querySelector('audio').getAttribute('src'),'/api/assets/new/bytes');
});

test('a save uses its initiating asset and reader snapshot despite navigation',async t=>{
  const r=await reader(t,[asset('old','Old','audio'),asset('new','New')],{old:{page:7,font:23,note:'original'}});
  await r.open('old');const media=r.get('reading').querySelector('audio');
  Object.defineProperty(media,'paused',{value:false});media.currentTime=31;r.get('reading').scrollTop=150;
  const pending=deferred(),started=deferred(),before=r.requests.length;
  r.intercept=async request=>{if(request.url.pathname==='/api/state/old'&&request.method==='POST'){
    started.resolve();await pending.promise;
  }};
  r.get('reader-bookmark').click();await started.promise;
  media.currentTime=0;r.states.set('old',{...r.states.get('old'),note:'concurrent note'});
  await r.open('new');r.get('reading').scrollTop=0;pending.resolve();await r.settle();
  const writes=r.requests.slice(before).filter(request=>request.url.pathname==='/api/state/old');
  assert.equal(writes.length,1);assert.equal(writes[0].method,'POST');
  assert.deepEqual(writes[0].body,{page:7,key:'',scroll:150,font:23,time:31});
  assert.deepEqual(r.states.get('old'),{note:'concurrent note',page:7,key:'',scroll:150,font:23,time:31});
  assert.equal(r.states.get('new').time,undefined);
});

for(const delay of ['response','body'])for(const nextKind of ['final','model']){
  test(`late text ${delay} cannot replace the reader after opening a ${nextKind} work`,async t=>{
    const old=asset('old','Old'),next=asset('new','New',nextKind),r=await reader(t,[old,next]);
    const pending=deferred(),started=deferred();
    r.intercept=request=>{
      if(request.url.pathname!=='/api/assets/old/read')return;
      if(delay==='response'){started.resolve();return pending.promise;}
      return {ok:true,json:()=>{started.resolve();return pending.promise;}};
    };
    r.clickWork('old');await started.promise;
    if(nextKind==='model'){
      r.clickWork('new');await r.wait(()=>r.get('view-settings').classList.contains('active'));await r.settle();
    }else await r.open('new');
    const title=r.get('work-title').textContent,status=r.get('status').textContent,reading=r.get('reading').textContent;
    pending.resolve(delay==='response'?Response.json(passage(old)):passage(old));await r.settle();
    assert.equal(r.get('work-title').textContent,title);assert.equal(r.get('status').textContent,status);
    assert.equal(r.get('reading').textContent,reading);assert.doesNotMatch(reading,/Text belonging to Old/);
    if(nextKind==='model'){
      assert.equal(r.get('view-settings').classList.contains('active'),true);
      assert.match(status,/Model file linked/);
    }else{
      assert.equal(title,'New');assert.match(reading,/Text belonging to New/);assert.equal(status,'Opened New');
    }
    assert.equal(r.requests.some(request=>request.url.pathname==='/api/state/old'&&request.method==='POST'),false,
      'A superseded text response must not save a reading position');
  });
}

test('pausing media sends only its snapshotted time as an atomic patch',async t=>{
  const r=await reader(t,[asset('audio','Audio','audio'),asset('new','New')],{audio:{note:'keep'}});
  await r.open('audio');const media=r.get('reading').querySelector('audio');
  const pending=deferred(),started=deferred(),before=r.requests.length;
  r.intercept=async request=>{if(request.url.pathname==='/api/state/audio'&&request.method==='POST'){
    started.resolve();await pending.promise;
  }};
  media.currentTime=42;media.dispatchEvent(new r.window.Event('pause'));await started.promise;
  media.currentTime=0;r.states.set('audio',{note:'newer note',scroll:67});await r.open('new');
  pending.resolve();await r.settle();
  const writes=r.requests.slice(before).filter(request=>request.url.pathname==='/api/state/audio');
  assert.equal(writes.length,1);assert.equal(writes[0].method,'POST');assert.deepEqual(writes[0].body,{time:42});
  assert.deepEqual(r.states.get('audio'),{note:'newer note',scroll:67,time:42});
});
