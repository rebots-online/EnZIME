import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,writeFile,readFile,utimes,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {randomUUID,createHash} from 'node:crypto';
import {openStore} from '../storage.mjs';

const meta={name:'Reference.txt',kind:'final',mime:'text/plain'};
const stream=text=>Readable.from([Buffer.from(text)]);
async function fixture(t,options){const root=await mkdtemp(path.join(os.tmpdir(),'enzime-storage-'));let store=await openStore(root,options);t.after(async()=>{store.close();await rm(root,{recursive:true,force:true});});return {root,get store(){return store;},async restart(){store.close();store=await openStore(root,options);return store;}};}

test('deduplicated bytes retain independent editions and multiple stable annotations after restart',async t=>{
 const f=await fixture(t),a=await f.store.put(stream('chapter one'),{...meta,sourceId:'book-a',version:'1'}),b=await f.store.put(stream('chapter one'),{...meta,name:'Different title',sourceId:'book-b',version:'7'});
 assert.equal(a.id,b.id);assert.notEqual(a.editionId,b.editionId);assert.equal(f.store.list().length,1);assert.equal(f.store.listEditions().length,2);
 const note=f.store.saveAnnotation({assetId:a.id,editionId:a.editionId,locator:{articleKey:'A/Chapter_one',quote:'one'},text:'First note'});
 f.store.saveAnnotation({assetId:a.id,editionId:b.editionId,locator:{page:2},text:'Independent annotation'});
 f.store.saveState(a.id,{page:3});await f.restart();
 assert.equal(f.store.listAnnotations(a.id).length,2);assert.deepEqual(f.store.readState(a.id),{page:3});assert.equal(f.store.getEdition(b.editionId).sourceId,'book-b');
 const updated=f.store.saveAnnotation({...note,text:'Edited without losing identity'});assert.equal(updated.id,note.id);assert.equal(updated.created,note.created);
 assert.throws(()=>f.store.saveAnnotation({...note,editionId:b.editionId}),/identity is immutable/);
});

test('drafts stay private while final revisions preserve immutable bytes, provenance and lineage',async t=>{
 const f=await fixture(t),source=await f.store.put(stream('source evidence'),meta),draft=f.store.saveDraft({title:'Field notes',body:'First edition',sourceRefs:[{assetId:source.id,editionId:source.editionId,articleKey:'A/Evidence'}]});
 assert.equal(f.store.list().length,1);assert.equal(draft.private,true);
 const first=await f.store.finalizeDraft(draft.id);f.store.saveDraft({...draft,body:'Second edition'});const second=await f.store.finalizeDraft(draft.id);
 assert.equal(second.parentRevisionId,first.id);assert.equal(second.lineageId,first.lineageId);assert.notEqual(first.assetId,second.assetId);
 assert.equal(await readFile(f.store.file(first.assetId),'utf8'),'First edition');assert.equal(await readFile(f.store.file(second.assetId),'utf8'),'Second edition');
 await f.restart();assert.equal(f.store.getDraft(draft.id).body,'Second edition');assert.equal(f.store.listRevisions(first.lineageId).length,2);assert.equal(f.store.getRevision(first.id).sourceRefs[0].assetId,source.id);
 const immutableBackup=await f.store.exportBackup();immutableBackup.revisions.find(r=>r.id===first.id).title='Tampered';await assert.rejects(f.store.importBackup(immutableBackup),/Immutable revision conflict/);
});

test('settings, conversations and shared model references persist independently of source bytes',async t=>{
 const f=await fixture(t);f.store.saveSettings({model:'lfm2.5',theme:'dark'});f.store.saveSettings({contextTokens:8192});
 const chat=f.store.saveChat({title:'Preparedness research',messages:[{role:'user',content:'What references are available?'},{role:'assistant',content:'Local sources only.',citations:[]}]});
 f.store.saveModelReference({name:'LFM 2.5',path:'/mnt/mba.robin/models/LFM.gguf'});f.store.saveModelReference({name:'Android model',uri:'content://com.android.externalstorage.documents/tree/primary%3Amba.robin'});
 await f.restart();assert.deepEqual(f.store.getSettings(),{model:'lfm2.5',theme:'dark',contextTokens:8192});assert.equal(f.store.getChat(chat.id).messages.length,2);assert.equal(f.store.listModelReferences().length,2);assert.equal(f.store.stats().managedBytes,0);
 assert.throws(()=>f.store.saveModelReference({name:'Relative',path:'../../model.gguf'}),/absolute/);
});

test('single-writer lock excludes overlapping processes and restart recovers staging',async t=>{
 const f=await fixture(t);await assert.rejects(openStore(f.root),e=>e.code==='STORE_LOCKED');
 await writeFile(path.join(f.root,'tmp','interrupted-upload'),'partial');const orphan=createHash('sha256').update('orphan').digest('hex');await writeFile(path.join(f.root,'objects',orphan),'orphan');
 await f.restart();assert.deepEqual(await readdir(path.join(f.root,'tmp')),[]);assert.deepEqual(await readdir(path.join(f.root,'objects')),[]);
});

test('aborted and oversized uploads leave no objects or staging; concurrent quota checks serialize',async t=>{
 const f=await fixture(t,{quotaBytes:8});async function* broken(){yield Buffer.from('part');throw Error('transport interrupted');}
 await assert.rejects(f.store.put(broken(),meta),/transport interrupted/);
 await assert.rejects(f.store.put(stream('oversized'),meta,3),/size limit/);
 const results=await Promise.allSettled([f.store.put(stream('123456'),meta),f.store.put(stream('abcdef'),meta)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected')[0].reason.code,'QUOTA_EXCEEDED');
 assert.equal(f.store.stats().managedBytes,6);assert.equal(f.store.list().length,1);assert.deepEqual(await readdir(path.join(f.root,'tmp')),[]);
 // Reimporting existing bytes creates an edition without consuming another quota allocation.
 const existing=f.store.list()[0];await f.store.put(createReadStreamSafe(f.store.file(existing.id)),meta);assert.equal(f.store.stats().managedBytes,6);
});
function createReadStreamSafe(file){return (async function*(){yield await readFile(file);})();}

test('mounts do not copy shared files and invalidate references when source bytes change',async t=>{
 const f=await fixture(t,{quotaBytes:1}),external=path.join(f.root,'shared.gguf');await writeFile(external,'shared model');
 const item=await f.store.mount(external,{name:'Shared model',kind:'model',mime:'application/octet-stream'});assert.equal(item.storage,'mounted');assert.equal(f.store.file(item.id),external);assert.equal(f.store.stats().managedBytes,0);assert.equal(f.store.stats().mountedBytes,12);assert.equal((await f.store.verify(item.id)).ok,true);
 await writeFile(external,'changed model');await utimes(external,new Date(),new Date(Date.now()+1000));
 assert.throws(()=>f.store.file(item.id),e=>e.code==='SOURCE_CHANGED');assert.equal((await f.store.verify(item.id)).ok,false);
 const newer=await f.store.mount(external,{name:'Shared model new',kind:'model',parentEditionId:item.editionId});assert.notEqual(newer.id,item.id);assert.equal(f.store.getEdition(newer.editionId).parentEditionId,item.editionId);
});

test('embedded backup restores all metadata and byte integrity across stores',async t=>{
 const a=await fixture(t),b=await fixture(t),asset=await a.store.put(stream('original source'),meta);
 const annotation=a.store.saveAnnotation({assetId:asset.id,editionId:asset.editionId,locator:{page:1},text:'Keep this citation'});
 const draft=a.store.saveDraft({title:'Curated note',body:'Derived final',sourceRefs:[{assetId:asset.id}]});const final=await a.store.finalizeDraft(draft.id);
 a.store.saveState(asset.id,{page:1});a.store.saveSettings({contextTokens:4096});a.store.saveChat({messages:[{role:'user',content:'question'}]});
 const backup=await a.store.exportBackup({includeBytes:true}),result=await b.store.importBackup(backup);assert.equal(result.missingObjects,0);assert.equal(result.importedObjects,2);
 await b.restart();assert.equal((await b.store.verify(asset.id)).ok,true);assert.equal(b.store.listAnnotations()[0].id,annotation.id);assert.equal(b.store.getRevision(final.id).assetId,final.assetId);assert.equal(b.store.listChats().length,1);assert.equal(b.store.getSettings().contextTokens,4096);
 await b.store.importBackup(backup);assert.equal(b.store.list().length,2);assert.equal(b.store.listRevisions().length,1);
});

test('manifest-only restore keeps missing bytes explicit and later payload restore repairs references',async t=>{
 const a=await fixture(t),b=await fixture(t),asset=await a.store.put(stream('offline source'),meta);a.store.saveAnnotation({assetId:asset.id,locator:{page:1},text:'Preserved even without source bytes'});
 const manifest=await a.store.exportBackup(),result=await b.store.importBackup(manifest);assert.equal(result.missingObjects,1);assert.equal(b.store.get(asset.id).storage,'missing');assert.throws(()=>b.store.file(asset.id),e=>e.code==='SOURCE_MISSING');assert.equal((await b.store.verify(asset.id)).ok,false);assert.equal(b.store.listAnnotations().length,1);
 await b.store.importBackup(await a.store.exportBackup({includeBytes:true}));assert.equal((await b.store.verify(asset.id)).ok,true);assert.equal(b.store.get(asset.id).storage,'managed');
});

test('backup integrity, graph identity and quota failures roll back bytes and metadata together',async t=>{
 const a=await fixture(t),b=await fixture(t,{quotaBytes:5});await a.store.put(stream('1234'),meta);await a.store.put(stream('5678'),meta);const backup=await a.store.exportBackup({includeBytes:true});
 await assert.rejects(b.store.importBackup(backup),e=>e.code==='QUOTA_EXCEEDED');assert.equal(b.store.list().length,0);assert.deepEqual(await readdir(path.join(b.root,'tmp')),[]);assert.deepEqual(await readdir(path.join(b.root,'objects')),[]);
 const bad=structuredClone(backup);bad.objects=bad.objects.slice(0,1);bad.editions=bad.editions.filter(e=>e.assetId===bad.objects[0].id);bad.objects[0].bytes=Buffer.from('evil').toString('base64');await assert.rejects(b.store.importBackup(bad),e=>e.code==='INTEGRITY_ERROR');
 const malformed=structuredClone(backup);malformed.objects=malformed.objects.slice(0,1);malformed.editions=malformed.editions.filter(e=>e.assetId===malformed.objects[0].id);malformed.annotations=[{id:randomUUID(),assetId:'f'.repeat(64),locator:{page:1},text:'dangling'}];await assert.rejects(b.store.importBackup(malformed),/unknown asset/);assert.deepEqual(await readdir(path.join(b.root,'tmp')),[]);assert.equal(b.store.list().length,0);
});

test('paths and metadata cannot escape object storage, and verification detects changed managed bytes',async t=>{
 const f=await fixture(t),asset=await f.store.put(stream('authentic'),meta);assert.throws(()=>f.store.file('../catalog.sqlite'),/Unknown asset/);assert.throws(()=>f.store.saveAnnotation({assetId:asset.id,locator:{},text:'no locator'}),/stable source locator/);
 await writeFile(f.store.file(asset.id),'tampered');const result=await f.store.verify(asset.id);assert.equal(result.ok,false);assert.notEqual(result.actualHash,asset.id);
});


test('EPUB and HTML imports preserve independent document kinds through backup restoration',async t=>{
 const a=await fixture(t),b=await fixture(t);
 const epub=await a.store.put(stream('epub archive fixture'),{name:'Field manual.epub',kind:'epub',mime:'application/epub+zip'});
 const html=await a.store.put(stream('<p>Archived instructions</p>'),{name:'Instructions.html',kind:'html',mime:'text/html'});
 await b.store.importBackup(await a.store.exportBackup({includeBytes:true}));
 assert.equal(b.store.get(epub.id).kind,'epub');assert.equal(b.store.get(html.id).kind,'html');
 assert.equal(b.store.get(html.id).mime,'text/html');assert.equal((await b.store.verify(epub.id)).ok,true);
});
