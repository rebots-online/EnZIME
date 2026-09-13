import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile,readFile,utimes} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {Readable} from 'node:stream';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../server.mjs';
import {openStore,BACKUP_LIMIT,BACKUP_REQUEST_LIMIT} from '../storage.mjs';
import {generateUncompressedZim} from '../dyndon-zim.mjs';

const staging=fileURLToPath(new URL('../../.staging/review-tests',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const stream=bytes=>Readable.from([Buffer.from(bytes)]);
const meta={name:'Water.txt',kind:'final',mime:'text/plain'};
async function directory(t){await mkdir(staging,{recursive:true});const root=await mkdtemp(path.join(staging,'backend-review-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
async function fixture(t,options={}){
 const root=await directory(t),a=await createApp({root,runtimeOptions:{binary:''},...options});
 await new Promise(resolve=>a.server.listen(0,'127.0.0.1',resolve));t.after(()=>a.close());
 const base=`http://127.0.0.1:${a.server.address().port}`;
 async function json(route,body,status=body===undefined?200:201){const res=await fetch(base+route,body===undefined?{}:{method:'POST',headers:{'X-MBA-Client':'enzime','Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json();assert.equal(res.status,status,JSON.stringify(data));return data;}
 async function upload(bytes,kind='final',name='Water.txt'){const res=await fetch(`${base}/api/assets?kind=${kind}&name=${encodeURIComponent(name)}`,{method:'POST',headers:{'X-MBA-Client':'enzime'},body:bytes});const data=await res.json();assert.equal(res.status,201,JSON.stringify(data));return data;}
 return {...a,root,base,json,upload};
}
async function upstream(t,handler){const server=http.createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});return `http://127.0.0.1:${server.address().port}`;}
const download=(url,bytes=Buffer.from('model bytes'))=>({units:[{id:'model',kind:'model',size:bytes.length,sha256:hash(bytes),url,essential:true}]});
const budget={desiredBytes:1024**2,reserveBytes:0};

test('HTTP restore rolls catalog, mesh and replaced bytes back when mesh writes fail',async t=>{
 const source=await fixture(t),target=await fixture(t),asset=await source.upload('Water original records');
 await source.upload('Another distinct document');await source.json('/api/annotations',{assetId:asset.id,locator:{key:''},text:'A durable note'});
 source.store.saveSettings({theme:'source'});const backup=await source.json('/api/backup?bytes=true');
 await target.store.put(stream('Water original records'),meta);target.store.saveSettings({theme:'target'});await writeFile(target.store.file(asset.id),'broken old payload');
 let db=new DatabaseSync(path.join(target.root,'knowledge.sqlite'));db.exec("CREATE TRIGGER reject_restore BEFORE INSERT ON mesh_notes BEGIN SELECT RAISE(ABORT, 'injected mesh write failure'); END");db.close();
 const failed=await target.json('/api/backup',backup,400);assert.match(failed.error,/injected mesh write failure/);
 assert.equal(target.store.list().length,1);assert.equal(target.knowledge.stats().sources,0);assert.equal(target.knowledge.stats().layers,0);assert.equal(target.store.getSettings().theme,'target');assert.equal(await readFile(target.store.file(asset.id),'utf8'),'broken old payload');
 db=new DatabaseSync(path.join(target.root,'knowledge.sqlite'));db.exec('DROP TRIGGER reject_restore');db.close();
 await target.json('/api/backup',backup);assert.equal((await target.store.verify(asset.id)).ok,true);assert.equal(target.knowledge.listNotes().length,1);assert.equal(target.store.list().length,2);
});

test('HTTP embedded backup round-trips the full 64 MiB payload allowance after base64 expansion',async t=>{
 const a=await fixture(t),b=await fixture(t),asset=await a.store.put(stream(Buffer.alloc(BACKUP_LIMIT,97)),{name:'Model.gguf',kind:'model',mime:'application/octet-stream'});
 const backup=await a.json('/api/backup?bytes=true');assert.ok(Buffer.byteLength(JSON.stringify(backup))>64*1024**2);assert.ok(Buffer.byteLength(JSON.stringify(backup))<BACKUP_REQUEST_LIMIT);
 const result=await b.json('/api/backup',backup);assert.equal(result.importedBytes,BACKUP_LIMIT);assert.equal((await b.store.verify(asset.id)).ok,true);
});

test('the selected media kind opens correctly while old text citations retain their edition',async t=>{
 const a=await fixture(t),bytes='<p>Water records</p>',first=await a.upload(bytes),old=await a.json(`/api/assets/${first.id}/read`),second=await a.upload(bytes,'html','Water.html');
 assert.equal(second.id,first.id);assert.equal(second.kind,'html');const current=await a.json(`/api/assets/${first.id}/read`);assert.equal(current.html,bytes);assert.equal(current.text,'Water records');assert.notEqual(current.source.id,old.source.id);
 assert.equal((await a.json(`/api/sources/${old.source.id}/read`)).text,bytes);assert.equal((await a.json('/api/assets'))[0].kind,'html');
});

test('discovery reports archives excluded by its eight-archive bound',async t=>{
 const a=await fixture(t);for(let i=0;i<9;i++)await a.store.put(stream(generateUncompressedZim([{key:'C/Article',title:`Archive ${i}`,text:`Unique ${i}`} ])),{name:`Archive ${i}.zim`,kind:'zim',mime:'application/octet-stream'});
 const result=await a.retrieve('absent');assert.equal(result.status.discovery.archives.length,8);assert.equal(result.status.discovery.totalArchives,9);assert.equal(result.status.discovery.omittedArchives,1);assert.equal(result.status.partial,true);
});

test('retrieval abort during archive discovery stops before later archives or projection',async t=>{
 const a=await fixture(t);for(let i=0;i<2;i++)await a.store.put(stream(generateUncompressedZim([{key:'C/Water',text:`Water ${i}`} ])),{name:`Archive ${i}.zim`,kind:'zim'});
 const controller=new AbortController(),reason=new DOMException('Stop discovery','AbortError'),file=a.store.file.bind(a.store);let calls=0,searches=0;
 t.mock.method(a.store,'file',id=>{calls++;const result=file(id);controller.abort(reason);return result;});t.mock.method(a.knowledge,'search',()=>{searches++;throw Error('Search must not run');});
 await assert.rejects(a.retrieve('water',{signal:controller.signal}),e=>e===reason);assert.equal(calls,1);assert.equal(searches,0);
});

test('knowledge projection cancellation stops additional candidate work and is propagated',async t=>{
 const a=await fixture(t),controller=new AbortController();for(let i=0;i<10;i++)a.knowledge.putSource({id:`source-${i}`,assetId:`asset-${i}`,edition:'1',key:`water-${i}`,title:'Water'});
 let reads=0;await assert.rejects(a.knowledge.search('water',{signal:controller.signal,resolveBody:async()=>{reads++;controller.abort(new DOMException('Stop projection','AbortError'));return 'Water';}}),{name:'AbortError'});assert.equal(reads,1);
});

test('one missing source does not suppress query embeddings for available evidence',async t=>{
 const calls=[],a=await fixture(t,{chatbotOptions:{fetchImpl:async(url,options)=>{assert.match(url,/embeddings$/);const body=JSON.parse(options.body);calls.push(...body.input);return Response.json({data:body.input.map((_,index)=>({index,embedding:[1,0]}))});}}});
 await a.upload('Water observations are available');a.store.saveSettings({embeddingModel:'fixture-embed'});
 a.knowledge.putSource({id:'missing',assetId:'f'.repeat(64),edition:'1',key:'missing',title:'Unavailable',contentHash:hash('gone'),precedence:100});
 const result=await a.retrieve('water');assert.ok(calls.includes('water'));assert.equal(result.status.mode,'lexical+graph+vector');assert.ok(result.errors.some(e=>e.sourceId==='missing'&&e.stage==='embedding'));assert.equal(result.status.partial,true);
});

test('cached mounted archives reject external modification for article and resource reads',async t=>{
 const a=await fixture(t),file=path.join(a.root,'external.zim'),bytes=generateUncompressedZim([{key:'C/Water',text:'Water records'}]);await writeFile(file,bytes);
 const asset=await a.store.mount(file,{name:'External.zim',kind:'zim'});await a.json(`/api/assets/${asset.id}/read`);
 await writeFile(file,bytes);await utimes(file,new Date(),new Date(Date.now()+2000));
 assert.match((await a.json(`/api/assets/${asset.id}/read`,undefined,400)).error,/Mounted source changed/);assert.match((await a.json(`/api/resources/${asset.id}/C/Water`,undefined,400)).error,/Mounted source changed/);
});

test('case-insensitive text MIME and absent main page select a readable article',async t=>{
 const a=await fixture(t),bytes=generateUncompressedZim([{key:'C/Asset',mime:'application/octet-stream',bytes:Buffer.from([1,2])},{key:'C/Water',mime:'Text/HTML',html:'<p>Water case variant</p>'}]);bytes.writeUInt32LE(0xffffffff,64);const checksum=Number(bytes.readBigUInt64LE(72));createHash('md5').update(bytes.subarray(0,checksum)).digest().copy(bytes,checksum);
 const asset=await a.upload(bytes,'zim','No-main.zim'),read=await a.json(`/api/assets/${asset.id}/read`);assert.equal(read.key,'C/Water');assert.equal(read.text,'Water case variant');assert.ok((await a.retrieve('water')).results.some(r=>r.citation.assetId===asset.id));
 const empty=generateUncompressedZim([{key:'C/Asset',mime:'application/octet-stream',bytes:Buffer.from([1,2])}]);empty.writeUInt32LE(0xffffffff,64);const at=Number(empty.readBigUInt64LE(72));createHash('md5').update(empty.subarray(0,at)).digest().copy(empty,at);const other=await a.upload(empty,'zim','Resources only.zim');assert.match((await a.json(`/api/assets/${other.id}/read`,undefined,400)).error,/no readable text entries/i);
});

test('download origins are exact, reject credentials and ignore browser-supplied allowlists',async t=>{
 const a=await fixture(t);for(const url of ['http://127.0.0.1:12345/model','http://192.168.0.214/model','http://169.254.169.254/latest','https://download.kiwix.org.evil.example/model','https://download.kiwix.org:444/model','https://user:pass@download.kiwix.org/model']){
  const result=await a.json('/api/dyndon/download',{manifest:download(url),allowDownloadUrl:true,options:{...budget,allowedOrigins:[new URL(url).origin],installedIds:['model']}},400);assert.match(result.error,/not allowed/);
 }
 assert.match((await a.json('/api/dyndon/download',{manifest:download('http://127.0.0.1:12345/model'),options:budget},400)).error,/ENZIME_DOWNLOAD_ORIGINS/);
 const official=await a.transfers.createDownloadJob(download('https://download.kiwix.org/model'),{capacityBytes:1024**2,...budget});await a.transfers.releaseJob(official.id);
 assert.equal((await a.json('/api/config')).downloads.configurationVariable,'ENZIME_DOWNLOAD_ORIGINS');
});

test('operator allowDownloadUrl injection permits local fixtures but revalidates redirects',async t=>{
 let forbiddenRequests=0;const blocked=await upstream(t,(_req,res)=>{forbiddenRequests++;res.end('secret');}),allowed=await upstream(t,(_req,res)=>res.writeHead(302,{Location:blocked+'/private'}).end());
 const a=await fixture(t,{allowDownloadUrl:url=>url.origin===allowed}),job=await a.transfers.createDownloadJob(download(allowed+'/model'),{capacityBytes:1024**2,...budget});
 await assert.rejects(a.transfers.runDownload(job.id),/not allowed/);assert.equal(forbiddenRequests,0);await a.json('/api/dyndon/release',{id:job.id},200);
});

test('ENZIME_DOWNLOAD_ORIGINS replaces defaults with operator-specified exact origins',async t=>{
 const saved=process.env.ENZIME_DOWNLOAD_ORIGINS;process.env.ENZIME_DOWNLOAD_ORIGINS='https://trusted.example:8443';let a;try{a=await fixture(t);}finally{if(saved===undefined)delete process.env.ENZIME_DOWNLOAD_ORIGINS;else process.env.ENZIME_DOWNLOAD_ORIGINS=saved;}
 assert.deepEqual((await a.json('/api/config')).downloads.allowedOrigins,['https://trusted.example:8443']);
 await assert.rejects(a.transfers.createDownloadJob(download('https://download.kiwix.org/model'),{capacityBytes:1024**2,...budget}),/ENZIME_DOWNLOAD_ORIGINS/);
 const job=await a.transfers.createDownloadJob(download('https://trusted.example:8443/model'),{capacityBytes:1024**2,...budget});await a.transfers.releaseJob(job.id);
});

test('installed unit IDs are derived from hash-verified catalog objects, including corruption',async t=>{
 const a=await fixture(t),live=Buffer.from('installed model'),absent=Buffer.from('absent model'),asset=await a.store.put(stream(live),{name:'Model',kind:'model'});
 const manifest={units:[{id:'installed',size:live.length,sha256:hash(live),essential:true},{id:'absent',size:absent.length,sha256:hash(absent),essential:true}]};
 const options={...budget,installedIds:['absent']},plan=await a.json('/api/dyndon/plan',{manifest,options},200);assert.equal(plan.selected.find(u=>u.id==='installed').installed,true);assert.equal(plan.selected.find(u=>u.id==='absent').installed,false);assert.equal(plan.budget.newBytes,absent.length);
 await writeFile(a.store.file(asset.id),'corrupted model');const damaged=await a.json('/api/dyndon/plan',{manifest,options},200);assert.ok(damaged.selected.every(u=>!u.installed));assert.equal(damaged.budget.newBytes,live.length+absent.length);
});

test('release frees failed reservations and preserves outputs already mounted by the library',async t=>{
 const a=await fixture(t),generated=await a.json('/api/dyndon/generate',{records:[{key:'C/Water',text:'Water output',essential:true}],options:budget});
 const released=await a.json(`/api/dyndon/jobs/${generated.id}/release`,{},200);assert.equal(released.status,'released');assert.equal((await a.store.verify(generated.assets[0].id)).ok,true);assert.equal((await a.json(`/api/assets/${generated.assets[0].id}/read`)).text,'Water output');
 const job=await a.transfers.createGenerationJob({units:[{id:'failed',size:512,essential:true}]},{capacityBytes:1024**2,...budget});
 async function* broken(){throw Error('encoder failed');}await assert.rejects(a.transfers.runGeneration(job.id,broken()),/encoder failed/);
 assert.equal((await a.json(`/api/dyndon/jobs/${job.id}/release`,{},200)).status,'cancelled');const next=await a.json('/api/dyndon/plan',{manifest:{units:[{id:'next',size:1}]},options:budget},200);assert.equal(next.budget.reservedBytes,0);
});

test('chat terminal event returns the saved ID and continued turns update that conversation',async t=>{
 const a=await fixture(t,{chatbotOptions:{fetchImpl:async url=>url.endsWith('/models')?Response.json({data:[{id:'fixture'}]}):new Response('data: {"choices":[{"delta":{"content":"Water answer [S1]"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}})}});await a.upload('Water evidence is available');
 const chatId=randomUUID();let history=[];for(let turn=0;turn<2;turn++){const response=await fetch(a.base+'/api/chat',{method:'POST',headers:{'X-MBA-Client':'enzime','Content-Type':'application/json'},body:JSON.stringify({message:'Water?',chatId,messages:history})});assert.equal(response.status,200);const events=(await response.text()).trim().split('\n').map(JSON.parse);assert.equal(events.at(-1).type,'done');assert.equal(events.at(-1).chatId,chatId);assert.equal(events.filter(e=>e.type==='done').length,1);history=a.store.getChat(chatId).messages;}
 assert.equal(a.store.listChats().length,1);assert.equal(history.length,4);
});

test('shutdown drains active storage and still releases its writer after a synchronous mesh close failure',async t=>{
 const root=await directory(t),a=await createApp({root,runtimeOptions:{binary:''}});let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
 async function* pending(){started();await gate;yield Buffer.from('pending upload');}const writing=a.store.put(pending(),meta);await ready;
 const closeMesh=a.knowledge.close.bind(a.knowledge);a.knowledge.close=()=>{closeMesh();throw Error('mesh close failed');};
 const closing=a.close(),outcome=assert.rejects(closing,error=>error instanceof AggregateError&&error.errors.some(e=>e.message==='mesh close failed'));release();await writing;await outcome;
 const reopened=await openStore(root);try{assert.equal(reopened.list().length,1);assert.equal((await reopened.verify(hash('pending upload'))).ok,true);}finally{reopened.close();}
});

test('concurrent HTTP state patches keep note and media time without a client read/merge round trip',async t=>{
 const a=await fixture(t),asset=await a.upload('Water audio metadata');await a.json(`/api/state/${asset.id}`,{page:3},200);
 await Promise.all([a.json(`/api/state/${asset.id}`,{note:'Independent note'},200),a.json(`/api/state/${asset.id}`,{time:73.5},200)]);
 assert.deepEqual(await a.json(`/api/state/${asset.id}`),{page:3,note:'Independent note',time:73.5});await a.json(`/api/state/${asset.id}`,[],400);await a.json(`/api/state/${asset.id}`,{time:-3},400);
});

test('archive resource HEAD returns GET metadata with an empty body',async t=>{
 const a=await fixture(t),bytes=Buffer.from([0,1,255,3]),asset=await a.upload(generateUncompressedZim([{key:'C/Water',text:'Water'},{key:'C/image.bin',mime:'application/octet-stream',bytes}]),'zim','Resources.zim');
 const route=a.base+`/api/resources/${asset.id}/C/image.bin`,head=await fetch(route,{method:'HEAD'}),get=await fetch(route);
 assert.equal(head.status,200);for(const key of ['content-type','content-length','content-security-policy'])assert.equal(head.headers.get(key),get.headers.get(key));assert.equal(await head.text(),'');assert.deepEqual(Buffer.from(await get.arrayBuffer()),bytes);
});
