import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,access,rm} from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {openStore} from '../storage.mjs';

const serverFile=fileURLToPath(new URL('../server.mjs',import.meta.url));
const posixOnly={skip:process.platform==='win32'};
async function port(){const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const value=listener.address().port;await new Promise(resolve=>listener.close(resolve));return value;}
async function within(promise,milliseconds,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),milliseconds);})]);}finally{clearTimeout(timer);}}

async function launch(t,{listenPort=0,managed=false}={}){
 const directory=await mkdtemp(path.join(os.tmpdir(),'enzime-cli-'));
 const root=path.join(directory,'mba.robin'),fixturePidFile=path.join(directory,'fixture.pid');
 let binary='';
 if(managed){
  binary=path.join(directory,'fixture-engine');
  // Authenticated lifecycle fixture and header-only artifact. These tests never
  // load a real model or claim to validate inference quality.
  await writeFile(binary,'#!'+process.execPath+'\n'+`
const http=require('node:http');
require('node:fs').writeFileSync(process.env.ENZIME_CLI_FIXTURE_PID,String(process.pid));
const port=Number(process.argv[process.argv.indexOf('--port')+1]);
http.createServer((req,res)=>{
 if(req.url!=='/health'&&req.headers.authorization!=='Bearer '+process.env.LLAMA_API_KEY)return res.writeHead(401).end();
 res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(req.url==='/health'?{status:'ok'}:{data:[{id:'cli-lifecycle-fixture'}]}));
}).listen(port,'127.0.0.1');
`,{mode:0o700});
 }
 const child=spawn(process.execPath,[serverFile],{cwd:path.dirname(serverFile),env:{...process.env,MBA_ROBIN_HOME:root,PORT:String(listenPort),ENZIME_LLM_ENDPOINT:'',ENZIME_LLAMA_SERVER_BIN:binary,ENZIME_LLAMA_SERVER_PORT:String(await port()),ENZIME_CLI_FIXTURE_PID:fixturePidFile,REVENUECAT_PURCHASE_URL:''},stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='',exit;
 child.stdout.on('data',chunk=>{stdout=(stdout+chunk.toString()).slice(-16384);});
 child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-16384);});
 const finished=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{exit={code,signal};resolve(exit);});});
 t.after(async()=>{
  let fixturePid;try{fixturePid=Number(await readFile(fixturePidFile,'utf8'));}catch{}
  if(fixturePid){try{process.kill(fixturePid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}}
  if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
  await within(finished,5000,'CLI did not exit during test cleanup').catch(()=>{});
  await rm(directory,{recursive:true,force:true});
 });
 async function ready(){
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){const match=stdout.match(/EnZIME:\s+(http:\/\/127\.0\.0\.1:\d+)/);if(match)return match[1];if(exit)throw Error(`CLI exited before readiness: ${JSON.stringify(exit)} ${stderr}`);await delay(10);}
  throw Error(`CLI did not report readiness: ${stdout} ${stderr}`);
 }
 async function ended(){return within(finished,15000,`CLI failed to exit: ${stderr}`);}
 return{root,child,ready,ended,output:()=>({stdout,stderr})};
}

for(const signal of ['SIGTERM','SIGINT'])test(`CLI ${signal} shuts down its managed child and releases persistent storage`,posixOnly,async t=>{
 const cli=await launch(t,{managed:true}),base=await cli.ready();
 async function post(route,value){const response=await fetch(base+route,{method:'POST',headers:{'X-MBA-Client':'enzime','Content-Type':'application/json'},body:JSON.stringify(value)});const body=await response.json();assert.ok(response.ok,JSON.stringify(body));return body;}
 const header=Buffer.alloc(8);header.write('GGUF');header.writeUInt32LE(3,4);
 const upload=await fetch(base+'/api/assets?kind=model&name=CLI-fixture.gguf',{method:'POST',headers:{'X-MBA-Client':'enzime'},body:header});const asset=await upload.json();assert.equal(upload.status,201);
 const runtime=await post('/api/runtime/start',{assetId:asset.id});assert.equal(runtime.status.state,'ready');const managedPid=runtime.status.pid;assert.ok(Number.isInteger(managedPid)&&managedPid>0);assert.notEqual(managedPid,cli.child.pid);
 const draft=await post('/api/drafts',{title:'Survives CLI shutdown',body:'This user draft must survive a real OS signal.',format:'text'});
 assert.equal(cli.child.kill(signal),true);const exit=await cli.ended();
 assert.equal(exit.signal,null,'CLI handles the OS signal and finishes cleanup before exiting');assert.ok([0,130,143].includes(exit.code),JSON.stringify({...exit,...cli.output()}));
 assert.throws(()=>process.kill(managedPid,0),{code:'ESRCH'},'the owned backend is not orphaned');
 await assert.rejects(access(path.join(cli.root,'.writer.lock')),{code:'ENOENT'},'shutdown removes the writer lock rather than relying on stale-lock recovery');
 const reopened=await openStore(cli.root);try{assert.equal(reopened.getDraft(draft.id).body,'This user draft must survive a real OS signal.');assert.equal(reopened.get(asset.id).size,8);}finally{reopened.close();}
});

test('CLI failed port bind exits with an error and releases the unopened server storage',posixOnly,async t=>{
 const blocker=net.createServer();await new Promise(resolve=>blocker.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>blocker.close(resolve)));
 const cli=await launch(t,{listenPort:blocker.address().port});const exit=await cli.ended();
 assert.equal(exit.signal,null);assert.notEqual(exit.code,0);assert.match(cli.output().stderr,/EADDRINUSE|address already in use/i);
 await assert.rejects(access(path.join(cli.root,'.writer.lock')),{code:'ENOENT'},'failed listen must still close the acquired catalog');
 const reopened=await openStore(cli.root);try{assert.equal(reopened.stats().objects,0);}finally{reopened.close();}
});
