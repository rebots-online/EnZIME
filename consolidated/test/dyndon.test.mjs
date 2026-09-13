import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createDynDon,planDynDon} from '../dyndon.mjs';
import {generateUncompressedZim,estimateZimBytes} from '../dyndon-zim.mjs';
import {openZim} from '../zim.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const budget={capacityBytes:10000,reserveBytes:100};
const manifest=units=>({id:'preparedness',version:'1',units});
async function temporary(fn){const root=await mkdtemp(path.join(os.tmpdir(),'enzime-dyndon-'));try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
function response(body,{status=200,headers={}}={}){return {status,headers:new Headers(headers),body};}

test('DynDon spreads complete units across domains and topics before increasing depth',()=>{
 const units=[{id:'water',domain:'Water',topic:'Sources',size:100},{id:'water-deep',domain:'Water',topic:'Sources',depth:2,size:100,priority:100},{id:'food',domain:'Food',topic:'Storage',size:100},{id:'power',domain:'Power',topic:'Batteries',size:100}];
 const plan=planDynDon(manifest(units),{capacityBytes:300});
 assert.deepEqual(plan.selected.map(u=>u.id),['food','power','water']);assert.equal(plan.omitted[0].reason,'budget');assert.equal(plan.coverage.filter(c=>c.selectedUnits>0).length,3);
 assert.equal(plan.planId,planDynDon(manifest([...units].reverse()),{capacityBytes:300}).planId);
});
test('breadth control trades priority depth for cross-domain coverage',()=>{
 const m=manifest([{id:'water-1',domain:'Water',size:10,priority:100},{id:'water-2',domain:'Water',size:10,priority:90},{id:'water-3',domain:'Water',size:10,priority:80},{id:'food',domain:'Food',size:10},{id:'power',domain:'Power',size:10}]);
 const count=breadth=>planDynDon(m,{capacityBytes:30,breadth}).coverage.filter(c=>c.selectedUnits).length;assert.equal(count(0),1);assert.equal(count(0.5),2);assert.equal(count(1),3);
});
test('DynDon accounts models, existing content, cache, reserve and temporary peak',()=>{
 const p=planDynDon(manifest([{id:'small',size:200,temporaryBytes:50},{id:'large',size:800}]),{capacityBytes:1000,installedBytes:100,modelBytes:300,cacheBytes:100,reserveBytes:100,temporaryBytes:20});
 assert.equal(p.budget.freeBytes,400);assert.equal(p.budget.newBytes,200);assert.equal(p.budget.reservationBytes,270);assert.equal(p.budget.remainingBytes,130);
});
test('protected dependency closure either fits completely or reports a below-minimum result',()=>{
 const m=manifest([{id:'manual',size:70,dependencies:['images']},{id:'images',size:60},{id:'other',size:10}]);
 const p=planDynDon(m,{capacityBytes:100,pinnedIds:['manual']});assert.equal(p.status,'below-minimum');assert.equal(p.selected.length,0);assert.equal(p.budget.minimumRequiredBytes,130);
 const fits=planDynDon(m,{capacityBytes:130,pinnedIds:['manual'],selectedDomains:['Unrelated'],maxDepth:0});assert.deepEqual(fits.selected.map(u=>u.id),['images','manual']);assert.ok(fits.selected.every(u=>u.protected));
 assert.throws(()=>planDynDon(manifest([{id:'a',size:1,dependencies:['missing']}]),{capacityBytes:10}),/Missing dependency/);
 assert.throws(()=>planDynDon(manifest([{id:'a',size:1,dependencies:['b']},{id:'b',size:1,dependencies:['a']}]),{capacityBytes:10}),/cycle/);
});
test('installed units cost no new bytes, and domain/depth filters disclose omissions',()=>{
 const p=planDynDon(manifest([{id:'base',size:1000,essential:true},{id:'a',domain:'Water',depth:1,size:50,dependencies:['base']},{id:'b',domain:'Water',depth:5,size:5},{id:'c',domain:'Food',size:2}]),{capacityBytes:50,installedIds:['base'],selectedDomains:['Water'],maxDepth:2});
 assert.deepEqual(p.selected.map(u=>u.id),['a','base']);assert.equal(p.budget.newBytes,50);assert.equal(p.omitted.find(u=>u.id==='b').reason,'depth-limit');assert.equal(p.omitted.find(u=>u.id==='c').reason,'domain-filter');
});
test('mutually exclusive full editions are alternatives, not extra pieces of one ZIM',()=>{
 const p=planDynDon(manifest([{id:'small',size:20,editionGroup:'wiki'},{id:'large',size:50,editionGroup:'wiki'}]),{capacityBytes:100});assert.equal(p.selected.length,1);assert.equal(p.omitted[0].reason,'edition-conflict');
});
test('SHA-256 failure never publishes an edition and resets contaminated partial bytes',()=>temporary(async root=>{
 const d=await createDynDon({root,allowUrl:()=>true,fetchImpl:async()=>response([Buffer.from('bad')],{headers:{'content-length':'3'}})});
 const j=await d.createDownloadJob(manifest([{id:'pack',size:3,sha256:hash('yes'),url:'https://packs.example/a.zim',kind:'zim'}]),budget);
 await assert.rejects(d.runDownload(j.id),/integrity verification failed/);const state=await d.getJob(j.id);assert.equal(state.status,'paused');assert.equal(state.units[0].bytesReceived,0);assert.equal((await readdir(path.join(root,'dyndon','editions'))).length,0);
}));
test('interrupted downloads persist across broker restart and resume with verified HTTP ranges',()=>temporary(async root=>{
 const data=Buffer.from('abcdef');let calls=0;
 const fetchImpl=async(url,opts)=>{calls++;if(calls===1)return response((async function*(){yield data.subarray(0,3);throw Error('Connection lost');})(),{headers:{'content-length':'6',etag:'"v1"'}});assert.equal(opts.headers.Range,'bytes=3-');assert.equal(opts.headers['If-Range'],'"v1"');return response([data.subarray(3)],{status:206,headers:{'content-range':'bytes 3-5/6','content-length':'3',etag:'"v1"'}});};
 let d=await createDynDon({root,allowUrl:()=>true,fetchImpl});const j=await d.createDownloadJob(manifest([{id:'pack',size:6,sha256:hash(data),url:'https://packs.example/a',kind:'zim'}]),budget);
 await assert.rejects(d.runDownload(j.id),/Connection lost/);assert.equal((await d.getJob(j.id)).units[0].bytesReceived,3);
 d=await createDynDon({root,allowUrl:()=>true,fetchImpl});const done=await d.resumeDownload(j.id);assert.equal(done.status,'complete');assert.deepEqual(await readFile(done.outputs[0].path),data);assert.equal(calls,2);
}));
test('a server ignoring Range safely restarts instead of appending',()=>temporary(async root=>{
 let calls=0;const data=Buffer.from('abcdef');const fetchImpl=async()=>++calls===1?response((async function*(){yield data.subarray(0,2);throw Error('Lost');})(),{headers:{'content-length':'6'}}):response([data],{headers:{'content-length':'6'}});
 const d=await createDynDon({root,allowUrl:()=>true,fetchImpl});const j=await d.createDownloadJob(manifest([{id:'a',size:6,sha256:hash(data),url:'https://packs.example/a'}]),budget);await assert.rejects(d.runDownload(j.id));const done=await d.resumeDownload(j.id);assert.deepEqual(await readFile(done.outputs[0].path),data);
}));
test('download redirect targets and URL credentials are rejected before being fetched',()=>temporary(async root=>{
 let calls=0;const d=await createDynDon({root,allowUrl:url=>url.hostname==='packs.example',fetchImpl:async()=>{calls++;return response(null,{status:302,headers:{location:'http://127.0.0.1/private'}});}});
 await assert.rejects(d.createDownloadJob(manifest([{id:'a',size:1,sha256:hash('a'),url:'https://user:secret@packs.example/a'}]),budget),/not allowed/);
 const j=await d.createDownloadJob(manifest([{id:'a',size:1,sha256:hash('a'),url:'https://packs.example/a'}]),budget);await assert.rejects(d.runDownload(j.id),/not allowed/);assert.equal(calls,1);
}));
test('reservations prevent concurrent jobs from promising the same bytes; cancel releases them',()=>temporary(async root=>{
 const d=await createDynDon({root});const m=manifest([{id:'a',size:60,essential:true}]);const j=await d.createGenerationJob(m,{capacityBytes:100});await assert.rejects(d.createGenerationJob(m,{capacityBytes:100}),/does not fit/);await d.releaseJob(j.id);assert.equal((await d.createGenerationJob(m,{capacityBytes:100})).status,'queued');
}));
test('underestimated generation is stopped before publishing or exceeding its reservation',()=>temporary(async root=>{
 const d=await createDynDon({root});const j=await d.createGenerationJob(manifest([{id:'a',size:3}]),budget);await assert.rejects(d.runGeneration(j.id,[Buffer.from('1234')]),/estimated bytes/);assert.equal((await d.getJob(j.id)).status,'paused');assert.equal((await readdir(path.join(root,'dyndon','editions'))).length,0);assert.equal((await readdir(path.join(root,'dyndon','staging'))).length,0);
}));
test('generated ZIM has stable size, OpenZIM magic, standard directory layout, and valid MD5',()=>{
 const records=[{key:'water',title:'Water',html:'<h1>Water</h1><p>Keep a local reference.</p>'},{key:'food',title:'Food',text:'A food inventory.'}];const meta={date:'2026-09-11'};const buffer=generateUncompressedZim(records,meta);assert.equal(buffer.length,estimateZimBytes(records,meta));assert.equal(buffer.readUInt32LE(0),0x044d495a);assert.equal(buffer.readUInt16LE(4),6);const checksum=Number(buffer.readBigUInt64LE(72));assert.deepEqual(buffer.subarray(checksum),createHash('md5').update(buffer.subarray(0,checksum)).digest());
 const urlTable=Number(buffer.readBigUInt64LE(32));const dir=Number(buffer.readBigUInt64LE(urlTable));assert.equal(String.fromCharCode(buffer[dir+3]),'C');assert.equal(buffer.readUInt32LE(dir+4),0);assert.equal(buffer.subarray(dir+16,dir+21).toString(),'food\0');
});
test('ZIM generation uses the shared budget planner and keeps essential article closure',()=>temporary(async root=>{
 const d=await createDynDon({root});const records=[{id:'water',key:'water',title:'Water',text:'water '.repeat(200),essential:true},{id:'food',key:'food',title:'Food',text:'food '.repeat(200)},{id:'power',key:'power',title:'Power',text:'power '.repeat(200)}];const metadata={date:'2026-09-11',title:'My kit'};const minimum=estimateZimBytes([records[0]],metadata);
 const done=await d.generateZim(records,{capacityBytes:minimum,metadata});assert.equal(done.status,'complete');assert.equal(done.plan.selected.filter(u=>u.articleCount).length,1);assert.equal(done.outputs[0].size,minimum);assert.equal(done.outputs[0].sha256,hash(await readFile(done.outputs[0].path)));await d.releaseJob(done.id,{removeFiles:true});assert.equal((await d.getJob(done.id)).status,'released');
}));
test('generated ZIM reopens through the independently verified archive reader',()=>temporary(async root=>{
 const d=await createDynDon({root});const job=await d.generateZim([{key:'C/water',title:'Water',html:'<h1>Water</h1><p>Prepared reference.</p>'},{key:'C/中文',title:'中文',text:'本地知识'}],{capacityBytes:100000,metadata:{title:'Kit',language:'eng'}});
 const archive=await openZim(job.outputs[0].path);try{const articles=await archive.list();assert.equal(articles.length,2);assert.equal((await archive.read('C/water')).bytes.toString(),'<h1>Water</h1><p>Prepared reference.</p>');assert.equal((await archive.read('C/中文')).bytes.toString(),'本地知识');assert.equal((await archive.verify()).valid,true);}finally{await archive.close();}
}));
test('user pause aborts an active body, exposes progress, and resumes persisted bytes',()=>temporary(async root=>{
 let reachedStall;const stalled=new Promise(resolve=>{reachedStall=resolve;});let calls=0;const data=Buffer.from('abcdef');
 const d=await createDynDon({root,allowUrl:()=>true,fetchImpl:async(url,options)=>{
   if(++calls===1)return response((async function*(){yield data.subarray(0,3);reachedStall();await new Promise(()=>{});})(),{headers:{'content-length':'6'}});
   assert.equal(options.headers.Range,'bytes=3-');return response([data.subarray(3)],{status:206,headers:{'content-range':'bytes 3-5/6','content-length':'3'}});
 }});
 const j=await d.createDownloadJob(manifest([{id:'a',size:6,sha256:hash(data),url:'https://packs.example/a'}]),budget);const run=d.runDownload(j.id);run.catch(()=>{});await stalled;const active=await d.getJob(j.id);assert.equal(active.active,true);assert.equal(active.units[0].bytesReceived,3);
 const paused=await d.pauseDownload(j.id);assert.equal(paused.status,'paused');assert.equal(paused.active,false);assert.equal(paused.pauseReason,'DYNDON_PAUSED');assert.equal(paused.units[0].bytesReceived,3);await assert.rejects(run,/paused/);assert.equal((await d.resumeDownload(j.id)).status,'complete');await d.close();
}));
test('stalled headers and stalled bodies time out without losing resumable progress',()=>temporary(async root=>{
 const d=await createDynDon({root,allowUrl:()=>true,transferTimeoutMs:20,fetchImpl:async()=>response((async function*(){yield Buffer.from('a');await new Promise(()=>{});})(),{headers:{'content-length':'2'}})});
 const j=await d.createDownloadJob(manifest([{id:'a',size:2,sha256:hash('ab'),url:'https://packs.example/a'}]),budget);await assert.rejects(d.runDownload(j.id),/stalled/);assert.equal((await d.getJob(j.id)).units[0].bytesReceived,1);
 const headers=await createDynDon({root,allowUrl:()=>true,transferTimeoutMs:20,fetchImpl:()=>new Promise(()=>{})});const k=await headers.createDownloadJob(manifest([{id:'b',size:2,sha256:hash('ab'),url:'https://packs.example/b'}]),budget);await assert.rejects(headers.runDownload(k.id),/stalled/);assert.equal((await headers.getJob(k.id)).pauseReason,'DYNDON_TIMEOUT');await d.close();await headers.close();
}));
test('closing the broker aborts downloads, records pause, and forbids new work',()=>temporary(async root=>{
 let requested;const ready=new Promise(resolve=>{requested=resolve;});const d=await createDynDon({root,allowUrl:()=>true,fetchImpl:()=>{requested();return new Promise(()=>{});}});const j=await d.createDownloadJob(manifest([{id:'a',size:2,sha256:hash('ab'),url:'https://packs.example/a'}]),budget);const run=d.runDownload(j.id);run.catch(()=>{});await ready;await d.close();await assert.rejects(run,/broker closed/);assert.equal((await d.getJob(j.id)).pauseReason,'DYNDON_CLOSED');await assert.rejects(d.runDownload(j.id),/manager is closed/);
}));
test('live free-space budgets do not reserve completed outputs a second time',()=>temporary(async root=>{
 const d=await createDynDon({root});const j=await d.createGenerationJob(manifest([{id:'a',size:60,essential:true}]),{capacityBytes:100});await d.runGeneration(j.id,[Buffer.alloc(60)]);const next=manifest([{id:'b',size:40,essential:true}]);
 const live=await d.plan(next,{capacityBytes:40,liveDiskFree:true});assert.equal(live.status,'ready');assert.equal(live.budget.reservedBytes,0);const fixed=await d.plan(next,{capacityBytes:100});assert.equal(fixed.budget.reservedBytes,60);assert.equal(fixed.status,'ready');await d.close();
}));
test('live free-space budgets reserve only undownloaded bytes of paused jobs',()=>temporary(async root=>{
 const d=await createDynDon({root,allowUrl:()=>true,fetchImpl:async()=>response((async function*(){yield Buffer.alloc(20);throw Error('Interrupted');})(),{headers:{'content-length':'60'}})});const j=await d.createDownloadJob(manifest([{id:'a',size:60,sha256:hash(Buffer.alloc(60)),url:'https://packs.example/a'}]),{capacityBytes:100});await assert.rejects(d.runDownload(j.id),/Interrupted/);
 const p=await d.plan(manifest([{id:'b',size:40,essential:true}]),{capacityBytes:80,liveDiskFree:true});assert.equal(p.status,'ready');assert.equal(p.budget.reservedBytes,40);const small=await d.plan(manifest([{id:'b',size:41,essential:true}]),{capacityBytes:80,liveDiskFree:true});assert.equal(small.status,'below-minimum');await d.close();
}));
