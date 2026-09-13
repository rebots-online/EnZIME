import {DatabaseSync} from 'node:sqlite';
import {mkdir,chmod,link,unlink,open} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
export async function openStore(root){
 for(const dir of [root,path.join(root,'objects'),path.join(root,'tmp')]){await mkdir(dir,{recursive:true,mode:0o700});await chmod(dir,0o700);}
 const db=new DatabaseSync(path.join(root,'catalog.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS objects(id TEXT PRIMARY KEY,name TEXT,kind TEXT,mime TEXT,size INTEGER,created TEXT); CREATE TABLE IF NOT EXISTS reading(id TEXT PRIMARY KEY,state TEXT);');
 for(const suffix of ['','-wal','-shm'])await chmod(path.join(root,'catalog.sqlite'+suffix),0o600).catch(e=>{if(e.code!=='ENOENT')throw e;});
 return {root,close:()=>db.close(),list:()=>db.prepare('SELECT * FROM objects ORDER BY created DESC').all(),get:id=>db.prepare('SELECT * FROM objects WHERE id=?').get(id),file:id=>path.join(root,'objects',id),
 patchState(id,patch){if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Invalid reading state');db.exec('BEGIN IMMEDIATE');try{const value={...this.readState(id),...patch};this.saveState(id,value);db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}},
 async put(stream,{name,kind,mime},maxBytes=20*1024**3){
 if(!['zim','model','final','pdf','audio','video'].includes(kind)||typeof name!=='string'||!name||name.length>240||typeof mime!=='string'||!mime) throw Error('Invalid asset metadata');
 const tmp=path.join(root,'tmp',randomUUID()); const file=await open(tmp,'wx',0o600); const hash=createHash('sha256'); let size=0;
 try {for await(const chunk of stream){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=bytes.length;if(size>maxBytes)throw Error('Asset exceeds size limit');hash.update(bytes);await file.writeFile(bytes);} await file.sync();await file.close();const id=hash.digest('hex');const dest=path.join(root,'objects',id);try{await link(tmp,dest);}catch(e){if(e.code!=='EEXIST')throw e;const existing=createHash('sha256');for await(const bytes of createReadStream(dest))existing.update(bytes);if(existing.digest('hex')!==id)throw Error('Existing object failed integrity verification');}await unlink(tmp);db.prepare('INSERT INTO objects VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,mime=excluded.mime').run(id,name,kind,mime,size,new Date().toISOString());return this.get(id);}catch(e){await file.close().catch(()=>{});await unlink(tmp).catch(()=>{});throw e;}
 },readState(id){try{return JSON.parse(db.prepare('SELECT state FROM reading WHERE id=?').get(id)?.state||'{}');}catch{throw Error('Invalid saved reading state');}},saveState(id,state){if(!this.get(id))throw Error('Unknown asset');if(!state||typeof state!=='object'||Array.isArray(state))throw Error('Invalid reading state');for(const [key,value]of Object.entries(state)){if(!['page','scroll','font','time','note'].includes(key))throw Error('Unknown reading state field');if(key==='note'){if(typeof value!=='string')throw Error('Invalid note');}else if(typeof value!=='number'||!Number.isFinite(value)||value<0||(key==='page'&&(!Number.isSafeInteger(value)||value<1))||(key==='font'&&(value<14||value>30)))throw Error('Invalid reading position');}db.prepare('INSERT OR REPLACE INTO reading VALUES(?,?)').run(id,JSON.stringify(state));}};
}
