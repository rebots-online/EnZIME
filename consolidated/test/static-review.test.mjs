import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,symlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server.mjs';

const staging=fileURLToPath(new URL('../../.staging/static-review',import.meta.url));
const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));
async function fixture(t){
 await mkdir(staging,{recursive:true});
 const root=await mkdtemp(path.join(staging,'fixture-')),prefix='.static-review-'+randomUUID(),artifacts=[];
 let app;
 t.after(async()=>{if(app){if(app.close)await app.close();else await new Promise(resolve=>app.server.close(resolve));}for(const file of artifacts)await rm(file,{recursive:true,force:true});await rm(root,{recursive:true,force:true});});
 const publicPath=suffix=>{const file=path.join(publicRoot,prefix+suffix);artifacts.push(file);return file;};
 app=await createApp({root:path.join(root,'profile'),runtimeOptions:{binary:''}});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 return {root,publicPath,url:suffix=>'http://127.0.0.1:'+app.server.address().port+'/'+prefix+suffix};
}

test('static serving blocks file and directory symlinks to private files outside public',{skip:process.platform==='win32'},async t=>{
 const f=await fixture(t),secret='synthetic private content '+randomUUID(),privateFile=path.join(f.root,'private.txt');
 await writeFile(privateFile,secret);
 await symlink(privateFile,f.publicPath('-outside.txt'));
 await symlink(f.root,f.publicPath('-outside-directory'));
 for(const suffix of ['-outside.txt','-outside-directory/private.txt']){
  const response=await fetch(f.url(suffix));assert.equal(response.status,403);assert.equal((await response.text()).includes(secret),false);
 }
});

test('static serving permits regular files and symlinks resolving within public',{skip:process.platform==='win32'},async t=>{
 const f=await fixture(t),publicFile=f.publicPath('-inside.txt');await writeFile(publicFile,'public fixture');
 await symlink(publicFile,f.publicPath('-alias.txt'));
 for(const suffix of ['-inside.txt','-alias.txt']){const response=await fetch(f.url(suffix));assert.equal(response.status,200);assert.equal(await response.text(),'public fixture');}
});

test('static serving rejects a directory instead of treating it as a regular file',async t=>{
 const f=await fixture(t);await mkdir(f.publicPath('-directory'));const response=await fetch(f.url('-directory'));assert.equal(response.status,404);
});
