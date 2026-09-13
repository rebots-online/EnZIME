import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {JSDOM, VirtualConsole} from 'jsdom';
import {build} from 'esbuild';

// Run the real bundled UI in a fresh DOM. Broker fixtures deliberately delay
// individual responses so source/editor changes can race in-flight requests.
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const bundle = await build({entryPoints:[fileURLToPath(new URL('../public/app.mjs', import.meta.url))],
  bundle:true, write:false, format:'esm', target:'es2022', external:['/vendor/*']});
const code = bundle.outputFiles[0].text;
const idle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
const source = (assetId, key, kind='zim') => ({id:`${assetId}:${key}`, assetId, key, kind,
  edition:assetId, title:key, locator:{key}});
const asset = (id, kind='zim') => ({id, name:id, kind, size:128, storage:'managed'});
const draft = (id, sourceRefs=[]) => ({id, title:id, body:`Body of ${id}`, format:'markdown', sourceRefs});

async function boot(t, {assets=[], drafts=[], chats=[], jobs=[]}={}) {
  const problems=[], calls=[], opened=[], revisions=[], annotations=[], places=new Map();
  const draftStore=new Map(drafts.map(value => [value.id, structuredClone(value)]));
  const chatStore=new Map(chats.map(value => [value.id, structuredClone(value)]));
  const jobStore=new Map(jobs.map(value => [value.id, structuredClone(value)]));
  const virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError', error => problems.push(error.message));
  const dom=new JSDOM(html, {url:'http://localhost/', runScripts:'outside-only', pretendToBeVisual:true, virtualConsole});
  const {window}=dom, document=window.document;
  window.TextDecoder=TextDecoder;
  window.open=(...args) => {opened.push(args); return null;};
  const ctx={window, document, calls, opened, revisions, annotations, places, draftStore, chatStore, jobStore,
    intercept:null, id:id => document.getElementById(id)};
  t.after(() => {window.close(); assert.deepEqual(problems, []);});
  window.fetch=async (input, options={}) => {
    const url=new URL(input, window.location.href), method=options.method||'GET';
    let body;
    try {body=options.body ? JSON.parse(options.body) : undefined;} catch {assert.fail('UI sent malformed JSON');}
    const call={url, method, body, signal:options.signal}; calls.push(call);
    const overridden=await ctx.intercept?.(call);
    if(overridden) return overridden;
    const pathname=url.pathname;
    if(pathname==='/api/config') return Response.json({settings:{}});
    if(pathname==='/api/assets') return Response.json(assets);
    if(pathname==='/api/stats') return Response.json({storage:{managedBytes:0,mountedBytes:0,annotations:annotations.length,editions:assets.length},knowledge:{activeSources:assets.length},freeBytes:1024**3});
    if(pathname==='/api/annotations') {
      if(method==='POST') {annotations.push(body); return Response.json(body);}
      return Response.json(annotations);
    }
    if(pathname.startsWith('/api/state/')) {
      const id=pathname.slice('/api/state/'.length);
      if(method==='POST') places.set(id, {...(places.get(id)||{}),...body});
      return Response.json(places.get(id)||{});
    }
    const read=pathname.match(/^\/api\/assets\/([^/]+)\/read$/);
    if(read) {
      const item=assets.find(value => value.id===read[1]), key=url.searchParams.get('key')||'C/first';
      return Response.json({source:source(item.id,key,item.kind),key,text:`Text of ${key}`,
        chapters:[{key:'C/first',title:'First chapter'},{key:'C/second',title:'Second chapter'}]});
    }
    if(pathname.endsWith('/entries')) return Response.json({entries:[{key:'C/first',title:'First article'},
      {key:'C/second',title:'Second article'}],complete:true});
    if(pathname==='/api/drafts') {
      if(method==='POST') {assert.ok(body.id); draftStore.set(body.id,body); return Response.json(body);}
      return Response.json([...draftStore.values()]);
    }
    if(pathname==='/api/finalize') {revisions.push(structuredClone(draftStore.get(body.id))); return Response.json({id:body.id});}
    if(pathname==='/api/overlay') return Response.json(body);
    if(pathname==='/api/chats') return Response.json([...chatStore.values()]);
    if(pathname==='/api/downloads') return Response.json([...jobStore.values()]);
    const release=pathname.match(/^\/api\/dyndon\/jobs\/([^/]+)\/release$/);
    if(release&&method==='POST') {
      const job=jobStore.get(decodeURIComponent(release[1]));assert.ok(job);
      job.status='released';job.active=false;job.reservationBytes=0;
      return Response.json(job);
    }
    if(pathname==='/api/chat') {
      const messages=[...body.messages,{role:'user',content:body.message},{role:'assistant',content:'Answer'}];
      chatStore.set(body.chatId,{id:body.chatId,title:messages[0].content,messages});
      return new Response('{"type":"delta","text":"Answer"}\n{"type":"done"}\n');
    }
    throw Error(`Unexpected UI request: ${method} ${url}`);
  };
  ctx.wait=async (predicate, description='UI update') => {
    for(let i=0;i<400;i++) {if(predicate()) return; await new Promise(resolve => setTimeout(resolve,5));}
    assert.fail(`Timed out: ${description}; status=${ctx.id('status').textContent}`);
  };
  ctx.settle=async () => {for(let i=0;i<6;i++) await idle();};
  ctx.submit=id => assert.equal(ctx.id(id).dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})),false);
  ctx.open=async name => {
    const card=[...document.querySelectorAll('.work-card')].find(node => node.querySelector('h3').textContent===name);
    assert.ok(card,`Library card ${name}`); card.querySelector('button').click();
    await ctx.wait(() => ctx.id('status').textContent===`Opened ${name}`); await ctx.settle();
  };
  ctx.create=async () => {document.querySelector('[data-view="create"]').click(); await ctx.settle();};
  ctx.chooseDraft=title => {
    const button=[...ctx.id('draft-list').querySelectorAll('button')].find(node => node.textContent===title);
    assert.ok(button,`Saved draft ${title}`); button.click();
  };
  ctx.chat=async message => {
    ctx.id('chat-input').value=message;ctx.submit('chat-form');
    await ctx.wait(() => !ctx.id('send-chat').disabled);await ctx.settle();
  };
  ctx.select=text => {
    const paper=ctx.id('reading').querySelector('.paper'), range=document.createRange();
    paper.append(document.createTextNode(text));range.selectNodeContents(paper.lastChild);
    window.getSelection().removeAllRanges();window.getSelection().addRange(range);
    ctx.id('reading').dispatchEvent(new window.MouseEvent('mouseup',{bubbles:true}));
    assert.match(ctx.id('note-anchor').textContent,/Quote:/);
  };
  await window.eval(`(async () => {\n${code}\n})()`);
  assert.equal(ctx.id('status').classList.contains('error'),false,ctx.id('status').textContent);
  return ctx;
}

test('chat uses one client UUID through successful turns, errors, cancellation and history continuation', async t => {
  const c=await boot(t);
  await c.chat('First turn'); await c.chat('Second turn');
  const sent=() => c.calls.filter(call => call.url.pathname==='/api/chat');
  const id=sent()[0].body.chatId;
  assert.match(id,/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i);
  assert.deepEqual(sent().map(call => call.body.chatId),[id,id]);
  assert.equal(c.chatStore.size,1);
  c.intercept=call => call.url.pathname==='/api/chat' ? Response.json({error:'Engine unavailable'},{status:503}) : null;
  await c.chat('Failed turn');assert.match(c.id('status').textContent,/Engine unavailable/);
  const started=deferred();
  c.intercept=call => {
    if(call.url.pathname!=='/api/chat') return;
    return new Response(new ReadableStream({start(controller) {
      controller.enqueue(new TextEncoder().encode('{"type":"delta","text":"Partial"}\n'));
      call.signal.addEventListener('abort',()=>controller.error(new DOMException('Stopped','AbortError')),{once:true});
      started.resolve();
    }}));
  };
  c.id('chat-input').value='Cancelled turn';c.submit('chat-form');await started.promise;
  await c.wait(() => c.id('chat-messages').textContent.includes('Partial'));
  c.id('stop-chat').click();await c.wait(() => !c.id('send-chat').disabled);
  c.intercept=null;await c.chat('Retry');
  assert.ok(sent().every(call => call.body.chatId===id));assert.equal(c.chatStore.size,1);

  const saved={id:'11111111-2222-4333-8444-555555555555',title:'Previously saved',messages:[
    {role:'user',content:'Old question'},{role:'assistant',content:'Old answer'}]};
  c.chatStore.set(saved.id,saved);c.id('toggle-assistant').click();c.id('toggle-assistant').click();await c.settle();
  const button=[...c.id('chat-history-list').querySelectorAll('button')].find(node=>node.textContent===saved.title);
  assert.ok(button);button.click();await c.chat('Continue saved chat');
  assert.equal(sent().at(-1).body.chatId,saved.id);
  assert.deepEqual(sent().at(-1).body.messages,saved.messages);
  assert.equal(c.chatStore.size,2);assert.equal(c.chatStore.get(saved.id).messages.length,4);
});

test('loaded drafts preserve their references with no reader and an unrelated reader, and leave correction mode', async t => {
  const refs=[source('original','C/original')];
  const c=await boot(t,{assets:[asset('unrelated')],drafts:[draft('saved',refs),draft('unattached')]});
  await c.create();c.chooseDraft('saved');c.submit('draft-form');await c.settle();
  assert.deepEqual(c.draftStore.get('saved').sourceRefs,refs);
  await c.open('unrelated');c.id('reader-correct').click();await c.settle();
  assert.match(c.id('draft-status').textContent,/Correction overlay/);
  c.chooseDraft('saved');c.id('finalize-draft').click();await c.settle();
  assert.equal(c.revisions.length,1);assert.equal(c.revisions[0].id,'saved');
  assert.deepEqual(c.revisions[0].sourceRefs,refs);
  assert.equal(c.calls.some(call=>call.url.pathname==='/api/overlay'),false);
  c.chooseDraft('unattached');c.submit('draft-form');await c.settle();
  assert.deepEqual(c.draftStore.get('unattached').sourceRefs,[],'An explicitly empty attachment list stays empty');
});

test('draft responses cannot replace another editor, and finalization uses the submitted text snapshot', async t => {
  const c=await boot(t,{drafts:[draft('first'),draft('second')]});await c.create();c.chooseDraft('first');
  const gate=deferred(),started=deferred();let delayed=true;
  c.intercept=async call => {if(delayed&&call.url.pathname==='/api/drafts'&&call.method==='POST') {
    delayed=false;started.resolve();await gate.promise;
  }};
  c.id('draft-body').value='Snapshot to finalize';c.id('finalize-draft').click();await started.promise;
  c.chooseDraft('second');c.id('draft-body').value='Keep editing the second draft';gate.resolve();await c.settle();
  assert.equal(c.revisions[0].id,'first');assert.equal(c.revisions[0].body,'Snapshot to finalize');
  assert.equal(c.id('draft-body').value,'Keep editing the second draft');assert.equal(c.id('draft-status').textContent,'Private draft');
  c.submit('draft-form');await c.settle();assert.equal(c.draftStore.get('second').body,'Keep editing the second draft');

  const next=deferred(),saving=deferred();
  c.intercept=async call => {if(call.url.pathname==='/api/drafts'&&call.method==='POST') {saving.resolve();await next.promise;}};
  c.id('draft-body').value='Saved snapshot';c.id('finalize-draft').click();await saving.promise;
  c.id('draft-body').value='Newer unsaved text';next.resolve();await c.settle();
  assert.equal(c.revisions.at(-1).body,'Saved snapshot');assert.equal(c.id('draft-body').value,'Newer unsaved text');
  assert.equal(c.id('draft-status').textContent,'Unsaved changes');
});

test('overlapping saves of a new draft keep one ID and preserve request order', async t => {
  const c=await boot(t);await c.create();c.id('new-draft').click();c.id('draft-title').value='One draft';
  const gate=deferred(),started=deferred();let first=true;
  c.intercept=async call => {if(first&&call.url.pathname==='/api/drafts'&&call.method==='POST') {
    first=false;started.resolve();await gate.promise;
  }};
  c.id('draft-body').value='First snapshot';c.submit('draft-form');await started.promise;
  c.id('draft-body').value='Latest snapshot';c.submit('draft-form');await c.settle();
  assert.equal(c.calls.filter(call=>call.url.pathname==='/api/drafts'&&call.method==='POST').length,1);
  gate.resolve();await c.settle();
  const requests=c.calls.filter(call=>call.url.pathname==='/api/drafts'&&call.method==='POST');
  assert.equal(requests.length,2);assert.equal(requests[0].body.id,requests[1].body.id);
  assert.equal(c.draftStore.size,1);assert.equal(c.draftStore.get(requests[0].body.id).body,'Latest snapshot');
});

test('reading-position saves retain the original asset and locator across an async source switch', async t => {
  const c=await boot(t,{assets:[asset('first'),asset('second')]});await c.open('first');
  const before=c.calls.length;
  const gate=deferred(),started=deferred();let delayed=true;
  c.intercept=async call => {if(delayed&&call.url.pathname==='/api/state/first'&&call.method==='POST') {
    delayed=false;started.resolve();await gate.promise;
  }};
  c.id('reading').scrollTop=73;c.id('reader-bookmark').click();await started.promise;
  c.places.set('first',{...c.places.get('first'),note:'Concurrent note',time:22});
  await c.open('second');c.id('reading').scrollTop=999;gate.resolve();await c.settle();
  assert.equal(c.places.get('first').scroll,73);
  assert.equal(c.places.get('first').note,'Concurrent note');assert.equal(c.places.get('first').time,22);
  assert.equal(c.calls.slice(before).some(call=>call.url.pathname==='/api/state/first'&&call.method==='GET'),false);
  const last=c.calls.filter(call=>call.url.pathname==='/api/state/first'&&call.method==='POST').at(-1);
  assert.equal(last.url.pathname,'/api/state/first');assert.equal(last.body.key,'C/first');
  assert.equal('note' in last.body,false);assert.equal('time' in last.body,false);
});

test('late correction text is discarded after switching its source', async t => {
  const c=await boot(t,{assets:[asset('first'),asset('second')]});await c.open('first');
  const gate=deferred(),started=deferred();
  c.intercept=async call => {if(call.url.pathname==='/api/assets/first/read') {started.resolve();await gate.promise;}};
  c.id('reader-correct').click();await started.promise;await c.open('second');gate.resolve();await c.settle();
  assert.equal(c.id('view-reader').classList.contains('active'),true);assert.equal(c.id('draft-body').value,'');
});

for(const kind of ['audio','video']) test(`${kind} bookmark snapshots playing time before a delayed POST and navigation without pausing`, async t => {
  const c=await boot(t,{assets:[asset('media',kind),asset('other','final')]});
  c.places.set('media',{time:5,volume:0.4});await c.open('media');
  const media=c.id('reading').querySelector(kind);assert.ok(media);
  // JSDOM has real media elements and currentTime but no decoder. Represent
  // active playback without invoking its unimplemented play/pause methods.
  Object.defineProperty(media,'paused',{value:false});media.currentTime=47.625;
  let pauses=0;media.addEventListener('pause',()=>{pauses++;});
  const before=c.calls.length;
  const gate=deferred(),started=deferred();let delayed=true;
  c.intercept=async call => {if(delayed&&call.url.pathname==='/api/state/media'&&call.method==='POST') {
    delayed=false;started.resolve();await gate.promise;
  }};
  assert.equal(media.paused,false);c.id('reader-bookmark').click();await started.promise;
  c.places.set('media',{...c.places.get('media'),note:'Concurrent media note',volume:0.8});
  media.currentTime=91.25;await c.open('other');gate.resolve();await c.settle();
  assert.equal(pauses,0,'Bookmark persistence must not depend on a pause event');
  assert.equal(c.places.get('media').time,47.625,'Save the click-time snapshot, not later playback time');
  assert.equal(c.places.get('media').volume,0.8,'Preserve concurrently changed settings');
  assert.equal(c.places.get('media').note,'Concurrent media note');
  assert.equal(c.places.get('other').time,undefined,'Do not attach the old playback time to the new work');
  assert.equal(c.calls.slice(before).some(call=>call.url.pathname==='/api/state/media'&&call.method==='GET'),false);
  const saved=c.calls.filter(call=>call.url.pathname==='/api/state/media'&&call.method==='POST');
  assert.equal(saved.length,1);assert.equal(saved[0].body.time,47.625);
  assert.equal('note' in saved[0].body,false);assert.equal('volume' in saved[0].body,false);
  await c.open('media');const restored=c.id('reading').querySelector(kind);
  restored.dispatchEvent(new c.window.Event('loadedmetadata'));
  assert.equal(restored.currentTime,47.625,'The existing media restore consumes the saved time field');
});

test('media pause posts only captured time and preserves concurrent note and reading fields', async t => {
  const c=await boot(t,{assets:[asset('media','audio'),asset('other','final')]});await c.open('media');
  const media=c.id('reading').querySelector('audio'),before=c.calls.length;
  const gate=deferred(),started=deferred();
  c.intercept=async call=>{if(call.url.pathname==='/api/state/media'&&call.method==='POST') {started.resolve();await gate.promise;}};
  media.currentTime=63.5;media.dispatchEvent(new c.window.Event('pause'));await started.promise;
  c.places.set('media',{note:'A newer note',scroll:137,font:23});
  media.currentTime=88;await c.open('other');gate.resolve();await c.settle();
  assert.deepEqual(c.places.get('media'),{note:'A newer note',scroll:137,font:23,time:63.5});
  const writes=c.calls.slice(before).filter(call=>call.url.pathname==='/api/state/media');
  assert.equal(writes.length,1);assert.equal(writes[0].method,'POST');assert.deepEqual(writes[0].body,{time:63.5});
});

test('failed and paused DynDon jobs expose Release, refresh on success and retain retry after failure', async t => {
  const jobs=[['failed-download','download','failed'],['paused-download','download','paused'],
    ['failed-generation','generation','failed'],['paused-generation','generation','paused'],
    ['running-download','download','running'],['complete-download','download','complete']]
    .map(([id,type,status])=>({id,type,status,active:status==='running',manifest:{title:id},reservationBytes:4096}));
  const c=await boot(t,{jobs});c.document.querySelector('[data-view="downloads"]').click();await c.settle();
  const card=id=>[...c.id('download-jobs').querySelectorAll('.note-card')]
    .find(node=>node.querySelector('strong').textContent.startsWith(`${id} `));
  const release=id=>[...card(id).querySelectorAll('button')].find(button=>button.textContent==='Release');
  const releasable=jobs.filter(job=>['failed','paused'].includes(job.status));
  for(const job of releasable) assert.ok(release(job.id),`${job.type} ${job.status} can be released`);
  assert.equal(release('running-download'),undefined);assert.equal(release('complete-download'),undefined);
  c.intercept=call=>call.url.pathname==='/api/dyndon/jobs/failed-download/release'
    ? Response.json({error:'Release temporarily unavailable'},{status:503}) : null;
  release('failed-download').click();await c.wait(()=>c.id('status').textContent==='Release temporarily unavailable');
  assert.equal(c.jobStore.get('failed-download').status,'failed');assert.ok(release('failed-download'));
  c.intercept=null;
  for(const job of releasable) {
    const before=c.calls.filter(call=>call.url.pathname==='/api/downloads').length;
    release(job.id).click();await c.wait(()=>card(job.id).querySelector('strong').textContent.endsWith('released'));await c.settle();
    assert.equal(release(job.id),undefined);assert.equal(c.jobStore.get(job.id).reservationBytes,0);
    assert.ok(c.calls.filter(call=>call.url.pathname==='/api/downloads').length>before,'Release refreshes job state');
    const request=c.calls.filter(call=>call.url.pathname===`/api/dyndon/jobs/${job.id}/release`).at(-1);
    assert.equal(request.method,'POST');assert.deepEqual(request.body,{});
  }
  assert.equal(c.id('status').textContent,'Job released. Its reservation is available again.');
});

for(const kind of ['zim','epub']) test(`quote anchors clear across ${kind} passages and asset changes`, async t => {
  const c=await boot(t,{assets:[asset('book',kind),asset('other','final')]});await c.open('book');c.select('Quote from first passage');
  const next=[...c.id('entry-list').querySelectorAll('button')].find(node=>/Second/.test(node.textContent));
  assert.ok(next);next.click();await c.wait(()=>c.id('work-title').textContent==='C/second');await c.settle();
  assert.equal(c.id('note-anchor').textContent,'Select text in the reader to anchor your note.');
  c.id('ask-selection').click();assert.doesNotMatch(c.id('chat-input').value,/Quote from first passage/);
  c.id('note-text').value='Note for second passage';c.submit('note-form');await c.settle();
  assert.equal(c.annotations.at(-1).locator.quote,'');assert.equal(c.annotations.at(-1).locator.key,'C/second');
  c.select('Quote from second passage');await c.open('other');
  assert.equal(c.id('note-anchor').textContent,'Select text in the reader to anchor your note.');
  c.id('note-text').value='Note for other work';c.submit('note-form');await c.settle();
  assert.equal(c.annotations.at(-1).assetId,'other');assert.equal(c.annotations.at(-1).locator.quote,'');
});

test('archive links classify extensionless resources by HEAD and keep binary bytes off the article route', async t => {
  const c=await boot(t,{assets:[asset('archive')]});
  const types=new Map([['image','image/png'],['document','application/pdf'],['sound','audio/mpeg'],
    ['article','text/html; charset=utf-8'],['chapter','application/xhtml+xml']]);
  c.intercept=call => {
    if(call.url.pathname.startsWith('/api/resources/')) {
      assert.equal(call.method,'HEAD','Classification must not download binary content');
      return new Response(null,{headers:{'Content-Type':types.get(call.url.pathname.split('/').at(-1))}});
    }
    if(call.url.pathname==='/api/assets/archive/read'&&!call.url.searchParams.get('key')) return Response.json({
      source:source('archive','C/start'),key:'C/start',resourceBase:'/api/resources/archive/',
      html:[...types.keys()].map(key=>`<a href="${key}">${key}</a>`).join('')});
  };
  await c.open('archive');
  const frame=c.id('reading').querySelector('iframe');assert.ok(frame);
  // JSDOM does not load srcdoc. Give the frame its parsed document, then fire
  // one load event so the production handlers attach to the sanitized links.
  const article=new c.window.DOMParser().parseFromString(frame.srcdoc,'text/html');
  Object.defineProperty(frame,'contentDocument',{value:article});
  frame.dispatchEvent(new c.window.Event('load'));
  function click(key) {
    const a=[...frame.contentDocument.querySelectorAll('a')].find(node=>node.textContent===key);
    assert.ok(a);assert.equal(a.dispatchEvent(new c.window.MouseEvent('click',{bubbles:true,cancelable:true})),false);
  }
  for(const key of ['image','document','sound']) {
    const before=c.opened.length;click(key);await c.wait(()=>c.opened.length>before);await c.settle();
    assert.equal(c.opened.at(-1)[0],`http://localhost/api/resources/archive/C/${key}`);
    assert.equal(c.id('status').querySelector('a').href,c.opened.at(-1)[0],'A usable link remains if a popup is blocked');
  }
  assert.equal(c.calls.filter(call=>call.url.pathname==='/api/assets/archive/read').length,1);
  click('article');await c.wait(()=>c.id('work-title').textContent==='C/article');await c.settle();
  assert.ok(c.calls.some(call=>call.url.pathname==='/api/assets/archive/read'&&call.url.searchParams.get('key')==='C/article'));
  assert.equal(c.opened.length,3,'Article navigation stays in the reader');
});
