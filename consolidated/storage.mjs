import {DatabaseSync} from 'node:sqlite';
import {mkdir,rename,unlink,open,readdir,readFile,stat,realpath} from 'node:fs/promises';
import {createReadStream,readFileSync,unlinkSync,statSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import path from 'node:path';

const HASH=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const KINDS=new Set(['zim','model','final','pdf','audio','video','document','clip','graph','epub','html']);
const DEFAULT_LIMIT=20*1024**3;
const BACKUP_LIMIT=64*1024**2;
const now=()=>new Date().toISOString();
function fail(message,code='INVALID_INPUT'){const error=Error(message);error.code=code;return error;}
function json(value,max=1024**2){const result=JSON.stringify(value);if(result===undefined||Buffer.byteLength(result)>max)throw fail('Metadata exceeds size limit');return result;}
function parse(row){return row?JSON.parse(row.data):undefined;}
function identifier(id){if(!UUID.test(id||''))throw fail('Invalid record ID');return id;}
function metadata(value={}){if(!KINDS.has(value.kind)||typeof value.name!=='string'||!value.name.trim()||value.name.length>240||/[\u0000-\u001f]/.test(value.name))throw fail('Invalid asset metadata');return {name:value.name,kind:value.kind,mime:typeof value.mime==='string'&&value.mime.length<=200?value.mime:'application/octet-stream'};}
function finiteLimit(value,fallback){const n=value??fallback;if(!Number.isSafeInteger(n)||n<0)throw fail('Invalid byte limit');return n;}
async function digestFile(filePath){const h=createHash('sha256');let size=0;for await(const c of createReadStream(filePath)){size+=c.length;h.update(c);}return {id:h.digest('hex'),size};}

/** One process owns each catalog. Payloads are immutable SHA-256 objects; editions,
 * annotations and revisions hold identity independently from byte deduplication. */
export async function openStore(root,options={}){
 const quotaBytes=finiteLimit(options.quotaBytes,DEFAULT_LIMIT);
 root=path.resolve(root);await mkdir(root,{recursive:true});root=await realpath(root);
 const lockPath=path.join(root,'.writer.lock'),token=json({pid:process.pid,token:randomUUID()});let lock;
 try{lock=await open(lockPath,'wx',0o600);}catch(error){
  if(error.code!=='EEXIST')throw error;
  let owner;try{owner=JSON.parse(await readFile(lockPath,'utf8'));}catch{throw fail('Storage already has a writer; inspect .writer.lock after confirming its owner has stopped','STORE_LOCKED');}
  if(!Number.isInteger(owner.pid)||owner.pid<1)throw fail('Storage writer lock requires recovery','STORE_LOCKED');
  let active=true;try{process.kill(owner.pid,0);}catch(e){if(e.code==='ESRCH')active=false;}
  if(active)throw fail('Storage already has an active writer','STORE_LOCKED');
  await unlink(lockPath);try{lock=await open(lockPath,'wx',0o600);}catch{throw fail('Storage already has a writer','STORE_LOCKED');}
 }
 await lock.writeFile(token);await lock.sync();await lock.close();
 let db,closed=false,queue=Promise.resolve(),active=0;
 const unlock=()=>{try{if(readFileSync(lockPath,'utf8')===token)unlinkSync(lockPath);}catch{}};
 try{
  await mkdir(path.join(root,'objects'),{recursive:true});await mkdir(path.join(root,'tmp'),{recursive:true});
  db=new DatabaseSync(path.join(root,'catalog.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS objects(id TEXT PRIMARY KEY,name TEXT,kind TEXT,mime TEXT,size INTEGER,created TEXT);
   CREATE TABLE IF NOT EXISTS reading(id TEXT PRIMARY KEY,state TEXT);
   CREATE TABLE IF NOT EXISTS editions(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES objects(id),data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS annotations(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES objects(id),data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY,data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS revisions(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES objects(id),lineage_id TEXT NOT NULL,data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS settings(id TEXT PRIMARY KEY,data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS chats(id TEXT PRIMARY KEY,data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS model_references(id TEXT PRIMARY KEY,data TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS editions_asset ON editions(asset_id);
   CREATE INDEX IF NOT EXISTS annotations_asset ON annotations(asset_id);
   CREATE INDEX IF NOT EXISTS revisions_lineage ON revisions(lineage_id);`);
  const columns=new Set(db.prepare('PRAGMA table_info(objects)').all().map(x=>x.name));
  for(const [name,definition] of [['storage',"TEXT NOT NULL DEFAULT 'managed'"],['source_path','TEXT'],['file_mtime','REAL']])if(!columns.has(name))db.exec(`ALTER TABLE objects ADD COLUMN ${name} ${definition}`);
  // Migrate earlier content-only catalogs without changing asset IDs or state.
  for(const item of db.prepare('SELECT * FROM objects WHERE id NOT IN (SELECT asset_id FROM editions)').all()){
   const edition={id:randomUUID(),assetId:item.id,name:item.name,kind:item.kind,mime:item.mime,created:item.created,sourceId:item.id,version:item.id,metadata:{}};
   db.prepare('INSERT INTO editions VALUES(?,?,?)').run(edition.id,item.id,json(edition));
  }
  // A crash may leave a temporary upload or a renamed object before its catalog commit.
  for(const name of await readdir(path.join(root,'tmp')))await unlink(path.join(root,'tmp',name)).catch(()=>{});
  for(const name of await readdir(path.join(root,'objects')))if(HASH.test(name)&&!db.prepare('SELECT 1 FROM objects WHERE id=?').get(name))await unlink(path.join(root,'objects',name));
 }catch(error){db?.close();unlock();throw error;}
 const ensureOpen=()=>{if(closed)throw fail('Storage is closed','STORE_CLOSED');};
 const run=fn=>{ensureOpen();active++;const result=queue.then(()=>{ensureOpen();return fn();}).finally(()=>active--);queue=result.catch(()=>{});return result;};
 const transaction=fn=>{ensureOpen();db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
 const get=id=>{ensureOpen();return HASH.test(id||'')?db.prepare('SELECT * FROM objects WHERE id=?').get(id):undefined;};
 const requireAsset=id=>{const a=get(id);if(!a)throw fail('Unknown asset','NOT_FOUND');return a;};
 const storedBytes=()=>db.prepare("SELECT COALESCE(SUM(size),0) AS size FROM objects WHERE storage='managed'").get().size;
 const checkQuota=extra=>{if(storedBytes()+extra>quotaBytes)throw fail('Storage quota exceeded','QUOTA_EXCEEDED');};
 const recordEdition=(asset,value={})=>{
  const parent=value.parentEditionId?parse(db.prepare('SELECT data FROM editions WHERE id=?').get(value.parentEditionId)):undefined;
  if(value.parentEditionId&&!parent)throw fail('Unknown parent edition','NOT_FOUND');
  const edition={id:randomUUID(),assetId:asset.id,name:value.name||asset.name,kind:value.kind||asset.kind,mime:value.mime||asset.mime,created:now(),sourceId:value.sourceId||parent?.sourceId||asset.id,version:value.version||asset.id,parentEditionId:parent?.id||null,metadata:value.metadata||{}};
  if(typeof edition.sourceId!=='string'||edition.sourceId.length>500||typeof edition.version!=='string'||edition.version.length>500)throw fail('Invalid edition identity');
  db.prepare('INSERT INTO editions VALUES(?,?,?)').run(edition.id,asset.id,json(edition));return edition;
 };
 const putInternal=async(stream,value,maxBytes=DEFAULT_LIMIT)=>{
  const meta=metadata(value);maxBytes=finiteLimit(maxBytes,DEFAULT_LIMIT);json(value);
  if(value.parentEditionId&&!parse(db.prepare('SELECT data FROM editions WHERE id=?').get(value.parentEditionId)))throw fail('Unknown parent edition','NOT_FOUND');
  const tmp=path.join(root,'tmp',randomUUID()),handle=await open(tmp,'wx',0o600),hash=createHash('sha256');let size=0,target,addedFile=false;
  try{
   for await(const chunk of stream){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=bytes.length;if(size>maxBytes)throw fail('Asset exceeds size limit','SIZE_LIMIT');if(size>quotaBytes)throw fail('Storage quota exceeded','QUOTA_EXCEEDED');hash.update(bytes);await handle.writeFile(bytes);}
   await handle.sync();await handle.close();const id=hash.digest('hex'),existing=get(id);target=path.join(root,'objects',id);
   if(!existing||existing.storage!=='managed'){checkQuota(size);await rename(tmp,target);addedFile=true;}else await unlink(tmp);
   const result=transaction(()=>{
    if(!existing)db.prepare('INSERT INTO objects(id,name,kind,mime,size,created,storage) VALUES(?,?,?,?,?,?,?)').run(id,meta.name,meta.kind,meta.mime,size,now(),'managed');
    else if(existing.storage!=='managed')db.prepare("UPDATE objects SET storage='managed',source_path=NULL,file_mtime=NULL WHERE id=?").run(id);
    const asset=requireAsset(id),edition=recordEdition(asset,{...value,...meta});return {...asset,editionId:edition.id};
   });return result;
  }catch(error){await handle.close().catch(()=>{});await unlink(tmp).catch(()=>{});if(addedFile)await unlink(target).catch(()=>{});throw error;}
 };
 const records=table=>db.prepare(`SELECT data FROM ${table} ORDER BY rowid DESC`).all().map(parse);
 const assertSourceRefs=refs=>{if(!Array.isArray(refs)||refs.length>500)throw fail('Invalid source references');for(const ref of refs){if(!ref||typeof ref!=='object'||!HASH.test(ref.assetId||''))throw fail('Invalid source reference');requireAsset(ref.assetId);if(ref.editionId){const e=parse(db.prepare('SELECT data FROM editions WHERE id=?').get(ref.editionId));if(!e||e.assetId!==ref.assetId)throw fail('Source edition does not match asset');}}json(refs);return refs;};
 const api={root,
  close(){if(closed)return;if(active)throw fail('Wait for pending storage operations before closing','STORE_BUSY');db.close();closed=true;unlock();},
  list(){ensureOpen();return db.prepare('SELECT * FROM objects ORDER BY created DESC').all();},get,
  file(id){const a=requireAsset(id);if(a.storage==='missing')throw fail('Source bytes are not present; restore or remount the source','SOURCE_MISSING');if(a.storage==='mounted'){const source=statSync(a.source_path);if(source.size!==a.size||source.mtimeMs!==a.file_mtime)throw fail('Mounted source changed; verify and remount it as a new edition','SOURCE_CHANGED');return a.source_path;}return path.join(root,'objects',id);},
  put(stream,value,maxBytes){return run(()=>putInternal(stream,value,maxBytes));},
  listEditions(assetId){ensureOpen();return assetId?db.prepare('SELECT data FROM editions WHERE asset_id=? ORDER BY rowid DESC').all(assetId).map(parse):records('editions');},
  getEdition(id){ensureOpen();return parse(db.prepare('SELECT data FROM editions WHERE id=?').get(id));},
  createEdition(assetId,value={}){ensureOpen();metadata({...requireAsset(assetId),...value});return recordEdition(requireAsset(assetId),value);},
  readState(id){ensureOpen();return JSON.parse(db.prepare('SELECT state FROM reading WHERE id=?').get(id)?.state||'{}');},
  saveState(id,state){requireAsset(id);db.prepare('INSERT OR REPLACE INTO reading VALUES(?,?)').run(id,json(state,65536));return state;},
  saveAnnotation(value={}){
   requireAsset(value.assetId);const id=value.id?identifier(value.id):randomUUID(),old=parse(db.prepare('SELECT data FROM annotations WHERE id=?').get(id));
   if(old&&(old.assetId!==value.assetId||old.editionId!==(value.editionId||null)))throw fail('An annotation source identity is immutable');
   if(value.editionId&&api.getEdition(value.editionId)?.assetId!==value.assetId)throw fail('Annotation edition does not match asset');
   if(!value.locator||typeof value.locator!=='object'||Array.isArray(value.locator)||!Object.keys(value.locator).length)throw fail('Annotation requires a stable source locator');
   if(typeof value.text!=='string'||value.text.length>200000)throw fail('Invalid annotation text');
   const item={id,assetId:value.assetId,editionId:value.editionId||null,locator:value.locator,text:value.text,color:value.color||'amber',tags:Array.isArray(value.tags)?value.tags:[],created:old?.created||now(),updated:now()};
   db.prepare('INSERT OR REPLACE INTO annotations VALUES(?,?,?)').run(id,item.assetId,json(item));return item;
  },
  listAnnotations(assetId){ensureOpen();return assetId?db.prepare('SELECT data FROM annotations WHERE asset_id=? ORDER BY rowid').all(assetId).map(parse):records('annotations');},
  deleteAnnotation(id){ensureOpen();return !!db.prepare('DELETE FROM annotations WHERE id=?').run(identifier(id)).changes;},
  saveDraft(value={}){
   ensureOpen();const id=value.id?identifier(value.id):randomUUID(),old=api.getDraft(id);
   if(typeof value.title!=='string'||!value.title.trim()||value.title.length>240||typeof value.body!=='string'||!['markdown','text','html'].includes(value.format||'markdown'))throw fail('Invalid draft');
   const item={id,title:value.title,body:value.body,format:value.format||'markdown',sourceRefs:assertSourceRefs(value.sourceRefs||[]),created:old?.created||now(),updated:now(),lastRevisionId:old?.lastRevisionId||null,private:true};
   db.prepare('INSERT OR REPLACE INTO drafts VALUES(?,?)').run(id,json(item,4*1024**2));return item;
  },
  getDraft(id){ensureOpen();return parse(db.prepare('SELECT data FROM drafts WHERE id=?').get(id));},
  listDrafts(){ensureOpen();return records('drafts');},
  deleteDraft(id){ensureOpen();return !!db.prepare('DELETE FROM drafts WHERE id=?').run(identifier(id)).changes;},
  finalizeDraft(id,{parentRevisionId}={}){return run(async()=>{
   const draft=api.getDraft(id);if(!draft)throw fail('Unknown draft','NOT_FOUND');const parentId=parentRevisionId||draft.lastRevisionId,parent=parentId?api.getRevision(parentId):undefined;
   if(parentId&&!parent)throw fail('Unknown parent revision','NOT_FOUND');
   const mime={markdown:'text/markdown',text:'text/plain',html:'text/html'}[draft.format];
   const asset=await putInternal(Readable.from([Buffer.from(draft.body)]),{name:draft.title,kind:'final',mime,sourceId:parent?.lineageId||draft.id,parentEditionId:parent?.editionId,metadata:{sourceRefs:draft.sourceRefs}},4*1024**2);
   const revision={id:randomUUID(),assetId:asset.id,editionId:asset.editionId,lineageId:parent?.lineageId||draft.id,parentRevisionId:parent?.id||null,title:draft.title,format:draft.format,sourceRefs:draft.sourceRefs,created:now(),draftId:draft.id};
   transaction(()=>{db.prepare('INSERT INTO revisions VALUES(?,?,?,?)').run(revision.id,revision.assetId,revision.lineageId,json(revision));db.prepare('UPDATE drafts SET data=? WHERE id=?').run(json({...draft,lastRevisionId:revision.id,updated:now()},4*1024**2),id);});return revision;
  });},
  getRevision(id){ensureOpen();return parse(db.prepare('SELECT data FROM revisions WHERE id=?').get(id));},
  listRevisions(lineageId){ensureOpen();return lineageId?db.prepare('SELECT data FROM revisions WHERE lineage_id=? ORDER BY rowid').all(lineageId).map(parse):records('revisions');},
  getSettings(){ensureOpen();return parse(db.prepare("SELECT data FROM settings WHERE id='preferences'").get())||{};},
  saveSettings(value){ensureOpen();if(!value||typeof value!=='object'||Array.isArray(value))throw fail('Invalid settings');const merged={...api.getSettings(),...value};db.prepare("INSERT OR REPLACE INTO settings VALUES('preferences',?)").run(json(merged,65536));return merged;},
  saveChat(value={}){
   ensureOpen();const id=value.id?identifier(value.id):randomUUID(),old=api.getChat(id);
   if(!Array.isArray(value.messages)||value.messages.length>2000||value.messages.some(m=>!m||!['system','user','assistant','tool'].includes(m.role)||typeof m.content!=='string'))throw fail('Invalid chat messages');
   const item={id,title:String(value.title||'New conversation').slice(0,240),messages:value.messages,created:old?.created||now(),updated:now()};
   db.prepare('INSERT OR REPLACE INTO chats VALUES(?,?)').run(id,json(item,4*1024**2));return item;
  },
  getChat(id){ensureOpen();return parse(db.prepare('SELECT data FROM chats WHERE id=?').get(id));},
  listChats(){ensureOpen();return records('chats');},
  deleteChat(id){ensureOpen();return !!db.prepare('DELETE FROM chats WHERE id=?').run(identifier(id)).changes;},
  saveModelReference(value={}){
   ensureOpen();if(typeof value.name!=='string'||!value.name.trim()||value.name.length>240)throw fail('Invalid model reference');
   if(!value.assetId&&!value.path&&!value.uri)throw fail('Model reference needs an asset, path, or URI');
   if(value.assetId&&requireAsset(value.assetId).kind!=='model')throw fail('Reference asset is not a model');
   if(value.path&&(typeof value.path!=='string'||!path.isAbsolute(value.path)))throw fail('Model path must be absolute');
   if(value.uri&&(typeof value.uri!=='string'||!/^content:\/\//.test(value.uri)))throw fail('Android model references require a content URI');
   const item={...value,id:value.id?identifier(value.id):randomUUID(),updated:now()};db.prepare('INSERT OR REPLACE INTO model_references VALUES(?,?)').run(item.id,json(item,65536));return item;
  },
  listModelReferences(){ensureOpen();return records('model_references');},
  deleteModelReference(id){ensureOpen();return !!db.prepare('DELETE FROM model_references WHERE id=?').run(identifier(id)).changes;},
  mount(filePath,value={}){return run(async()=>{
   const meta=metadata(value),sourcePath=await realpath(filePath),before=await stat(sourcePath);if(!before.isFile())throw fail('Mount requires a regular file');
   const digest=await digestFile(sourcePath),after=await stat(sourcePath);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ino!==after.ino)throw fail('Source changed during mount','SOURCE_CHANGED');
   return transaction(()=>{let asset=get(digest.id);if(!asset){db.prepare('INSERT INTO objects(id,name,kind,mime,size,created,storage,source_path,file_mtime) VALUES(?,?,?,?,?,?,?,?,?)').run(digest.id,meta.name,meta.kind,meta.mime,digest.size,now(),'mounted',sourcePath,after.mtimeMs);asset=get(digest.id);}else if(asset.storage!=='managed'){db.prepare("UPDATE objects SET storage='mounted',source_path=?,file_mtime=? WHERE id=?").run(sourcePath,after.mtimeMs,digest.id);asset=get(digest.id);}const edition=recordEdition(asset,{...value,...meta});return {...asset,editionId:edition.id};});
  });},
  verify(id){return run(async()=>{
   const asset=requireAsset(id);try{const filePath=api.file(id),before=await stat(filePath),result=await digestFile(filePath),after=await stat(filePath),changed=before.size!==after.size||before.mtimeMs!==after.mtimeMs;return {assetId:id,ok:!changed&&result.id===id&&result.size===asset.size,expectedHash:id,actualHash:result.id,expectedSize:asset.size,actualSize:result.size,sourceChanged:changed||(asset.storage==='mounted'&&(after.mtimeMs!==asset.file_mtime||after.size!==asset.size)),storage:asset.storage,checkedAt:now()};}catch(error){return {assetId:id,ok:false,storage:asset.storage,error:error.message,checkedAt:now()};}
  });},
  stats(){ensureOpen();const objects=api.list(),managedBytes=objects.filter(x=>x.storage==='managed').reduce((n,x)=>n+x.size,0);return {quotaBytes,managedBytes,availableBytes:Math.max(0,quotaBytes-managedBytes),mountedBytes:objects.filter(x=>x.storage==='mounted').reduce((n,x)=>n+x.size,0),missingBytes:objects.filter(x=>x.storage==='missing').reduce((n,x)=>n+x.size,0),objects:objects.length,editions:api.listEditions().length,annotations:api.listAnnotations().length,drafts:api.listDrafts().length,revisions:api.listRevisions().length};},
  exportBackup({includeBytes=false,maxBytes=BACKUP_LIMIT}={}){return run(async()=>{
   maxBytes=finiteLimit(maxBytes,BACKUP_LIMIT);
   // Capture metadata before any await so the manifest is one coherent catalog view.
   const objects=api.list().map(({source_path,file_mtime,...x})=>x);
   const manifest={format:'enzime-backup',version:1,created:now(),objects,editions:api.listEditions(),reading:db.prepare('SELECT * FROM reading').all().map(x=>({assetId:x.id,state:JSON.parse(x.state)})),annotations:api.listAnnotations(),drafts:api.listDrafts(),revisions:api.listRevisions(),settings:api.getSettings(),chats:api.listChats(),modelReferences:api.listModelReferences()};
   if(includeBytes){let total=0;for(const object of objects){if(object.storage==='missing')continue;total+=object.size;if(total>maxBytes)throw fail('Backup byte limit exceeded; use manifest and streaming asset export','SIZE_LIMIT');const data=await readFile(api.file(object.id));if(createHash('sha256').update(data).digest('hex')!==object.id)throw fail('Source integrity check failed during backup','INTEGRITY_ERROR');object.bytes=data.toString('base64');}}
   return manifest;
  });},
  importBackup(manifest,{maxBytes=BACKUP_LIMIT}={}){return run(async()=>{
   maxBytes=finiteLimit(maxBytes,BACKUP_LIMIT);
   if(!manifest||manifest.format!=='enzime-backup'||manifest.version!==1)throw fail('Unsupported backup format');
   const groups=['objects','editions','reading','annotations','drafts','revisions','chats','modelReferences'];for(const group of groups)if(!Array.isArray(manifest[group]||[])||(manifest[group]||[]).length>100000)throw fail('Invalid backup collection');
   const objects=manifest.objects||[],byId=new Map(),staged=[],written=[],seenRecords=new Set();let payloadBytes=0,requiredBytes=0;
   const ensureReference=id=>{if(!HASH.test(id||'')||(!byId.has(id)&&!get(id)))throw fail('Backup references an unknown asset');};
   const assertRecord=(record,collection)=>{if(!record||!UUID.test(record.id||'')||seenRecords.has(collection+record.id))throw fail('Invalid or duplicate backup record ID');seenRecords.add(collection+record.id);json(record,4*1024**2);};
   try{
    for(const object of objects){metadata(object);if(!HASH.test(object.id||'')||byId.has(object.id)||!Number.isSafeInteger(object.size)||object.size<0)throw fail('Invalid backup object');if(get(object.id)&&get(object.id).size!==object.size)throw fail('Existing object identity mismatch','INTEGRITY_ERROR');byId.set(object.id,object);
     if(object.bytes!==undefined){if(typeof object.bytes!=='string'||object.bytes.length>Math.ceil(maxBytes/3)*4+4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(object.bytes))throw fail('Invalid backup bytes');const bytes=Buffer.from(object.bytes,'base64');payloadBytes+=bytes.length;if(payloadBytes>maxBytes)throw fail('Backup byte limit exceeded','SIZE_LIMIT');if(bytes.length!==object.size||createHash('sha256').update(bytes).digest('hex')!==object.id)throw fail('Backup object integrity mismatch','INTEGRITY_ERROR');if(get(object.id)?.storage!=='managed'){requiredBytes+=bytes.length;checkQuota(requiredBytes);const tmp=path.join(root,'tmp',randomUUID()),f=await open(tmp,'wx',0o600);try{await f.writeFile(bytes);await f.sync();}finally{await f.close();}staged.push({tmp,id:object.id});}}
    }
    const editions=new Map(api.listEditions().map(x=>[x.id,x]));for(const e of manifest.editions||[]){assertRecord(e,'edition');ensureReference(e.assetId);if(typeof e.sourceId!=='string'||typeof e.version!=='string')throw fail('Invalid backup edition');const old=editions.get(e.id);if(old&&json(old)!==json(e))throw fail('Immutable edition conflict');editions.set(e.id,e);}
    for(const e of manifest.editions||[]){if(e.parentEditionId&&!editions.has(e.parentEditionId))throw fail('Unknown backup parent edition');const visited=new Set([e.id]);let p=e.parentEditionId;while(p){if(visited.has(p))throw fail('Edition lineage cycle');visited.add(p);p=editions.get(p)?.parentEditionId;}}
    const checkRefs=refs=>{if(!Array.isArray(refs))throw fail('Invalid source references');for(const ref of refs){ensureReference(ref.assetId);if(ref.editionId&&editions.get(ref.editionId)?.assetId!==ref.assetId)throw fail('Backup source edition mismatch');}};
    for(const a of manifest.annotations||[]){assertRecord(a,'annotation');ensureReference(a.assetId);if(!a.locator||typeof a.locator!=='object'||!Object.keys(a.locator).length||typeof a.text!=='string')throw fail('Invalid backup annotation');if(a.editionId&&editions.get(a.editionId)?.assetId!==a.assetId)throw fail('Backup annotation edition mismatch');const old=parse(db.prepare('SELECT data FROM annotations WHERE id=?').get(a.id));if(old&&(old.assetId!==a.assetId||old.editionId!==(a.editionId||null)))throw fail('Annotation identity conflict');}
    for(const d of manifest.drafts||[]){assertRecord(d,'draft');if(typeof d.title!=='string'||typeof d.body!=='string'||d.private!==true||!['markdown','text','html'].includes(d.format))throw fail('Invalid backup draft');checkRefs(d.sourceRefs||[]);}
    const revisions=new Map(api.listRevisions().map(x=>[x.id,x]));for(const r of manifest.revisions||[]){assertRecord(r,'revision');ensureReference(r.assetId);if(!UUID.test(r.lineageId||'')||editions.get(r.editionId)?.assetId!==r.assetId)throw fail('Invalid backup revision');checkRefs(r.sourceRefs||[]);const old=revisions.get(r.id);if(old&&json(old)!==json(r))throw fail('Immutable revision conflict');revisions.set(r.id,r);}
    for(const r of manifest.revisions||[]){if(r.parentRevisionId&&revisions.get(r.parentRevisionId)?.lineageId!==r.lineageId)throw fail('Invalid revision lineage');const visited=new Set([r.id]);let p=r.parentRevisionId;while(p){if(visited.has(p))throw fail('Revision lineage cycle');visited.add(p);p=revisions.get(p)?.parentRevisionId;}}
    for(const d of manifest.drafts||[])if(d.lastRevisionId&&!revisions.has(d.lastRevisionId))throw fail('Unknown draft revision');
    for(const c of manifest.chats||[]){assertRecord(c,'chat');if(!Array.isArray(c.messages)||c.messages.length>2000||c.messages.some(m=>!m||!['system','user','assistant','tool'].includes(m.role)||typeof m.content!=='string'))throw fail('Invalid backup chat');}
    for(const ref of manifest.modelReferences||[]){assertRecord(ref,'model');if(ref.assetId)ensureReference(ref.assetId);if(typeof ref.name!=='string'||!ref.name.trim()||(!ref.assetId&&!ref.path&&!ref.uri)||(ref.path&&!path.isAbsolute(ref.path))||(ref.uri&&!/^content:\/\//.test(ref.uri)))throw fail('Invalid backup model reference');}
    for(const reading of manifest.reading||[]){ensureReference(reading.assetId);json(reading.state,65536);}
    if(manifest.settings&&(!manifest.settings||typeof manifest.settings!=='object'||Array.isArray(manifest.settings)))throw fail('Invalid backup settings');json(manifest.settings||{},65536);
    for(const stage of staged){await rename(stage.tmp,path.join(root,'objects',stage.id));written.push(stage.id);}
    transaction(()=>{
     for(const object of objects){const present=get(object.id),hasBytes=staged.some(s=>s.id===object.id);if(!present)db.prepare('INSERT INTO objects(id,name,kind,mime,size,created,storage) VALUES(?,?,?,?,?,?,?)').run(object.id,object.name,object.kind,object.mime||'application/octet-stream',object.size,object.created||now(),hasBytes?'managed':'missing');else if(hasBytes)db.prepare("UPDATE objects SET storage='managed',source_path=NULL,file_mtime=NULL WHERE id=?").run(object.id);}
     for(const e of manifest.editions||[])db.prepare('INSERT OR IGNORE INTO editions VALUES(?,?,?)').run(e.id,e.assetId,json(e));
     for(const a of manifest.annotations||[])db.prepare('INSERT OR REPLACE INTO annotations VALUES(?,?,?)').run(a.id,a.assetId,json(a));
     for(const d of manifest.drafts||[])db.prepare('INSERT OR REPLACE INTO drafts VALUES(?,?)').run(d.id,json(d,4*1024**2));
     for(const r of manifest.revisions||[])db.prepare('INSERT OR IGNORE INTO revisions VALUES(?,?,?,?)').run(r.id,r.assetId,r.lineageId,json(r));
     for(const c of manifest.chats||[])db.prepare('INSERT OR REPLACE INTO chats VALUES(?,?)').run(c.id,json(c,4*1024**2));
     for(const ref of manifest.modelReferences||[])db.prepare('INSERT OR REPLACE INTO model_references VALUES(?,?)').run(ref.id,json(ref));
     for(const reading of manifest.reading||[])db.prepare('INSERT OR REPLACE INTO reading VALUES(?,?)').run(reading.assetId,json(reading.state,65536));
     if(manifest.settings)db.prepare("INSERT OR REPLACE INTO settings VALUES('preferences',?)").run(json(manifest.settings,65536));
    });return {importedObjects:objects.length,importedBytes:requiredBytes,missingObjects:objects.filter(x=>get(x.id).storage==='missing').length};
   }catch(error){for(const stage of staged)await unlink(stage.tmp).catch(()=>{});for(const id of written)await unlink(path.join(root,'objects',id)).catch(()=>{});throw error;}
  });}
 };
 return api;
}
