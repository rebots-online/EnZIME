import {createHash} from 'node:crypto';

// OpenZIM 6.1: standard directory entries, uncompressed clusters and trailing MD5.
// Streaming output avoids making a second, corpus-sized Buffer in the writer.
const encoder = value => Buffer.from(String(value), 'utf8');
const u32 = n => {const b=Buffer.alloc(4); b.writeUInt32LE(n); return b;};
const u64 = n => {const b=Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b;};
function clean(value, label) {
  const s=String(value ?? '');
  if(s.includes('\0') || Buffer.byteLength(s)>65535) throw Error(`Invalid ZIM ${label}`);
  return s;
}
function prepare(records, options={}) {
  if(!Array.isArray(records)) throw Error('ZIM records must be an array');
  const seen=new Set();
  const entries=records.map((record,index)=>{
    const key=clean(record.key || record.id || `article-${index+1}`,'key').replace(/^C\//,'');
    if(!key || seen.has(key)) throw Error('ZIM article keys must be unique and nonempty');
    seen.add(key);
    const bytes=Buffer.isBuffer(record.bytes)?record.bytes:Buffer.from(record.html ?? record.text ?? record.body ?? '', 'utf8');
    if(bytes.length>0xfffffff0) throw Error('ZIM record exceeds a 32-bit cluster');
    return {namespace:'C',key,title:clean(record.title || key,'title'),mime:clean(record.mime || (record.html!==undefined?'text/html':'text/plain'),'MIME'),bytes};
  });
  const metadata={Title:options.title || 'EnZIME knowledge edition',Description:options.description || 'A storage-fit edition created with EnZIME',Language:options.language || 'eng',Creator:options.creator || 'EnZIME',Publisher:options.publisher || 'EnZIME',Date:options.date || new Date().toISOString().slice(0,10)};
  for(const [key,value] of Object.entries(metadata)) entries.push({namespace:'M',key,title:'',mime:'text/plain',bytes:encoder(clean(value,'metadata'))});
  entries.sort((a,b)=>Buffer.compare(encoder(a.namespace+a.key),encoder(b.namespace+b.key)));
  const mimes=[...new Set(entries.map(e=>e.mime))].sort();
  if(mimes.length>=65534) throw Error('Too many MIME types');
  const mimeBytes=encoder(mimes.map(x=>x+'\0').join('')+'\0');
  const dirents=entries.map((e,index)=>{
    const fixed=Buffer.alloc(16); fixed.writeUInt16LE(mimes.indexOf(e.mime),0);fixed[2]=0;fixed[3]=e.namespace.charCodeAt(0);fixed.writeUInt32LE(0,4);fixed.writeUInt32LE(index,8);fixed.writeUInt32LE(0,12);
    return Buffer.concat([fixed,encoder(e.key+'\0'+e.title+'\0')]);
  });
  const urlPtrPos=80+mimeBytes.length;
  const titlePtrPos=urlPtrPos+entries.length*8;
  const clusterPtrPos=titlePtrPos+entries.length*4;
  let offset=clusterPtrPos+entries.length*8;
  const urlPointers=dirents.map(d=>{const b=u64(offset);offset+=d.length;return b;});
  const titlePointers=entries.map((e,index)=>({e,index})).sort((a,b)=>Buffer.compare(encoder(a.e.namespace+(a.e.title || a.e.key)),encoder(b.e.namespace+(b.e.title || b.e.key)))).map(x=>u32(x.index));
  const clusterPointers=entries.map(e=>{const b=u64(offset);offset+=1+8+e.bytes.length;return b;});
  const checksumPos=offset;
  const header=Buffer.alloc(80);header.writeUInt32LE(0x044d495a,0);header.writeUInt16LE(6,4);header.writeUInt16LE(1,6);
  const identity=createHash('sha256');for(const e of entries){identity.update(e.namespace+'\0'+e.key+'\0'+e.title+'\0'+e.mime+'\0');identity.update(e.bytes);}identity.digest().copy(header,8,0,16);
  header.writeUInt32LE(entries.length,24);header.writeUInt32LE(entries.length,28);header.writeBigUInt64LE(BigInt(urlPtrPos),32);header.writeBigUInt64LE(BigInt(titlePtrPos),40);header.writeBigUInt64LE(BigInt(clusterPtrPos),48);header.writeBigUInt64LE(80n,56);
  const main=entries.findIndex(e=>e.namespace==='C'&&(e.mime==='text/html'||e.mime==='text/plain'));header.writeUInt32LE(main<0?0xffffffff:main,64);header.writeUInt32LE(0xffffffff,68);header.writeBigUInt64LE(BigInt(checksumPos),72);
  return {entries,header,mimeBytes,urlPointers,titlePointers,clusterPointers,dirents,size:checksumPos+16};
}
export function estimateZimBytes(records, options={}) {return prepare(records,options).size;}
export function* generateZimChunks(records, options={}) {
  const p=prepare(records,options);const digest=createHash('md5');
  for(const b of [p.header,p.mimeBytes,...p.urlPointers,...p.titlePointers,...p.clusterPointers,...p.dirents]){digest.update(b);yield b;}
  for(const e of p.entries){const table=Buffer.alloc(9);table[0]=1;table.writeUInt32LE(8,1);table.writeUInt32LE(8+e.bytes.length,5);digest.update(table);yield table;digest.update(e.bytes);yield e.bytes;}
  yield digest.digest();
}
export function generateUncompressedZim(records, options={}) {return Buffer.concat([...generateZimChunks(records,options)]);}
