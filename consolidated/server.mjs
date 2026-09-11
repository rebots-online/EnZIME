import http from 'node:http';
import {readFile,stat,statfs,mkdtemp,rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {openStore} from './storage.mjs';
import {openZim} from './zim.mjs';
import {openKnowledge,hashText} from './knowledge.mjs';
import {createDocuments,htmlText,articleLinks} from './documents.mjs';
import {createChatbot} from './chatbot/index.mjs';
import {createRuntimeService} from './runtime-service.mjs';
import {createDynDon} from './dyndon.mjs';
import {purchaseLink} from './billing.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const hash=s=>createHash('sha256').update(s).digest('hex');
const sid=(id,key='')=>hash(`${id}\0${key}`);
const mime={pdf:'application/pdf',epub:'application/epub+zip',audio:'audio/mpeg',video:'video/mp4',final:'text/plain; charset=utf-8',html:'text/html',zim:'application/octet-stream',model:'application/octet-stream'};
export async function createApp({root,checkout=null,chatbotOptions={},runtimeOptions={}}={}){
 const store=await openStore(root||process.env.MBA_ROBIN_HOME||path.join(process.env.XDG_DATA_HOME||process.env.LOCALAPPDATA||path.join(os.homedir(),'.local','share'),'mba.robin'));
 const knowledge=await openKnowledge(store.root,{projectionBytes:8*1024**2,vectorBytes:4*1024**2});
 const documents=createDocuments(),archives=new Map(),embedded=new Set(),adopting=new Map(),runningTransfers=new Map();
 const transfers=await createDynDon({root:store.root,allowUrl:url=>['http:','https:'].includes(url.protocol)});
 let managedEndpoint=null,managedModel=null,managedApiKey=null,closing=false;
 const makeBot=(settings=store.getSettings())=>createChatbot({endpoint:process.env.ENZIME_LLM_ENDPOINT||settings.endpoint||'http://127.0.0.1:8080/v1',allowRemote:settings.allowRemote===true,modelReferences:()=>store.listModelReferences(),...chatbotOptions,...(managedEndpoint?{endpoint:managedEndpoint,apiKey:managedApiKey}:{})});
 let bot=makeBot(),archiveQueue=Promise.resolve(),documentQueue=Promise.resolve();
 const runtimeService=createRuntimeService({store,...runtimeOptions,onEndpoint:(endpoint,active)=>{managedEndpoint=endpoint;managedModel=active?.modelId||null;managedApiKey=active?.apiKey||null;if(!closing){bot=makeBot();embedded.clear();}}});
 // Eviction is performed only between complete operations; simultaneous requests
 // cannot close a PDF or ZIM reader while another request still uses it.
 const withArchive=(id,operation)=>{const work=archiveQueue.then(async()=>operation(await archive(id)));archiveQueue=work.catch(()=>{});return work;};
 const withDocuments=operation=>{const work=documentQueue.then(operation);documentQueue=work.catch(()=>{});return work;};
 async function archive(id){const item=store.get(id);if(!item||item.kind!=='zim')throw Error('Unknown ZIM.');const file=store.file(id);if(archives.has(id)){const z=archives.get(id);archives.delete(id);archives.set(id,z);return z;}const z=await openZim(file);archives.set(id,z);if(archives.size>3){const k=archives.keys().next().value;await archives.get(k).close();archives.delete(k);}return z;}
 async function bodyFor(s){
  const item=store.get(s.assetId);if(!item)throw Error('Original source is not installed.');
  if(s.kind==='zim')return withArchive(item.id,async z=>{const entry=await z.read(s.key),text=entry.bytes.toString('utf8');return /(?:html|xhtml)/i.test(entry.mime)?htmlText(text):text;});
  if(s.kind==='pdf')return withDocuments(async()=>(await documents.pdfPage(store.file(item.id),s.locator.page)).text);
  if(s.kind==='epub')return withDocuments(async()=>htmlText((await documents.epubRead(store.file(item.id),s.key)).bytes.toString('utf8')));
  if(s.kind==='note')return knowledge.listNotes({sourceId:s.id})[0]?.text??store.listAnnotations().find(n=>n.id===s.locator.noteId)?.text??'';
  if(!['final','html','document','clip'].includes(item.kind))throw Error('This file kind is not a text source.');
  if(item.size>16*1024**2)throw Error('Text retrieval is limited to 16 MiB per work.');
  const text=await readFile(store.file(item.id),'utf8');return item.kind==='html'||item.mime==='text/html'?htmlText(text):text;
 }
 async function remember(item,{key='',title=item.name,text,kind=item.kind,locator={},links=[],...extra}={}){
  const source={id:sid(item.id,key),assetId:item.id,edition:item.id,key:key||'document',title,kind,locator:{assetId:item.id,key,...locator},contentHash:hashText(text),links:links.map(k=>({sourceId:sid(item.id,k)})),...extra};
  knowledge.putSource(source);return knowledge.getSource(source.id);
 }
 async function readSource(item,key='',page=1){
  if(item.kind==='zim'){
   const r=await withArchive(item.id,z=>z.read(key||z.metadata().mainPage));if(!/html|text\//.test(r.mime))throw Error('This entry is a resource. Open it from its article.');
   const raw=r.bytes.toString('utf8'),isHtml=/(?:html|xhtml)/i.test(r.mime),text=isHtml?htmlText(raw):raw,source=await remember(item,{key:r.key,title:r.title,text,links:isHtml?articleLinks(raw,r.key):[]});
   return{source,...(isHtml?{html:raw}:{}),text,key:r.key,resourceBase:`/api/resources/${item.id}/`};
  }
  if(item.kind==='pdf'){const r=await withDocuments(()=>documents.pdfPage(store.file(item.id),page));return{source:await remember(item,{key:`page:${page}`,title:`${item.name} · p. ${page}`,text:r.text,locator:{page}}),...r};}
  if(item.kind==='epub'){return withDocuments(async()=>{const info=await documents.epubInfo(store.file(item.id));key=key||info.chapters[0]?.key;if(!key)throw Error('EPUB has no chapters.');const r=await documents.epubRead(store.file(item.id),key),html=r.bytes.toString('utf8'),text=htmlText(html);return{source:await remember(item,{key,title:`${item.name} · ${info.chapters.find(c=>c.key===key)?.title||key}`,text}),html,text,key,chapters:info.chapters,resourceBase:`/api/resources/${item.id}/`};});}
  const text=await bodyFor({assetId:item.id,kind:item.kind});
  const existing=knowledge.listSources({active:false,assetId:item.id}).filter(s=>s.kind===item.kind).find(s=>!key||s.key===key);
  return{source:existing||await remember(item,{text}),text,...(item.kind==='html'||item.mime==='text/html'?{html:await readFile(store.file(item.id),'utf8')}: {})};
 }
 async function retrieve(query,options={}){
  const errors=[],discovery=[];
  if(!query.trim())throw Error('Enter a search query.');
  const ignored=new Set(['what','where','which','does','could','would','should','about','please','using','explain','these','there','their','from','with','this','that','when','into','have']);
  const terms=[query.slice(0,1024),...[...new Set(query.toLowerCase().match(/[\p{L}\p{N}_-]{4,}/gu)||[])].filter(w=>!ignored.has(w)).slice(0,3)];
  for(const item of store.list().filter(a=>a.kind==='zim'&&a.storage!=='missing').slice(0,8)){
   try{options.signal?.throwIfAborted();const hits=new Map();let complete=true;for(const term of [...new Set(terms)]){if(hits.size>=8)break;const page=await withArchive(item.id,z=>z.list({query:term,limit:8-hits.size}));complete&&=page.complete;for(const hit of page)hits.set(hit.key,hit);}discovery.push({assetId:item.id,title:item.name,matchedTitles:hits.size,complete});for(const hit of hits.values())if(/html|text\//.test(hit.mime))await readSource(item,hit.key);}catch(e){errors.push({assetId:item.id,error:e.message});}
  }
  const registeredAssets=new Set(knowledge.listSources({active:false,includeTombstones:true}).map(s=>s.assetId));
  for(const item of store.list().filter(a=>['final','html'].includes(a.kind)&&a.storage!=='missing').slice(0,40))if(!registeredAssets.has(item.id))await readSource(item).catch(e=>errors.push({assetId:item.id,error:e.message}));
  const settings=store.getSettings();let queryVector,embeddingError;
  if(settings.embeddingModel){try{
   for(const s of knowledge.listSources({active:true}).slice(0,32)){const cacheKey=`${s.id}:${settings.embeddingModel}:${s.contentHash}`;if(embedded.has(cacheKey))continue;options.signal?.throwIfAborted();const text=await bodyFor(s);if(!text.trim()||text.length>200000)continue;const e=await bot.embed({input:text,model:settings.embeddingModel,signal:options.signal});const saved=knowledge.setEmbedding(s.id,e.vectors[0],{model:settings.embeddingModel,contentHash:s.contentHash});if(saved.stored)embedded.add(cacheKey);}
   const e=await bot.embed({input:query,model:settings.embeddingModel,signal:options.signal});queryVector=e.vectors[0];
  }catch(e){embeddingError=e.message;}}
  const r=await knowledge.search(query,{resolveBody:bodyFor,limit:options.limit||8,queryVector,embeddingModel:settings.embeddingModel,seedIds:options.seedIds});
  r.status.partial ||= errors.length>0||discovery.some(d=>!d.complete);
  r.status.discovery={archives:discovery,scope:'Opened document pages, registered sources and bounded ZIM title discovery; unopened PDF/EPUB pages are not a full-text index.'};
  return{...r,errors,...(embeddingError?{embeddingError}:{})};
 }
 async function budgets(options={}){const s=store.stats(),disk=await statfs(store.root),availableCapacity=s.managedBytes+disk.bavail*disk.bsize;return{...options,capacityBytes:Math.min(Number(options.capacityBytes??availableCapacity),availableCapacity),installedBytes:s.managedBytes,modelBytes:0,cacheBytes:0,reserveBytes:Number(options.reserveBytes??64*1024**2),liveDiskFree:true};}
 async function adopt(job){
  if(job.status!=='complete')return job;if(adopting.has(job.id))return adopting.get(job.id);
  const work=(async()=>{const assets=[];for(const out of job.outputs||[]){const kind=out.kind==='pack'?'zim':out.kind||'zim';if(!mime[kind])throw Error(`Cannot adopt unsupported output kind: ${kind}`);const existing=store.get(out.sha256);if((!existing||existing.storage==='missing')&&kind==='zim'){const z=await openZim(out.path);try{await z.verify();}finally{await z.close();}}const item=existing&&existing.storage!=='missing'?existing:await store.mount(out.path,{name:(out.title||path.basename(out.path)).slice(0,240),kind,mime:mime[kind]});if(kind==='model'&&!store.listModelReferences().some(r=>r.assetId===item.id))store.saveModelReference({name:item.name,assetId:item.id});assets.push(item);}return{...job,assets,adoptionStatus:'installed'};})();
  adopting.set(job.id,work);try{return await work;}finally{adopting.delete(job.id);}
 }
 function startTransfer(id){if(runningTransfers.has(id))return;const work=transfers.runDownload(id).then(adopt).catch(()=>{}).finally(()=>runningTransfers.delete(id));runningTransfers.set(id,work);}
 async function jobs(){return Promise.all((await transfers.listJobs()).map(async job=>{try{return await adopt(job);}catch(error){return{...job,adoptionStatus:'failed',adoptionError:error.message};}}));}
 function meshSnapshot(){
  // Versioned metadata sidecar: include historical layers and assertions, omit
  // disposable body/vector caches. Reading only graph() would lose old edges.
  const db=new DatabaseSync(path.join(store.root,'knowledge.sqlite'),{readOnly:true});
  try{db.exec('BEGIN');const result={version:1,layers:db.prepare('SELECT * FROM mesh_layers ORDER BY sequence').all(),sources:db.prepare('SELECT * FROM mesh_sources').all(),edges:db.prepare('SELECT * FROM mesh_edges').all(),notes:db.prepare('SELECT * FROM mesh_notes').all()};db.exec('COMMIT');return result;}finally{db.close();}
 }
 async function validateMesh(mesh,manifest){
  if(!mesh)return null;
  if(mesh.version!==1||['layers','sources','edges','notes'].some(k=>!Array.isArray(mesh[k])||mesh[k].length>100000))throw Error('Invalid knowledge mesh backup.');
  const assets=new Set([...store.list().map(a=>a.id),...(manifest.objects||[]).map(a=>a.id)]),temporary=await mkdtemp(path.join(store.root,'tmp','mesh-import-'));
  const staging=await openKnowledge(temporary,{projectionBytes:0,vectorBytes:0});
  try{
   for(const row of mesh.layers){if(![0,1].includes(row.enabled)||!Number.isSafeInteger(row.sequence)||row.sequence<1)throw Error('Invalid mesh layer ordering.');const value={id:row.id,corpusId:row.corpus_id,precedence:row.precedence,enabled:!!row.enabled},existing=knowledge.getLayer(row.id);if(existing&&(existing.corpusId!==value.corpusId||existing.precedence!==value.precedence))throw Error('Conflicting immutable mesh layer.');staging.registerLayer(value);}
   const existingKeys=new Map(knowledge.listSources({active:false,includeTombstones:true}).map(s=>[JSON.stringify([s.layerId,s.key]),s.id])),includedLayers=new Set(mesh.layers.map(r=>r.id));
   for(const row of mesh.sources){const value=JSON.parse(row.metadata);if(!includedLayers.has(value.layerId)||!assets.has(value.assetId)||value.id!==row.id||value.layerId!==row.layer_id||value.corpusId!==row.corpus_id||value.key!==row.article_key||Number(value.tombstone)!==row.tombstone)throw Error('Invalid mesh source reference.');const existing=knowledge.getSource(value.id),sameKey=existingKeys.get(JSON.stringify([value.layerId,value.key]));if((existing&&JSON.stringify(existing)!==JSON.stringify(value))||(sameKey&&sameKey!==value.id))throw Error('Conflicting immutable mesh source.');if(JSON.stringify(staging.putSource(value))!==row.metadata)throw Error('Mesh source metadata is not canonical.');}
   for(const row of mesh.edges){const result=staging.addEdge(row.source_id,row.target_id,{relation:row.relation,kind:row.kind});if(result.id!==row.id||typeof row.created!=='string')throw Error('Invalid mesh assertion identity.');}
   const existingNotes=new Map(knowledge.listNotes().map(n=>[n.id,n]));
   for(const row of mesh.notes){const existing=existingNotes.get(row.id),source=staging.getSource(row.source_id),anchor=JSON.parse(row.anchor);if(existing&&existing.sourceId!==row.source_id)throw Error('Conflicting note source identity.');if(source?.kind==='note'&&(hashText(row.text)!==source.contentHash||(existing&&(existing.text!==row.text||JSON.stringify(existing.anchor)!==JSON.stringify(anchor)))))throw Error('Conflicting immutable note snapshot.');staging.saveNote({id:row.id,sourceId:row.source_id,text:row.text,anchor});if(typeof row.created!=='string'||typeof row.updated!=='string')throw Error('Invalid note timestamps.');}
   return mesh;
  }finally{staging.close();await rm(temporary,{recursive:true,force:true});}
 }
 function restoreMesh(mesh){
  if(!mesh)return;
  const db=new DatabaseSync(path.join(store.root,'knowledge.sqlite'));
  try{db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');let sequence=db.prepare('SELECT COALESCE(MAX(sequence),0) AS n FROM mesh_layers').get().n;
   for(const r of [...mesh.layers].sort((a,b)=>a.sequence-b.sequence)){const existing=db.prepare('SELECT 1 FROM mesh_layers WHERE id=?').get(r.id);if(!existing)db.prepare('INSERT INTO mesh_layers VALUES(?,?,?,?,?)').run(r.id,r.corpus_id,r.precedence,r.enabled,++sequence);else db.prepare('UPDATE mesh_layers SET enabled=? WHERE id=?').run(r.enabled,r.id);}
   for(const r of mesh.sources)db.prepare('INSERT OR IGNORE INTO mesh_sources VALUES(?,?,?,?,?,?)').run(r.id,r.corpus_id,r.layer_id,r.article_key,r.metadata,r.tombstone);
   for(const r of mesh.edges)db.prepare('INSERT OR IGNORE INTO mesh_edges VALUES(?,?,?,?,?,?)').run(r.id,r.source_id,r.target_id,r.relation,r.kind,r.created);
   for(const r of mesh.notes)db.prepare('INSERT OR REPLACE INTO mesh_notes VALUES(?,?,?,?,?,?)').run(r.id,r.source_id,r.text,r.anchor,r.created,r.updated);
   db.exec('COMMIT');
  }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}finally{db.close();}
 }
 const server=http.createServer(async(req,res)=>{
  const json=(status,data)=>{if(res.headersSent)return;res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  const input=async(max=1024**2)=>{let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>max)throw Error('Request exceeds the allowed size.');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
  const host=req.headers.host;if(!/^127\.0\.0\.1:\d+$/.test(host||''))return json(403,{error:'Local broker requires 127.0.0.1'});
  const url=new URL(req.url,`http://${host}`),p=url.pathname;
  if(req.headers.origin&&req.headers.origin!==`http://${host}`)return json(403,{error:'Cross-origin access denied'});
  if(req.headers['sec-fetch-site']==='cross-site')return json(403,{error:'Cross-site access denied'});
  if(!['GET','HEAD'].includes(req.method)&&req.headers['x-mba-client']!=='enzime')return json(403,{error:'Missing application header'});
  try{
   if(await runtimeService.handle({req,res,url,input,json}))return;
   if(p==='/api/config'&&req.method==='GET')return json(200,{storage:'mba.robin',checkoutReady:!!checkout,checkoutPath:checkout?'/checkout':null,release:'local-beta',capabilities:{pdf:true,epub:true,finalText:true,media:true,zimReader:true,modelRuntime:'managed-or-local-connector',liveEntitlements:false},settings:store.getSettings(),chatbot:bot.capabilities(),runtime:runtimeService.status()});
   if(p==='/checkout'){if(!checkout)return json(503,{error:'Checkout is not configured. No payment has been taken.'});res.writeHead(303,{Location:checkout});return res.end();}
   if(p==='/api/assets'&&req.method==='GET')return json(200,store.list());
   if(p==='/api/assets'&&req.method==='POST'){const kind=url.searchParams.get('kind');if(!mime[kind])throw Error('Unsupported file kind.');const item=await store.put(req,{name:url.searchParams.get('name'),kind,mime:mime[kind]});if(['final','html'].includes(kind))await readSource(item).catch(()=>{});return json(201,item);}
   if(p==='/api/mount'&&req.method==='POST'){const x=await input();if(!mime[x.kind])throw Error('Unsupported file kind.');return json(201,await store.mount(x.path,{name:x.name||path.basename(x.path),kind:x.kind,mime:mime[x.kind]}));}
   if(p==='/api/stats'){const disk=await statfs(store.root);return json(200,{storage:store.stats(),knowledge:knowledge.stats(),freeBytes:disk.bavail*disk.bsize});}
   if(p==='/api/settings'&&req.method==='POST'){const x=await input(),replacement=makeBot({...store.getSettings(),...x});store.saveSettings(x);bot=replacement;embedded.clear();return json(200,store.getSettings());}
   if(p==='/api/models')return json(200,await bot.probe({}));
   if(p==='/api/search'&&req.method==='POST'){const x=await input();return json(200,await retrieve(String(x.query||'').slice(0,2000),x));}
   if(p==='/api/graph')return json(200,{...knowledge.graph({limit:300}),stats:knowledge.stats()});
   if(p==='/api/graph/edge'&&req.method==='POST'){const x=await input();return json(201,knowledge.addEdge(x.from||x.sourceId,x.to||x.targetId,{relation:x.type||x.relation||'related_to',kind:'asserted'}));}
   if(p==='/api/cache/clear'&&req.method==='POST'){knowledge.clearCaches();embedded.clear();return json(200,knowledge.stats());}
   if(p==='/api/chat'&&req.method==='POST'){
    const x=await input(),query=String(x.message||'').slice(0,12000);if(!query.trim())throw Error('Enter a question.');
    const abort=new AbortController();res.on('close',()=>abort.abort());const result=await retrieve(query,{limit:8,seedIds:x.sourceId?[x.sourceId]:undefined,signal:abort.signal});
    const evidence=result.results.map(r=>({id:r.id||r.citation?.sourceId,title:r.title,text:r.text||r.excerpt,sourceRef:r.citation}));
    res.writeHead(200,{'Content-Type':'application/x-ndjson'});const emit=e=>{if(!res.destroyed)res.write(JSON.stringify(e)+'\n');};emit({type:'evidence',results:result.results,status:result.status});
    if(!evidence.length){emit({type:'error',error:'No matching passages. Open a relevant article or PDF page, or refine your search.'});res.end();return;}
    let answer='';const messages=[...(x.messages||[]).slice(-12),{role:'user',content:query}];
    try{for await(const e of bot.chat({messages,evidence,model:x.model||managedModel||store.getSettings().model,signal:abort.signal})){if(e.type==='delta')answer+=e.text;emit(e);}if(answer)store.saveChat({id:x.chatId,title:query.slice(0,80),messages:[...messages,{role:'assistant',content:answer,citations:evidence.map((e,i)=>({id:`S${i+1}`,sourceId:e.id,title:e.title,sourceRef:e.sourceRef}))}]});}catch(e){emit({type:'error',error:e.message});}res.end();return;
   }
   if(p==='/api/chats')return json(200,store.listChats());
   if(p==='/api/annotations'&&req.method==='GET')return json(200,store.listAnnotations(url.searchParams.get('assetId')||undefined));
   if(p==='/api/annotations'&&req.method==='POST'){
    const value=await input();if(typeof value.text!=='string'||value.text.length>100000)throw Error('Notes must contain at most 100,000 characters.');
    const n=store.saveAnnotation(value),item=store.get(n.assetId),snapshotId=randomUUID(),id=hash(`note:${n.id}:${snapshotId}`),corpusId=`annotation:${n.id}`;
    knowledge.registerLayer({id,corpusId,precedence:Date.now()});
    knowledge.putSource({id,assetId:n.assetId,edition:hashText(n.text),corpusId,layerId:id,key:`note:${n.id}`,title:`Note · ${item.name}`,kind:'note',locator:{noteId:n.id,snapshotId,...n.locator},contentHash:hashText(n.text),links:[]});
    knowledge.saveNote({id:snapshotId,sourceId:id,text:n.text,anchor:n.locator});
    const target=sid(n.assetId,n.locator.key||'');if(knowledge.getSource(target))knowledge.addEdge(id,target,{relation:'annotates',kind:'asserted'});return json(201,{...n,sourceId:id});
   }
   if(p==='/api/drafts'&&req.method==='GET')return json(200,store.listDrafts());
   if(p==='/api/drafts'&&req.method==='POST')return json(201,store.saveDraft(await input()));
   if(p==='/api/finalize'&&req.method==='POST'){const x=await input(),r=await store.finalizeDraft(x.id,{parentRevisionId:x.parentRevisionId}),item=store.get(r.assetId),layerId=`revision:${r.id}`,corpusId=`work:${r.lineageId}`;knowledge.registerLayer({id:layerId,corpusId,precedence:Date.now()});const text=await bodyFor({assetId:item.id,kind:item.kind});await remember(item,{id:hash(layerId),text,layerId,corpusId,locator:{revisionId:r.id,editionId:r.editionId}});return json(201,r);}
   if(p==='/api/overlay'&&req.method==='POST'){
    const x=await input(),original=knowledge.getSource(x.sourceId);if(!original)throw Error('Open the original passage first.');const layerId=hash(`${original.id}:${randomUUID()}`);
    knowledge.registerLayer({id:layerId,corpusId:original.corpusId||original.assetId,precedence:Date.now(),enabled:true});
    if(x.deleted){knowledge.tombstone({layerId,key:original.key,assetId:original.assetId,edition:original.edition});return json(201,{layerId,deleted:true});}
    const text=String(x.text||''),item=await store.put(Readable.from([Buffer.from(text)]),{name:`${original.title} · correction.txt`.slice(0,240),kind:'final',mime:mime.final});
    return json(201,{layerId,source:await remember(item,{id:hash(`${item.id}:${original.key}:${layerId}`),key:original.key,title:original.title,text,kind:'final',corpusId:original.corpusId||original.assetId,layerId,locator:{originalSourceId:original.id}})});
   }
   if(p==='/api/backup'&&req.method==='GET'){const knowledgeMesh=meshSnapshot();return json(200,{...await store.exportBackup({includeBytes:url.searchParams.get('bytes')==='true'}),knowledgeMesh});}
   if(p==='/api/backup'&&req.method==='POST'){const manifest=await input(64*1024**2),mesh=await validateMesh(manifest.knowledgeMesh,manifest),currentSettings=store.getSettings();
    // A backup is content, not permission to send private evidence to a new host.
    manifest.settings={...(manifest.settings||{}),endpoint:currentSettings.endpoint||'http://127.0.0.1:8080/v1',allowRemote:currentSettings.allowRemote===true};
    const replacement=makeBot(manifest.settings),result=await store.importBackup(manifest);restoreMesh(mesh);bot=replacement;embedded.clear();return json(201,{...result,knowledgeSources:mesh?.sources.length||0});}
   if(p==='/api/model-references'&&req.method==='GET')return json(200,store.listModelReferences());
   if(p==='/api/model-references'&&req.method==='POST')return json(201,store.saveModelReference(await input()));
   if(p==='/api/downloads')return json(200,await jobs());
   if(p==='/api/dyndon/plan'&&req.method==='POST'){const x=await input();return json(200,await transfers.plan(x.manifest,await budgets(x.options)));}
   if(p==='/api/dyndon/download'&&req.method==='POST'){const x=await input(),job=await transfers.createDownloadJob(x.manifest,await budgets(x.options));startTransfer(job.id);return json(201,job);}
   if(p==='/api/dyndon/resume'&&req.method==='POST'){const x=await input(),job=await transfers.getJob(x.id);if(job.type!=='download')throw Error('Not a download job');if(['released','cancelled'].includes(job.status))throw Error('Job has been released');if(job.status==='complete')return json(200,await adopt(job));startTransfer(job.id);return json(200,{...job,status:'running',active:true});}
   if(p==='/api/dyndon/pause'&&req.method==='POST'){const x=await input();return json(200,await transfers.pauseDownload(x.id));}
   if(p==='/api/dyndon/generate'&&req.method==='POST'){const x=await input(16*1024**2);return json(201,await adopt(await transfers.generateZim(x.records,{...await budgets(x.options),metadata:x.metadata||{}})));}
   const state=p.match(/^\/api\/state\/([a-f0-9]{64})$/);
   if(state){if(req.method==='GET')return json(200,store.readState(state[1]));if(req.method==='POST'){const x=await input(65536);store.saveState(state[1],x);return json(200,x);}}
   const exactSource=p.match(/^\/api\/sources\/([^/]+)\/read$/);
   if(exactSource&&req.method==='GET'){
    const source=knowledge.getSource(decodeURIComponent(exactSource[1]));if(!source||source.tombstone)return json(404,{error:'Unknown source edition.'});
    const projection=await knowledge.project(source.id,bodyFor),result={source,text:projection.text,key:source.key,...(source.locator.page?{page:source.locator.page}:{})};
    if(['zim','epub'].includes(source.kind)){const entry=source.kind==='zim'?await withArchive(source.assetId,z=>z.read(source.key)):await withDocuments(()=>documents.epubRead(store.file(source.assetId),source.key));if(/(?:html|xhtml)/i.test(entry.mime))result.html=entry.bytes.toString('utf8');result.resourceBase=`/api/resources/${source.assetId}/`;}
    else if(source.kind!=='note'){const item=store.get(source.assetId);if(item.kind==='html'||item.mime==='text/html')result.html=await readFile(store.file(item.id),'utf8');}
    return json(200,result);
   }
   const lookup=p.match(/^\/api\/assets\/([a-f0-9]{64})\/(entries|read|verify|info|bytes)$/);
   if(lookup){const[,id,action]=lookup,item=store.get(id);if(!item)return json(404,{error:'Unknown asset'});
    if(action==='entries'){if(item.kind==='zim')return json(200,await withArchive(id,async z=>{const entries=await z.list({offset:Number(url.searchParams.get('offset')||0),limit:60,query:url.searchParams.get('query')||''});return{entries,nextOffset:entries.nextOffset,complete:entries.complete,metadata:z.metadata()};}));if(item.kind==='epub')return json(200,await withDocuments(()=>documents.epubInfo(store.file(id))));}
    if(action==='read')return json(200,await readSource(item,url.searchParams.get('key')||'',Number(url.searchParams.get('page')||1)));
    if(action==='verify'){const verified=await store.verify(id);if(verified.ok&&item.kind==='zim'){try{verified.archive=await withArchive(id,z=>z.verify());}catch(e){verified.ok=false;verified.archiveError=e.message;}}return json(200,verified);}
    if(action==='info')return json(200,item.kind==='pdf'?await withDocuments(()=>documents.pdfInfo(store.file(id))):{item,editions:store.listEditions(id)});
    if(action==='bytes'){
     const file=store.file(id),current=await stat(file);if(current.size!==item.size)throw Error('Mounted source changed. Re-import it as a new edition.');let start=0,end=item.size-1;const range=req.headers.range;
     if(range){const m=range.match(/^bytes=(\d*)-(\d*)$/);if(!m||(!m[1]&&!m[2])||item.size===0){res.setHeader('Content-Range',`bytes */${item.size}`);return json(416,{error:'Invalid range'});}if(!m[1])start=Math.max(0,item.size-Number(m[2]));else{start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),end):end;}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=item.size){res.setHeader('Content-Range',`bytes */${item.size}`);return json(416,{error:'Invalid range'});}res.setHeader('Content-Range',`bytes ${start}-${end}/${item.size}`);}
     res.writeHead(range?206:200,{'Content-Type':item.mime,'Content-Length':Math.max(0,end-start+1),'Accept-Ranges':'bytes','Content-Security-Policy':"default-src 'none'; sandbox"});if(!item.size||req.method==='HEAD')return res.end();createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);return;
    }
   }
   const resource=p.match(/^\/api\/resources\/([a-f0-9]{64})\/(.+)$/);
   if(resource){const[,id,encoded]=resource,item=store.get(id);if(!item||!['zim','epub'].includes(item.kind))throw Error('Unknown archive source.');const key=decodeURIComponent(encoded),r=item.kind==='zim'?await withArchive(id,z=>z.read(key)):await withDocuments(()=>documents.epubRead(store.file(id),key));res.writeHead(200,{'Content-Type':r.mime,'Content-Length':r.bytes.length,'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"});return res.end(r.bytes);}
   if(req.method!=='GET'&&req.method!=='HEAD')return json(405,{error:'Method not allowed'});
   const rel=p==='/'?'index.html':decodeURIComponent(p.slice(1)),target=path.resolve(here,'public',rel);if(!target.startsWith(path.join(here,'public')+path.sep))return json(403,{error:'Invalid path'});
   const types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.wasm':'application/wasm','.woff':'font/woff','.woff2':'font/woff2'};
   const bytes=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"});res.end(bytes);
  }catch(e){if(res.headersSent){if(!res.destroyed)res.end();}else json(e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'Resource unavailable':e.message});}
 });
 let shutdownPromise=Promise.resolve();
 server.on('close',()=>{closing=true;shutdownPromise=(async()=>{const failures=[];const settle=async work=>{try{await work;}catch(error){failures.push(error);}};await settle(transfers.close?.());await Promise.allSettled([...runningTransfers.values(),...adopting.values()]);await settle(runtimeService.close());await archiveQueue;await documentQueue;for(const z of archives.values())await settle(z.close());await settle(documents.close());knowledge.close();store.close();if(failures.length)throw new AggregateError(failures,'Some resources could not close cleanly.');})();shutdownPromise.catch(error=>console.error('EnZIME shutdown:',error.message));});
 async function close(){if(server.listening)await new Promise(resolve=>server.close(resolve));await shutdownPromise;}
 return{server,store,knowledge,documents,readSource,retrieve,transfers,runtimeService,close};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const{server}=await createApp({checkout:purchaseLink()});server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(`EnZIME: http://127.0.0.1:${server.address().port}`));}
