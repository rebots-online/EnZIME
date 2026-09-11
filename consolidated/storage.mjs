import {DatabaseSync} from 'node:sqlite';
import {mkdir,rename,unlink,open} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
export async function openStore(root){
 await mkdir(path.join(root,'objects'),{recursive:true}); await mkdir(path.join(root,'tmp'),{recursive:true});
 const db=new DatabaseSync(path.join(root,'catalog.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS objects(id TEXT PRIMARY KEY,name TEXT,kind TEXT,mime TEXT,size INTEGER,created TEXT); CREATE TABLE IF NOT EXISTS reading(id TEXT PRIMARY KEY,state TEXT);');
 return {root,close:()=>db.close(),list:()=>db.prepare('SELECT * FROM objects ORDER BY created DESC').all(),get:id=>db.prepare('SELECT * FROM objects WHERE id=?').get(id),file:id=>path.join(root,'objects',id),
 async put(stream,{name,kind,mime},maxBytes=20*1024**3){
 if(!['zim','model','final','pdf','audio','video'].includes(kind)||!name||name.length>240) throw Error('Invalid asset metadata');
 const tmp=path.join(root,'tmp',randomUUID()); const file=await open(tmp,'wx',0o600); const hash=createHash('sha256'); let size=0;
 try {for await(const chunk of stream){size+=chunk.length;if(size>maxBytes)throw Error('Asset exceeds size limit');hash.update(chunk);await file.writeFile(chunk);} await file.sync();await file.close();const id=hash.digest('hex');await rename(tmp,path.join(root,'objects',id));db.prepare('INSERT OR IGNORE INTO objects VALUES(?,?,?,?,?,?)').run(id,name,kind,mime,size,new Date().toISOString());return this.get(id);}catch(e){await file.close().catch(()=>{});await unlink(tmp).catch(()=>{});throw e;}
 },readState:id=>JSON.parse(db.prepare('SELECT state FROM reading WHERE id=?').get(id)?.state||'{}'),saveState(id,state){if(!this.get(id))throw Error('Unknown asset');db.prepare('INSERT OR REPLACE INTO reading VALUES(?,?)').run(id,JSON.stringify(state));}};
}
