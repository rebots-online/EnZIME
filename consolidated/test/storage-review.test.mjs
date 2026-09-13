import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {openStore} from '../storage.mjs';

const staging=fileURLToPath(new URL('../../.staging/review-tests',import.meta.url));
const stream=text=>Readable.from([Buffer.from(text)]);
const meta={name:'Original.txt',kind:'final',mime:'text/plain'};
async function fixture(t,options){await mkdir(staging,{recursive:true});const root=await mkdtemp(path.join(staging,'storage-review-')),store=await openStore(root,options);t.after(async()=>{await store.drain();store.close();await rm(root,{recursive:true,force:true});});return {root,store};}

test('deduplicated imports and mounts expose the selected media edition, including after backup restore',async t=>{
 const a=await fixture(t),b=await fixture(t),text='<p>Water records</p>';
 const first=await a.store.put(stream(text),meta),second=await a.store.put(stream(text),{name:'Article.html',kind:'html',mime:'text/html'});
 assert.equal(first.id,second.id);assert.equal(second.kind,'html');assert.equal(second.mime,'text/html');assert.equal(a.store.get(first.id).editionId,second.editionId);assert.equal(a.store.list()[0].kind,'html');
 assert.equal(a.store.getEdition(first.editionId).kind,'final');assert.equal(a.store.stats().managedBytes,Buffer.byteLength(text));
 await b.store.importBackup(await a.store.exportBackup({includeBytes:true}));assert.equal(b.store.get(first.id).editionId,second.editionId);assert.equal(b.store.get(first.id).kind,'html');
 const external=path.join(a.root,'mounted.txt');await writeFile(external,text);
 const third=await a.store.mount(external,{name:'Mounted text',kind:'final',mime:'text/plain'});
 assert.equal(third.id,first.id);assert.equal(third.kind,'final');assert.equal(a.store.list()[0].editionId,third.editionId);assert.equal(a.store.getEdition(second.editionId).kind,'html');
});

test('embedded restore repairs corrupted or missing managed bytes without charging quota twice',async t=>{
 const {store,root}=await fixture(t,{quotaBytes:9}),asset=await store.put(stream('authentic'),meta),backup=await store.exportBackup({includeBytes:true});
 await writeFile(store.file(asset.id),'corrupted');assert.equal((await store.verify(asset.id)).ok,false);
 const result=await store.importBackup(backup);assert.equal(result.importedBytes,9);assert.equal((await store.verify(asset.id)).ok,true);assert.equal(store.stats().managedBytes,9);
 await rm(store.file(asset.id));await store.importBackup(backup);assert.equal(await readFile(store.file(asset.id),'utf8'),'authentic');assert.deepEqual(await readdir(path.join(root,'tmp')),[]);
});

test('late related-database failure restores replaced bytes and rolls back catalog changes',async t=>{
 const a=await fixture(t),b=await fixture(t),asset=await a.store.put(stream('original'),meta);
 await b.store.put(stream('original'),meta);await writeFile(b.store.file(asset.id),'corrupt!');b.store.saveSettings({theme:'before'});
 await a.store.put(stream('new source'),{...meta,name:'New.txt'});a.store.saveSettings({theme:'after'});const backup=await a.store.exportBackup({includeBytes:true});
 await assert.rejects(b.store.importBackup(backup,{restoreRelated:db=>{db.exec('CREATE TABLE restore_mesh.probe(id TEXT); INSERT INTO restore_mesh.probe VALUES(\'in transaction\')');throw Error('injected mesh failure');}}),/injected mesh failure/);
 assert.equal(b.store.list().length,1);assert.deepEqual(b.store.getSettings(),{theme:'before'});assert.equal(await readFile(b.store.file(asset.id),'utf8'),'corrupt!');assert.deepEqual(await readdir(path.join(b.root,'objects')),[asset.id]);assert.deepEqual(await readdir(path.join(b.root,'tmp')),[]);
 await b.store.importBackup(backup);assert.equal(b.store.list().length,2);assert.equal((await b.store.verify(asset.id)).ok,true);
});

test('invalid base64 is rejected before changing catalog or managed bytes',async t=>{
 const {store}=await fixture(t),asset=await store.put(stream('original'),meta),backup=await store.exportBackup({includeBytes:true});
 backup.objects[0].bytes='YQ=';await assert.rejects(store.importBackup(backup),/Invalid backup bytes/);assert.equal((await store.verify(asset.id)).ok,true);
});

test('atomic reading-state patches preserve independent fields while saveState still replaces',async t=>{
 const {store}=await fixture(t),asset=await store.put(stream('original'),meta);store.saveState(asset.id,{page:1});
 await Promise.all([Promise.resolve().then(()=>store.patchState(asset.id,{note:'Keep this note'})),Promise.resolve().then(()=>store.patchState(asset.id,{time:42}))]);
 assert.deepEqual(store.readState(asset.id),{page:1,note:'Keep this note',time:42});assert.throws(()=>store.patchState(asset.id,[]),/object/);assert.throws(()=>store.patchState(asset.id,{time:-1}),/nonnegative/);
 store.saveState(asset.id,{page:2});assert.deepEqual(store.readState(asset.id),{page:2});
});
