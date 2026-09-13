import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createDynDon} from '../dyndon.mjs';
import {estimateZimBytes,generateZimChunks,generateUncompressedZim} from '../dyndon-zim.mjs';
import {openZim} from '../zim.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const manifest=units=>({id:'review-edition',units});
const required=manifest([{id:'next',size:4,essential:true}]);
const metadata={date:'2026-09-13'};
async function temporary(t){
  const root=await mkdtemp(path.join(tmpdir(),'enzime-dyndon-review-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  return root;
}
async function broker(t,root,options={}){
  const manager=await createDynDon({root,...options});
  t.after(()=>manager.close());
  return manager;
}

// Kill after the producer's next iteration, which is reached only after the
// preceding chunk has been written (and download progress persisted).
async function crashBroker(root,type){
  const source=`
    import {createHash} from 'node:crypto';
    const {createDynDon}=await import(process.argv[1]);
    const root=process.argv[2],type=process.argv[3],data=Buffer.from('abcdef');
    let job;
    async function* interrupted(){
      yield data.subarray(0,3);
      process.send(await manager.getJob(job.id));
      await new Promise(()=>{});
    }
    const manager=await createDynDon({root,allowUrl:()=>true,fetchImpl:async()=>({
      status:200,headers:new Headers({'content-length':'6',etag:'"v1"'}),body:interrupted()
    })});
    const manifest={id:'crashed',units:[{id:'pack',size:6,essential:true,
      sha256:createHash('sha256').update(data).digest('hex'),url:'https://packs.example/a'}]};
    job=await (type==='download'?manager.createDownloadJob(manifest,{capacityBytes:10}):manager.createGenerationJob(manifest,{capacityBytes:10}));
    await (type==='download'?manager.runDownload(job.id):manager.runGeneration(job.id,interrupted()));
  `;
  const child=spawn(process.execPath,['--input-type=module','--eval',source,new URL('../dyndon.mjs',import.meta.url).href,root,type],{stdio:['ignore','ignore','pipe','ipc']});
  let errors='';child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>{errors+=chunk;});
  const exited=once(child,'exit');
  let timer;
  try{
    const state=await new Promise((resolve,reject)=>{
      timer=setTimeout(()=>reject(Error('Crash fixture timed out: '+errors)),10000);
      child.once('message',resolve);child.once('error',reject);
      child.once('exit',(code,signal)=>reject(Error(`Crash fixture exited ${code}/${signal}: ${errors}`)));
    });
    assert.equal(state.status,'running');assert.equal(state.active,true);
    child.kill('SIGKILL');
    const [,signal]=await exited;assert.equal(signal,'SIGKILL');
    return state;
  }finally{
    clearTimeout(timer);
    if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited.catch(()=>{});}
  }
}

test('SIGKILL download recovery persists paused state, reservations and resumable bytes',async t=>{
  const root=await temporary(t),crashed=await crashBroker(root,'download');
  assert.equal(crashed.units[0].bytesReceived,3);
  let requests=0;
  const manager=await broker(t,root,{allowUrl:()=>true,fetchImpl:async(url,options)=>{
    requests++;
    assert.equal(options.headers.Range,'bytes=3-');assert.equal(options.headers['If-Range'],'"v1"');
    return {status:206,headers:new Headers({'content-range':'bytes 3-5/6','content-length':'3'}),body:[Buffer.from('def')]};
  }});
  const recovered=await manager.getJob(crashed.id);
  assert.equal(requests,0);assert.equal(recovered.status,'paused');assert.equal(recovered.active,false);
  assert.equal(recovered.pauseReason,'DYNDON_RESTARTED');assert.equal(recovered.units[0].status,'paused');
  assert.equal(recovered.units[0].bytesReceived,3);assert.equal(recovered.units[0].etag,'"v1"');
  assert.deepEqual(recovered.plan,crashed.plan);
  assert.match(await readFile(path.join(root,'dyndon','jobs',crashed.id+'.json'),'utf8'),/"status": "paused"/);
  assert.deepEqual(await readFile(path.join(root,'dyndon','staging',crashed.id+'-'+hash('pack')+'.part')),Buffer.from('abc'));
  const fixed=await manager.plan(required,{capacityBytes:9});
  assert.equal(fixed.status,'below-minimum');assert.equal(fixed.budget.reservedBytes,6);
  const live=await manager.plan(required,{capacityBytes:7,liveDiskFree:true});
  assert.equal(live.status,'ready');assert.equal(live.budget.reservedBytes,3);
  const done=await manager.resumeDownload(crashed.id);
  assert.equal(done.status,'complete');assert.equal(requests,1);
  assert.deepEqual(await readFile(done.outputs[0].path),Buffer.from('abcdef'));
  assert.equal(done.outputs[0].sha256,hash('abcdef'));
});

test('startup reconciles bytes written after the last saved download snapshot',async t=>{
  const root=await temporary(t),crashed=await crashBroker(root,'download');
  await writeFile(path.join(root,'dyndon','staging',crashed.id+'-'+hash('pack')+'.part'),'abcd');
  let manager=await broker(t,root);
  assert.equal((await manager.getJob(crashed.id)).units[0].bytesReceived,4);
  assert.equal((await manager.plan(required,{capacityBytes:6,liveDiskFree:true})).budget.reservedBytes,2);
  await manager.close();manager=await broker(t,root);
  assert.equal((await manager.getJob(crashed.id)).status,'paused');
  assert.equal((await manager.getJob(crashed.id)).units[0].bytesReceived,4);
});

test('SIGKILL generation recovery discards incomplete bytes and allows reservation release',async t=>{
  const root=await temporary(t),crashed=await crashBroker(root,'generation');
  const staged=path.join(root,'dyndon','staging',crashed.id+'.generated.part');
  assert.deepEqual(await readFile(staged),Buffer.from('abc'));
  const manager=await broker(t,root),recovered=await manager.getJob(crashed.id);
  assert.equal(recovered.status,'paused');assert.equal(recovered.pauseReason,'DYNDON_RESTARTED');
  assert.equal(recovered.active,false);assert.match(recovered.error,/producer or release/);
  await assert.rejects(readFile(staged),{code:'ENOENT'});
  assert.equal((await manager.plan(required,{capacityBytes:9})).budget.reservedBytes,6);
  assert.equal((await manager.releaseJob(crashed.id,{removeFiles:false})).status,'cancelled');
  assert.equal((await manager.releaseJob(crashed.id)).status,'cancelled');
  assert.equal((await manager.plan(required,{capacityBytes:4})).budget.reservedBytes,0);
  assert.equal((await manager.createGenerationJob(required,{capacityBytes:4})).status,'queued');
  await assert.rejects(manager.runGeneration(crashed.id,[Buffer.from('abcdef')]),/released/);
});

test('recovered generation can be rerun with a fresh producer without retaining crash bytes',async t=>{
  const root=await temporary(t),crashed=await crashBroker(root,'generation');
  const manager=await broker(t,root),done=await manager.runGeneration(crashed.id,[Buffer.from('ghijkl')]);
  assert.equal(done.status,'complete');assert.equal(done.generatedBytes,6);
  assert.deepEqual(await readFile(done.outputs[0].path),Buffer.from('ghijkl'));
});

test('safe release is idempotent and preserves an adopted, mounted generated archive',async t=>{
  const root=await temporary(t),manager=await broker(t,root);
  const done=await manager.generateZim([{key:'water',text:'Local reference'}],{capacityBytes:10000,metadata});
  const output=done.outputs[0],bytes=await readFile(output.path),archive=await openZim(output.path);
  try{
    assert.equal((await manager.plan(required,{capacityBytes:10000})).budget.reservedBytes,done.plan.budget.reservationBytes);
    for(let i=0;i<2;i++){
      const released=await manager.releaseJob(done.id,{removeFiles:false});
      assert.equal(released.status,'released');assert.deepEqual(released.outputs,done.outputs);
    }
    assert.deepEqual(await readFile(output.path),bytes);
    assert.equal((await archive.read('C/water')).bytes.toString(),'Local reference');
    assert.equal((await archive.verify()).valid,true);
    assert.equal((await manager.plan(required,{capacityBytes:10000})).budget.reservedBytes,0);
  }finally{await archive.close();}
  const reopened=await openZim(output.path);await reopened.close();
});

test('safe cancellation clears failed transfer staging but keeps already published outputs',async t=>{
  const root=await temporary(t),manager=await broker(t,root,{allowUrl:()=>true,fetchImpl:async url=>({
    status:200,headers:new Headers({'content-length':'3'}),
    body:url.pathname==='/a'?[Buffer.from('aaa')]:(async function*(){yield Buffer.from('b');throw Error('Connection lost');})()
  })});
  const job=await manager.createDownloadJob(manifest(['a','b'].map(id=>({id,size:3,sha256:hash(id.repeat(3)),url:'https://packs.example/'+id}))),{capacityBytes:10});
  await assert.rejects(manager.runDownload(job.id),/Connection lost/);
  const failed=await manager.getJob(job.id);assert.equal(failed.outputs.length,1);
  assert.equal((await readdir(path.join(root,'dyndon','staging'))).length,1);
  const cancelled=await manager.releaseJob(job.id,{removeFiles:false});
  assert.equal(cancelled.status,'cancelled');assert.deepEqual(cancelled.outputs,failed.outputs);
  assert.deepEqual(await readFile(cancelled.outputs[0].path),Buffer.from('aaa'));
  assert.deepEqual(await readdir(path.join(root,'dyndon','staging')),[]);
  assert.equal((await manager.plan(required,{capacityBytes:4})).budget.reservedBytes,0);
});

const invalidMimes=['garbage','text/','/plain','text/plain/extra','text/ plain','text/plain; charset',
  'text/plain; charset=','text/plain; charset="unfinished','text/plain; charset=utf 8',
  'text/plain\n','text/plain\0','text/plain;\tcharset=utf-8','text/pl\u00e4in','*/*','text/*',''];
for(const mime of invalidMimes)test(`invalid MIME ${JSON.stringify(mime)} fails before any chunk, job or reservation`,async t=>{
  const records=[{key:'bad',mime,text:'Invalid input'}];
  assert.throws(()=>estimateZimBytes(records,metadata),/MIME/);
  assert.throws(()=>generateZimChunks(records,metadata).next(),/MIME/);
  const root=await temporary(t),manager=await broker(t,root);
  await assert.rejects(manager.generateZim(records,{capacityBytes:10000,metadata}),/MIME/);
  assert.deepEqual(await manager.listJobs(),[]);
  assert.deepEqual(await readdir(path.join(root,'dyndon','editions')),[]);
  assert.equal((await manager.plan(required,{capacityBytes:4})).budget.reservedBytes,0);
});

test('all C0 key controls, replacement characters and unpaired surrogates fail before planning',async t=>{
  const root=await temporary(t),manager=await broker(t,root);
  const keys=[...Array.from({length:32},(_,i)=>'C/bad'+String.fromCharCode(i)+'key'),'C/\ufffd','C/\ud800','C/',''];
  for(const key of keys){
    const records=[{key,text:'Invalid key'}];
    assert.throws(()=>estimateZimBytes(records,metadata),/key|nonempty/);
    assert.throws(()=>generateZimChunks(records,metadata).next(),/key|nonempty/);
    await assert.rejects(manager.generateZim(records,{capacityBytes:10000,metadata}),/key|nonempty/);
  }
  assert.deepEqual(await manager.listJobs(),[]);
  assert.deepEqual(await readdir(path.join(root,'dyndon','editions')),[]);
});

test('duplicate canonical keys and oversized directory entries fail before reserving a job',async t=>{
  const root=await temporary(t),manager=await broker(t,root);
  for(const [records,error] of [
    [[{id:'one',key:'C/water',text:'one'},{id:'two',key:'water',text:'two'}],/unique/],
    [[{key:'k'.repeat(33000),text:'large directory'}],/directory entry/],
    [[{key:'small',title:'t'.repeat(65530),text:'large directory'}],/directory entry/]
  ]){
    await assert.rejects(manager.generateZim(records,{capacityBytes:1000000,metadata}),error);
    assert.deepEqual(await manager.listJobs(),[]);
  }
});

test('case-insensitive MIME types with token and quoted parameters reopen and select a main page',async t=>{
  const root=await temporary(t),manager=await broker(t,root);
  for(const [mime,expected] of [
    ['TEXT/HTML;Charset="UTF-8"','text/html;Charset="UTF-8"'],
    ['Text/Plain ; charset=UTF-8','text/plain; charset=UTF-8'],
    ['APPLICATION/XHTML+XML; title="a; b"; note="a\\"b"','application/xhtml+xml; title="a; b"; note="a\\"b"']
  ]){
    const records=[{key:'C/reference',mime,text:'Readable reference'}];
    const done=await manager.generateZim(records,{capacityBytes:100000,metadata});
    assert.equal(done.outputs[0].size,estimateZimBytes(records,metadata));
    const archive=await openZim(done.outputs[0].path);
    try{
      assert.equal(archive.metadata().mainPage,'C/reference');
      assert.equal((await archive.list()).length,1);
      const article=await archive.read('C/reference');
      assert.equal(article.mime,expected);assert.equal(article.bytes.toString(),'Readable reference');
      assert.equal((await archive.verify()).valid,true);
    }finally{await archive.close();}
  }
});

test('fallback article keys remain stable and estimates fit when preceding records are omitted',async t=>{
  const root=await temporary(t),manager=await broker(t,root);
  const records=Array.from({length:11},(_,i)=>({text:'Article '+(i+1),domain:i===10?'Selected':'Omitted'}));
  const capacityBytes=estimateZimBytes([{...records[10],key:'article-11'}],metadata);
  const done=await manager.generateZim(records,{capacityBytes,selectedDomains:['Selected'],metadata});
  assert.equal(done.outputs[0].size,capacityBytes);
  const archive=await openZim(done.outputs[0].path);
  try{assert.equal((await archive.read('C/article-11')).bytes.toString(),'Article 11');}
  finally{await archive.close();}
});

test('writer rejects MIME tables larger than the reader can open',()=>{
  const records=Array.from({length:20},(_,i)=>({key:'article-'+i,mime:'text/plain; label="'+String(i).padStart(2,'0')+'a'.repeat(55000)+'"',text:'x'}));
  assert.throws(()=>generateUncompressedZim(records,metadata),/MIME table/);
});
