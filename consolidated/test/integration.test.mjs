import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import {createApp} from '../server.mjs';
import {generateUncompressedZim} from '../dyndon-zim.mjs';

async function app(t,options={}){
 const root=await mkdtemp(path.join(tmpdir(),'enzime-integration-'));
 const instance=await createApp({root,runtimeOptions:{binary:''},...options});
 await new Promise(resolve=>instance.server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${instance.server.address().port}`;
 t.after(async()=>{await instance.close();await rm(root,{recursive:true,force:true});});
 async function json(route,body,expected=body===undefined?200:201){
  const response=await fetch(base+route,body===undefined?{}:{method:'POST',headers:{'X-MBA-Client':'enzime','Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return data;
 }
 async function upload(bytes,kind,name){const response=await fetch(`${base}/api/assets?kind=${kind}&name=${encodeURIComponent(name)}`,{method:'POST',headers:{'X-MBA-Client':'enzime'},body:bytes});const data=await response.json();assert.equal(response.status,201,JSON.stringify(data));return data;}
 return{...instance,base,root,json,upload};
}
function simplePdf(text){
 const stream=`BT /F1 12 Tf 30 700 Td (${text.replace(/[()\\]/g,'\\$&')}) Tj ET\n`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`];
 let output='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(output));output+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=Buffer.byteLength(output);output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('');output+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(output);
}
function simpleEpub(){return zipSync({
 mimetype:strToU8('application/epub+zip'),
 'META-INF/container.xml':strToU8('<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'),
 'OEBPS/content.opf':strToU8('<package><metadata><title>Field Notebook</title></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>'),
 'OEBPS/chapter.xhtml':strToU8('<html><body><h1>Soil preparation</h1><p>Soil records belong beside the field manual.</p></body></html>'),
});}

test('HTTP mounts an official OpenZIM fixture, reads HTML and binary resources, verifies and retrieves it',async t=>{
 const a=await app(t);
 const bytes=await readFile(fileURLToPath(new URL('../native/fixtures/openzim-v6-small.zim',import.meta.url)));
 const asset=await a.upload(bytes,'zim','Official fixture.zim');
 const entries=await a.json(`/api/assets/${asset.id}/entries`);assert.equal(entries.entries[0].key,'C/main.html');assert.equal(entries.metadata.version,'6.1');
 const read=await a.json(`/api/assets/${asset.id}/read`);assert.match(read.text,/Test ZIM file/);assert.equal(read.source.locator.key,'C/main.html');
 const image=await fetch(`${a.base}/api/resources/${asset.id}/C/favicon.png`);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()).subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
 const verified=await a.json(`/api/assets/${asset.id}/verify`);assert.equal(verified.ok,true);assert.equal(verified.archive.valid,true);
 const result=await a.json('/api/search',{query:'Test ZIM'},200);assert.equal(result.results[0].citation.assetId,asset.id);assert.equal(result.status.mode,'lexical+graph');
 const graph=await a.json('/api/graph');assert.ok(graph.nodes.some(n=>n.id===read.source.id));
});

test('HTTP notes, immutable corrections and tombstones maintain one active source and preserve annotation revisions',async t=>{
 const a=await app(t);
 const bytes=generateUncompressedZim([{key:'C/Water',title:'Water',html:'<h1>Water</h1><p>Original obsolete instructions.</p><a href="Soil">Soil</a>'},{key:'C/Soil',title:'Soil',text:'Soil preparation and water records.'}]);
 const asset=await a.upload(bytes,'zim','Field.zim');
 const original=await a.json(`/api/assets/${asset.id}/read?key=C/Water`);await a.json(`/api/assets/${asset.id}/read?key=C/Soil`);
 const initialGraph=await a.json('/api/graph');assert.equal(initialGraph.edges[0].sourceId,original.source.id);assert.equal(initialGraph.edges[0].kind,'explicit');
 const note=await a.json('/api/annotations',{assetId:asset.id,locator:{key:'C/Water'},text:'My first field observation.'});
 const updated=await a.json('/api/annotations',{id:note.id,assetId:asset.id,locator:{key:'C/Water'},text:'My amended field observation.'});assert.notEqual(note.sourceId,updated.sourceId);
 assert.equal((await a.json(`/api/sources/${note.sourceId}/read`)).text,'My first field observation.');assert.equal((await a.json(`/api/sources/${updated.sourceId}/read`)).text,'My amended field observation.');
 assert.equal(a.knowledge.listNotes().length,2);assert.equal(a.knowledge.listSources().filter(s=>s.kind==='note').length,1);
 const correction=await a.json('/api/overlay',{sourceId:original.source.id,text:'Corrected water instructions with current measurements.'});
 await a.json(`/api/assets/${correction.source.assetId}/read?key=C/Water`);
 const result=await a.json('/api/search',{query:'water'},200);assert.ok(result.results.some(r=>r.id===correction.source.id));assert.ok(!result.results.some(r=>r.id===original.source.id));
 assert.equal(result.results.filter(r=>r.citation.assetId===correction.source.assetId).length,1,'corrections are not independently reindexed as duplicates');
 const beforeSources=a.knowledge.listSources({active:false}).length;
 const repeated=await a.json('/api/overlay',{sourceId:correction.source.id,text:'Corrected water instructions with current measurements.'});assert.notEqual(repeated.source.id,correction.source.id);assert.equal(a.knowledge.listSources({active:false}).length,beforeSources+1);
 await a.json('/api/overlay',{sourceId:repeated.source.id,deleted:true});
 const deleted=await a.json('/api/search',{query:'water'},200);assert.ok(!deleted.results.some(r=>r.citation.key==='C/Water'));
 const cleared=await a.json('/api/cache/clear',{},200);assert.equal(cleared.notes,2);assert.equal(cleared.projectionCache.bytes,0);
 const backup=await a.json('/api/backup?bytes=true'),restored=await app(t);await restored.json('/api/backup',backup);assert.ok(!restored.knowledge.listSources().some(s=>s.key==='C/Water'));
});

test('HTTP PDF extraction, EPUB reading and final draft revisions participate in cited retrieval',async t=>{
 const a=await app(t);
 const pdf=await a.upload(simplePdf('Water inspection is recorded on page one.'),'pdf','Inspection.pdf');
 assert.equal((await a.json(`/api/assets/${pdf.id}/info`)).pages,1);
 const page=await a.json(`/api/assets/${pdf.id}/read?page=1`);assert.match(page.text,/Water inspection/);assert.equal(page.source.locator.page,1);
 const anotherPdf=await a.upload(simplePdf('A second field manual records soil observations.'),'pdf','Second.pdf');assert.equal((await a.json(`/api/assets/${anotherPdf.id}/read?page=1`)).page,1);assert.match((await a.json(`/api/assets/${pdf.id}/read?page=1`)).text,/Water inspection/,'PDF eviction and reopen release the real loading task');
 const epub=await a.upload(simpleEpub(),'epub','Notebook.epub');
 const chapter=await a.json(`/api/assets/${epub.id}/read`);assert.equal(chapter.key,'OEBPS/chapter.xhtml');assert.match(chapter.text,/Soil records/);
 const draft=await a.json('/api/drafts',{title:'Private practice notes',body:'Water inspection and soil records are linked here.',format:'text',sourceRefs:[{assetId:pdf.id}]});
 const first=await a.json('/api/finalize',{id:draft.id});
 await a.json('/api/drafts',{id:draft.id,title:'Private practice notes',body:'Revised water inspection and soil records.',format:'text',sourceRefs:[{assetId:pdf.id}]});
 const second=await a.json('/api/finalize',{id:draft.id});assert.equal(second.parentRevisionId,first.id);assert.notEqual(second.assetId,first.assetId);
 const results=await a.json('/api/search',{query:'water inspection'},200);assert.ok(results.results.some(r=>r.citation.assetId===pdf.id));assert.ok(results.results.some(r=>r.citation.assetId===second.assetId));assert.ok(!results.results.some(r=>r.citation.assetId===first.assetId),'new final revisions supersede older text in the active knowledge view');
});

test('HTTP streaming chat and embeddings integrate with an injected protocol fixture, not a claimed real model',async t=>{
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  calls.push({url,body:options.body?JSON.parse(options.body):undefined});
  if(url.endsWith('/models'))return Response.json({data:[{id:'LFM2.5-fixture'}]});
  if(url.endsWith('/embeddings')){const body=JSON.parse(options.body);return Response.json({model:body.model,data:body.input.map((_,index)=>({index,embedding:[1,0]}))});}
  if(url.endsWith('/chat/completions'))return new Response('data: {"choices":[{"index":0,"delta":{"reasoning_content":"Inspect the supplied excerpt."}}]}\n\ndata: {"choices":[{"index":0,"delta":{"content":"The fixture passage discusses water records [S1]."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  throw Error('Unexpected fixture route');
 };
 const a=await app(t,{chatbotOptions:{fetchImpl}});
 await a.upload(Buffer.from('Water records contain the local observations.'),'final','Water records.txt');
 await a.json('/api/settings',{embeddingModel:'fixture-embed'},200);
 const result=await a.json('/api/search',{query:'water'},200);assert.equal(result.status.mode,'lexical+graph+vector');assert.ok(result.results[0].scores.vector>0.9);
 const response=await fetch(a.base+'/api/chat',{method:'POST',headers:{'X-MBA-Client':'enzime','Content-Type':'application/json'},body:JSON.stringify({message:'Explain the water records.'})});assert.equal(response.status,200);
 const events=(await response.text()).trim().split('\n').map(JSON.parse);assert.ok(events.some(e=>e.type==='reasoning'));assert.ok(events.some(e=>e.type==='delta'));assert.ok(events.some(e=>e.type==='done'));
 assert.equal(events[0].type,'evidence');assert.ok(events[0].results[0].citation.contentHash);
 const completion=calls.find(c=>c.url.endsWith('/chat/completions'));assert.equal(completion.body.model,'LFM2.5-fixture');assert.ok(completion.body.messages.some(m=>m.content.includes('untrusted_retrieved_evidence')));
 const chats=await a.json('/api/chats');assert.equal(chats.length,1);assert.match(chats[0].messages.at(-1).content,/\[S1\]/);
});

test('HTTP DynDon generation adopts a verified ZIM without copying output payloads',async t=>{
 const a=await app(t);
 const generated=await a.json('/api/dyndon/generate',{metadata:{title:'Small field edition'},records:[{key:'Water',title:'Water',text:'Generated water storage records.\n\nA < B and C > D.\n',essential:true},{key:'Soil',title:'Soil',text:'Generated soil preparation records.'}],options:{desiredBytes:65536,reserveBytes:4096}});
 assert.equal(generated.status,'complete');assert.equal(generated.assets.length,1);assert.equal(generated.assets[0].storage,'mounted');
 const asset=generated.assets[0];const read=await a.json(`/api/assets/${asset.id}/read?key=C/Water`);assert.equal(read.text,'Generated water storage records.\n\nA < B and C > D.\n');assert.equal(Object.hasOwn(read,'html'),false);assert.equal((await a.json('/api/search',{query:'water'},200)).results[0].text,read.text);
 assert.equal((await a.json(`/api/assets/${asset.id}/verify`)).archive.valid,true);
 const resumed=await a.json('/api/dyndon/resume',{id:generated.id},400);assert.match(resumed.error,/Not a download job/);
 const plan=await a.json('/api/dyndon/plan',{manifest:{units:[{id:'too-large',size:1000000,essential:true}]},options:{desiredBytes:1}},200);assert.equal(plan.status,'below-minimum');assert.equal(plan.selected.length,0);
});

test('HTTP background model download pauses, resumes ranges, adopts shared bytes and reports runtime configuration',async t=>{
 const a=await app(t),bytes=Buffer.alloc(65536,41);bytes.write('GGUF download protocol fixture');let requests=0,range;
 const upstream=http.createServer((req,res)=>{requests++;range=req.headers.range;const offset=range?Number(range.match(/bytes=(\d+)-/)[1]):0;res.writeHead(offset?206:200,{'Content-Length':bytes.length-offset,'Content-Type':'application/octet-stream',ETag:'"fixture-v1"',...(offset?{'Content-Range':`bytes ${offset}-${bytes.length-1}/${bytes.length}`}:{})});if(!offset){res.write(bytes.subarray(0,16384));}else res.end(bytes.subarray(offset));});
 await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));t.after(async()=>{upstream.closeAllConnections();await new Promise(resolve=>upstream.close(resolve));});
 const manifest={id:'fixture-model',units:[{id:'model',kind:'model',title:'GGUF download fixture',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),url:`http://127.0.0.1:${upstream.address().port}/model`,essential:true}]};
 const started=await a.json('/api/dyndon/download',{manifest,options:{desiredBytes:1024**2,reserveBytes:0}});assert.equal(started.status,'queued');
 async function waitFor(predicate){for(let tries=0;tries<200;tries++){const job=(await a.json('/api/downloads')).find(j=>j.id===started.id);if(predicate(job))return job;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('Timed out awaiting transfer fixture');}
 await waitFor(job=>job.units[0].bytesReceived>0);
 const paused=await a.json('/api/dyndon/pause',{id:started.id},200);assert.equal(paused.status,'paused');assert.equal(paused.units[0].bytesReceived,16384);
 assert.equal((await a.json('/api/dyndon/resume',{id:started.id},200)).status,'running');
 const completed=await waitFor(job=>job.status==='complete'&&job.assets?.length);assert.equal(completed.assets[0].kind,'model');assert.equal(completed.assets[0].storage,'mounted');assert.equal(requests,2);assert.equal(range,'bytes=16384-');assert.equal(a.store.stats().managedBytes,0);
 assert.equal((await a.json('/api/model-references')).filter(r=>r.assetId===completed.assets[0].id).length,1);
 const runtime=await a.json('/api/runtime');assert.equal(runtime.configured,false);assert.equal(runtime.status.state,'unconfigured');await a.json('/api/runtime/start',{assetId:completed.assets[0].id},503);
 const plan=await a.json('/api/dyndon/plan',{manifest:{units:[{id:'next',size:1}]},options:{desiredBytes:1,reserveBytes:0}},200);assert.equal(plan.budget.reservedBytes,0,'completed mounted files are not reserved twice against live disk free');
});

test('HTTP backup round-trip retains source bytes, overlay precedence, assertions and note snapshots',async t=>{
 const original=await app(t);
 const asset=await original.upload(Buffer.from('Original water notes.'),'final','Water.txt');const read=await original.json(`/api/assets/${asset.id}/read`);
 const corrected=await original.json('/api/overlay',{sourceId:read.source.id,text:'Corrected water notes.'});
 await original.json('/api/annotations',{assetId:asset.id,locator:{key:''},text:'User owned note snapshot.'});
 const backup=await original.json('/api/backup?bytes=true');assert.equal(backup.knowledgeMesh.version,1);assert.ok(backup.knowledgeMesh.sources.length>=3);assert.equal(Object.hasOwn(backup.knowledgeMesh,'projections'),false);
 const restored=await app(t);const imported=await restored.json('/api/backup',backup);assert.equal(imported.missingObjects,0);assert.equal(imported.knowledgeSources,backup.knowledgeMesh.sources.length);
 const result=await restored.json('/api/search',{query:'water'},200);assert.ok(result.results.some(r=>r.id===corrected.source.id));assert.ok(!result.results.some(r=>r.id===read.source.id));assert.equal(restored.knowledge.listNotes()[0].text,'User owned note snapshot.');
 const clean=await app(t),bad=structuredClone(backup),badSource=JSON.parse(bad.knowledgeMesh.sources[0].metadata);badSource.body='A corpus-body copy hidden in metadata.';bad.knowledgeMesh.sources[0].metadata=JSON.stringify(badSource);
 await clean.json('/api/backup',bad,400);assert.equal(clean.store.list().length,0,'mesh validation precedes storage import');
 const absentLayer=structuredClone(backup);absentLayer.knowledgeMesh.layers=[];await clean.json('/api/backup',absentLayer,400);assert.equal(clean.store.list().length,0);
 const changedNote=structuredClone(backup);changedNote.knowledgeMesh.notes[0].text='Changed snapshot bytes.';await clean.json('/api/backup',changedNote,400);assert.equal(clean.store.list().length,0);
 const remote=structuredClone(backup);remote.settings={endpoint:'https://example.com/v1',allowRemote:true};await clean.json('/api/backup',remote);const config=await clean.json('/api/config');assert.equal(config.settings.allowRemote,false);assert.equal(config.chatbot.privacy,'device-local');assert.match(config.chatbot.endpoint,/127\.0\.0\.1/);
});
