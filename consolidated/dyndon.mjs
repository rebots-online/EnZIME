import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,unlink,stat,readdir,open,statfs} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {estimateZimBytes,generateZimChunks} from './dyndon-zim.mjs';

const sha256=value=>createHash('sha256').update(value).digest('hex');
const byId=(a,b)=>a.id.localeCompare(b.id,'en');
function bytes(value,name,fallback=0){value=value??fallback;if(!Number.isSafeInteger(value)||value<0)throw Error(`${name} must be a nonnegative safe integer`);return value;}
function validateManifest(manifest){
  if(!manifest || !Array.isArray(manifest.units) || manifest.units.length>100000)throw Error('A manifest of complete content units is required');
  const ids=new Set();
  const units=manifest.units.map(u=>{
    if(typeof u.id!=='string'||!u.id||u.id.length>512||ids.has(u.id))throw Error('Manifest unit IDs must be unique and nonempty');ids.add(u.id);
    if(u.sha256!==undefined&&!/^[a-f\d]{64}$/i.test(u.sha256))throw Error(`Invalid SHA-256 for ${u.id}`);
    if(u.dependencies!==undefined&&(!Array.isArray(u.dependencies)||u.dependencies.some(x=>typeof x!=='string')))throw Error(`Invalid dependencies for ${u.id}`);
    return {...u,size:bytes(u.size,`${u.id} size`),temporaryBytes:bytes(u.temporaryBytes,`${u.id} temporaryBytes`),depth:bytes(u.depth,`${u.id} depth`),domain:String(u.domain||'General'),topic:String(u.topic||u.domain||'General'),dependencies:[...(u.dependencies||[])],sha256:u.sha256?.toLowerCase()};
  }).sort(byId);
  for(const u of units)for(const dep of u.dependencies)if(!ids.has(dep))throw Error(`Missing dependency ${dep} required by ${u.id}`);
  return units;
}

/** Plan complete prepared editions/pack units. No arbitrary truncation of ZIM bytes. */
export function planDynDon(manifest,options={}){
  const units=validateManifest(manifest),map=new Map(units.map(u=>[u.id,u]));
  const capacityBytes=bytes(options.capacityBytes,'capacityBytes');
  const installedBytes=bytes(options.installedBytes,'installedBytes'),modelBytes=bytes(options.modelBytes,'modelBytes'),cacheBytes=bytes(options.cacheBytes,'cacheBytes'),reserveBytes=bytes(options.reserveBytes,'reserveBytes'),temporaryBytes=bytes(options.temporaryBytes,'temporaryBytes'),reservedBytes=bytes(options.reservedBytes,'reservedBytes');
  const usedBytes=installedBytes+modelBytes+cacheBytes+reserveBytes+reservedBytes;
  if(!Number.isSafeInteger(usedBytes))throw Error('Storage accounting exceeds safe integer precision');
  const freeBytes=Math.max(0,capacityBytes-usedBytes);
  const desiredBytes=bytes(options.desiredBytes,'desiredBytes',freeBytes);
  const limit=Math.min(freeBytes,desiredBytes);
  const installed=new Set(options.installedIds||[]),pinned=new Set(options.pinnedIds||[]);
  for(const id of pinned)if(!map.has(id))throw Error(`Pinned unit ${id} is absent from this manifest`);
  const domains=options.selectedDomains?.length?new Set(options.selectedDomains):null;
  const maxDepth=options.maxDepth===undefined?Number.MAX_SAFE_INTEGER:bytes(options.maxDepth,'maxDepth');
  const breadth=options.breadth??1;if(typeof breadth!=='number'||!Number.isFinite(breadth)||breadth<0||breadth>1)throw Error('breadth must be between 0 and 1');
  function closure(ids){const result=new Set(),visiting=new Set();function visit(id){if(result.has(id))return;if(visiting.has(id))throw Error(`Dependency cycle at ${id}`);visiting.add(id);for(const dep of map.get(id).dependencies)visit(dep);visiting.delete(id);result.add(id);}for(const id of ids)visit(id);return result;}
  // Validate all dependency cycles, including omitted units.
  closure(units.map(u=>u.id));
  function cost(ids){let final=0,peak=0;const groups=new Set();for(const id of ids){const u=map.get(id);if(u.editionGroup){if(groups.has(u.editionGroup))return {fits:false,final:Infinity,peak:Infinity,total:Infinity};groups.add(u.editionGroup);}if(!installed.has(id)){final+=u.size;peak=Math.max(peak,u.temporaryBytes);}}return {fits:true,final,peak:temporaryBytes+peak,total:final+temporaryBytes+peak};}
  const required=closure(units.filter(u=>u.essential||u.pinned||pinned.has(u.id)).map(u=>u.id));
  const minimum=cost(required);if(!minimum.fits)throw Error('Protected units require conflicting editions');
  const selected=new Set();const reasons=new Map();
  const belowMinimum=minimum.total>limit;
  if(!belowMinimum){for(const id of required)selected.add(id);
    const candidates=units.filter(u=>!selected.has(u.id)&&(!domains||domains.has(u.domain))&&u.depth<=maxDepth);
    const rank=(a,b)=>{if(breadth>=0.5&&a.depth!==b.depth)return a.depth-b.depth;return (Number(b.priority)||0)-(Number(a.priority)||0)||a.depth-b.depth||a.size-b.size||byId(a,b);};
    let ordered;
    if(breadth===0)ordered=candidates.sort(rank);
    else {
      // Round-robin domains, then topics within each domain. Sort each topic once;
      // do not repeatedly sort/rebuild an entire corpus during a phone preview.
      const groups=new Map();for(const u of candidates){if(!groups.has(u.domain))groups.set(u.domain,new Map());const topics=groups.get(u.domain);if(!topics.has(u.topic))topics.set(u.topic,[]);topics.get(u.topic).push(u);}
      const rotations=[...groups].sort(([a],[b])=>a.localeCompare(b,'en')).map(([,topics])=>({at:0,topics:[...topics].sort(([a],[b])=>a.localeCompare(b,'en')).map(([,items])=>({at:0,items:items.sort(rank)}))}));
      ordered=[];while(ordered.length<candidates.length)for(const domain of rotations){for(let attempt=0;attempt<domain.topics.length;attempt++){const topic=domain.topics[domain.at++%domain.topics.length];if(topic.at<topic.items.length){ordered.push(topic.items[topic.at++]);break;}}}
      if(breadth<1){const queues=[candidates.slice().sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0)||a.depth-b.depth||a.size-b.size||byId(a,b)),ordered];const positions=[0,0],seen=new Set(),mixed=[];for(let i=0;i<candidates.length;i++){const lane=Math.floor((i+1)*breadth)>Math.floor(i*breadth)?1:0;while(seen.has(queues[lane][positions[lane]]?.id))positions[lane]++;const next=queues[lane][positions[lane]++];seen.add(next.id);mixed.push(next);}ordered=mixed;}
    }
    let currentFinal=minimum.final,currentPeak=minimum.peak;
    const editionGroups=new Set([...selected].map(id=>map.get(id).editionGroup).filter(Boolean));
    for(const candidate of ordered){
      if(selected.has(candidate.id))continue;
      const added=[...closure([candidate.id])].filter(id=>!selected.has(id));let nextFinal=currentFinal,nextPeak=currentPeak,conflict=false;const addedGroups=new Set();
      for(const id of added){const u=map.get(id);if(u.editionGroup){if(editionGroups.has(u.editionGroup)||addedGroups.has(u.editionGroup)){conflict=true;break;}addedGroups.add(u.editionGroup);}if(!installed.has(id)){nextFinal+=u.size;nextPeak=Math.max(nextPeak,temporaryBytes+u.temporaryBytes);}}
      if(!conflict&&nextFinal+nextPeak<=limit){for(const id of added)selected.add(id);for(const group of addedGroups)editionGroups.add(group);currentFinal=nextFinal;currentPeak=nextPeak;}else reasons.set(candidate.id,conflict?'edition-conflict':'budget');
    }
  }
  const selectedUnits=units.filter(u=>selected.has(u.id)).map(u=>({...u,installed:installed.has(u.id),protected:required.has(u.id)}));
  const omitted=units.filter(u=>!selected.has(u.id)).map(u=>({id:u.id,title:u.title||u.id,domain:u.domain,topic:u.topic,size:u.size,reason:belowMinimum?'below-minimum':domains&&!domains.has(u.domain)?'domain-filter':u.depth>maxDepth?'depth-limit':reasons.get(u.id)||'budget'}));
  const chosen=cost(selected);
  const coverageMap=new Map();for(const u of units){
    if(!coverageMap.has(u.domain))coverageMap.set(u.domain,{domain:u.domain,selectedUnits:0,totalUnits:0,selectedTopics:new Set(),totalTopics:new Set(),articleCount:0,selectedBytes:0});
    const c=coverageMap.get(u.domain);c.totalUnits++;c.totalTopics.add(u.topic);if(selected.has(u.id)){c.selectedUnits++;c.selectedTopics.add(u.topic);c.articleCount+=Number(u.articleCount)||0;c.selectedBytes+=u.size;}
  }
  const coverage=[...coverageMap.values()].sort((a,b)=>a.domain.localeCompare(b.domain,'en')).map(c=>({...c,selectedTopics:c.selectedTopics.size,totalTopics:c.totalTopics.size,complete:c.selectedUnits===c.totalUnits}));
  const result={version:1,manifestId:manifest.id||'edition',manifestVersion:manifest.version||'1',status:belowMinimum?'below-minimum':selectedUnits.length?'ready':'empty',selected:selectedUnits,omitted,coverage,budget:{capacityBytes,installedBytes,modelBytes,cacheBytes,reserveBytes,reservedBytes,freeBytes,desiredBytes,limitBytes:limit,newBytes:chosen.final,temporaryBytes:chosen.peak,reservationBytes:belowMinimum?0:chosen.total,minimumRequiredBytes:minimum.total,remainingBytes:Math.max(0,limit-chosen.total)},message:belowMinimum?'The protected dependency-complete minimum does not fit. Increase the budget or choose a smaller prepared edition.':selectedUnits.length?'Ready: only complete dependency-resolved units will be acquired.':'No complete content unit fits these controls.'};
  result.planId=sha256(JSON.stringify(result));return result;
}

async function hashFile(file,signal,activity=()=>{}){const digest=createHash('sha256');for await(const chunk of createReadStream(file,{signal})){digest.update(chunk);activity();}return digest.digest('hex');}
async function exists(file){try{return await stat(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function atomicJson(file,data){const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(data,null,2),{mode:0o600});await rename(tmp,file);}
const jobId=id=>{if(!/^[\da-f-]{36}$/.test(id))throw Error('Invalid DynDon job ID');return id;};
function abortable(promise,signal){return new Promise((resolve,reject)=>{const stop=()=>reject(signal.reason||Error('Download aborted'));if(signal.aborted){Promise.resolve(promise).catch(()=>{});stop();return;}signal.addEventListener('abort',stop,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',stop));});}
async function* readTransfer(body,signal){if(!body)throw Error('Download response has no body');const iterator=body[Symbol.asyncIterator]?.()||body[Symbol.iterator]?.();if(!iterator)throw Error('Invalid response body');try{for(;;){const next=await abortable(iterator.next(),signal);if(next.done)return;yield next.value;}}finally{if(iterator.return)Promise.resolve(iterator.return()).catch(()=>{});}}

/** A single broker owns this manager. Reservations and progress survive restarts. */
export async function createDynDon({root,allowUrl=()=>false,fetchImpl=fetch,transferTimeoutMs=30000}={}){
  if(!root)throw Error('DynDon storage root is required');
  if(!Number.isSafeInteger(transferTimeoutMs)||transferTimeoutMs<10||transferTimeoutMs>300000)throw Error('Transfer timeout must be 10–300000 milliseconds');
  const home=path.join(root,'dyndon'),jobsDir=path.join(home,'jobs'),stageDir=path.join(home,'staging'),outputDir=path.join(home,'editions');
  for(const dir of [jobsDir,stageDir,outputDir])await mkdir(dir,{recursive:true});
  let queue=Promise.resolve(),closed=false;const running=new Set(),controllers=new Map(),tasks=new Map();
  const serial=fn=>{const work=queue.then(fn,fn);queue=work.catch(()=>{});return work;};
  const save=job=>{delete job.active;job.updatedAt=new Date().toISOString();return atomicJson(path.join(jobsDir,job.id+'.json'),job);};
  const getJob=async id=>{const job=JSON.parse(await readFile(path.join(jobsDir,jobId(id)+'.json'),'utf8'));return {...job,active:running.has(id)};};
  async function listJobs(){const names=(await readdir(jobsDir)).filter(x=>/^[a-f\d-]{36}\.json$/.test(x));return Promise.all(names.map(x=>getJob(x.slice(0,-5))));}
  async function allocatedBytes(job){const files=new Set((job.outputs||[]).map(o=>o.path));for(const name of await readdir(stageDir))if(name.startsWith(job.id+'-')||name===job.id+'.generated.part')files.add(path.join(stageDir,name));let total=0;for(const file of files)total+=(await exists(file))?.size||0;return total;}
  async function outstandingBytes(job){return ['complete','released','cancelled'].includes(job.status)?0:Math.max(0,job.plan.budget.reservationBytes-await allocatedBytes(job));}
  async function accountedOptions(options,exclude){const jobs=await listJobs();let reserved=0;for(const j of jobs){if(j.id===exclude||['cancelled','released'].includes(j.status))continue;reserved+=options.liveDiskFree?await outstandingBytes(j):j.plan.budget.reservationBytes;}return {...options,reservedBytes:bytes(options.reservedBytes,'reservedBytes')+reserved};}
  async function diskCheck(job){const disk=await statfs(root);const free=Number(disk.bavail)*Number(disk.bsize);let needed=await outstandingBytes(job);for(const other of await listJobs())if(other.id!==job.id)needed+=await outstandingBytes(other);needed+=job.plan.budget.reserveBytes;if(free<needed)throw Error('Insufficient actual disk space for the reserved peak and safety margin');}
  async function createJob(type,manifest,options){return serial(async()=>{
    if(closed)throw Error('DynDon manager is closed');
    const plan=planDynDon(manifest,await accountedOptions(options));
    if(plan.status!=='ready')throw Object.assign(Error(plan.message),{plan});
    if(type==='download')for(const u of plan.selected.filter(u=>!u.installed)){if(!u.sha256||!u.url)throw Error(`Download unit ${u.id} requires SHA-256 and URL`);await allowed(u.url);}
    const job={id:randomUUID(),type,status:'queued',createdAt:new Date().toISOString(),options,manifest,plan,units:plan.selected.filter(u=>!u.installed).map(u=>({id:u.id,status:'queued',bytesReceived:0})),outputs:[],error:null};
    await diskCheck(job);await save(job);return job;
  });}
  async function allowed(raw){let url;try{url=new URL(raw);}catch{throw Error('Invalid download URL');}if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.hash||!(await allowUrl(url)))throw Error('Download endpoint is not allowed');return url;}
  async function fetchSafe(raw,headers,signal){let url=await allowed(raw);for(let hops=0;hops<=5;hops++){
    signal.throwIfAborted();const response=await abortable(fetchImpl(url,{headers,redirect:'manual',signal}),signal);
    if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Redirect has no destination');url=await allowed(new URL(location,url).href);continue;}
    return response;
  }throw Error('Too many download redirects');}
  async function transfer(job,u,progress,parentSignal){
    const stalled=new AbortController(),signal=AbortSignal.any([parentSignal,stalled.signal]);let timer;
    const activity=()=>{clearTimeout(timer);timer=setTimeout(()=>stalled.abort(Object.assign(Error('Download stalled; partial bytes retained for resume'),{code:'DYNDON_TIMEOUT'})),transferTimeoutMs);};
    activity();try{return await transferContent(job,u,progress,signal,activity);}finally{clearTimeout(timer);}
  }
  async function transferContent(job,u,progress,signal,activity){
    const staged=path.join(stageDir,job.id+'-'+sha256(u.id)+'.part');
    const final=path.join(outputDir,job.id+'-'+u.sha256+'.'+(u.kind==='zim'||u.format==='zim'?'zim':'ezpack'));
    const finished=await exists(final);
    if(finished&&finished.size===u.size&&await hashFile(final,signal,activity)===u.sha256){progress.status='complete';progress.bytesReceived=u.size;progress.path=final;return {id:u.id,path:final,sha256:u.sha256,size:u.size,kind:u.kind||u.format||'pack',title:u.title||u.id};}
    const part=await exists(staged);let offset=part?.size||0;if(offset>u.size){await unlink(staged);offset=0;}progress.bytesReceived=offset;if(!u.size&&!part)await writeFile(staged,Buffer.alloc(0),{mode:0o600});
    if(offset<u.size){
      const headers={'Accept-Encoding':'identity'};if(offset){headers.Range=`bytes=${offset}-`;if(progress.etag)headers['If-Range']=progress.etag;}
      const response=await fetchSafe(u.url,headers,signal);activity();
      if(response.status!==200&&response.status!==206){await response.body?.cancel();throw Error(`Download HTTP ${response.status}`);}
      if(response.headers.get('content-encoding')&&response.headers.get('content-encoding')!=='identity'){await response.body?.cancel();throw Error('Encoded range bodies are not supported');}
      if(response.status===206){const match=response.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);if(!match||Number(match[1])!==offset||Number(match[2])!==u.size-1||Number(match[3])!==u.size){await response.body?.cancel();throw Error('Invalid Content-Range for the manifest');}}
      else offset=0; // A server ignoring Range must restart, never append a second file.
      const length=response.headers.get('content-length');if(length!==null&&Number(length)!==u.size-offset){await response.body?.cancel();throw Error('Content-Length differs from the manifest');}
      progress.etag=response.headers.get('etag')||null;progress.status='downloading';progress.bytesReceived=offset;await save(job);
      const file=await open(staged,offset?'a':'w',0o600);try{
        for await(const raw of readTransfer(response.body,signal)){activity();const chunk=Buffer.from(raw);if(offset+chunk.length>u.size)throw Error('Downloaded bytes exceed the reserved manifest size');signal.throwIfAborted();await file.writeFile(chunk);offset+=chunk.length;progress.bytesReceived=offset;await save(job);}
        await file.sync();
      }finally{await file.close();}
    }
    if(offset!==u.size)throw Error('Download interrupted before the declared size; progress retained for resume');
    progress.status='verifying';await save(job);activity();if(await hashFile(staged,signal,activity)!==u.sha256){await unlink(staged);progress.bytesReceived=0;progress.status='integrity-failed';throw Error(`SHA-256 integrity verification failed for ${u.id}`);}
    signal.throwIfAborted();
    await rename(staged,final);progress.status='complete';progress.path=final;progress.bytesReceived=u.size;
    return {id:u.id,path:final,sha256:u.sha256,size:u.size,kind:u.kind||u.format||'pack',title:u.title||u.id};
  }
  function runDownload(id){if(closed)return Promise.reject(Error('DynDon manager is closed'));if(running.has(id))return Promise.reject(Error('Job is already running'));jobId(id);running.add(id);const controller=new AbortController();controllers.set(id,controller);
    const task=(async()=>{let job;
    try{job=await getJob(id);if(job.type!=='download')throw Error('Not a download job');if(['cancelled','released'].includes(job.status))throw Error('Job has been released');if(job.status==='complete')return job;await diskCheck(job);job.status='running';job.error=null;await save(job);
      for(const progress of job.units){controller.signal.throwIfAborted();const unit=job.plan.selected.find(u=>u.id===progress.id);const result=await transfer(job,unit,progress,controller.signal);job.outputs=job.outputs.filter(x=>x.id!==unit.id);job.outputs.push(result);await save(job);}
      job.status='complete';await save(job);return job;
    }catch(error){const e=controller.signal.aborted?controller.signal.reason:error;if(job&&!['cancelled','released','complete'].includes(job.status)){job.status='paused';job.error=e.message;job.pauseReason=e.code||'DYNDON_TRANSFER_ERROR';for(const unit of job.units)if(['downloading','verifying'].includes(unit.status))unit.status='paused';await save(job);}throw Object.assign(e,{jobId:id});}finally{running.delete(id);controllers.delete(id);tasks.delete(id);}
    })();tasks.set(id,task);return task;
  }
  async function pauseDownload(id){jobId(id);const controller=controllers.get(id);if(controller){controller.abort(Object.assign(Error('Download paused; partial bytes retained for resume'),{code:'DYNDON_PAUSED'}));await tasks.get(id)?.catch(()=>{});return getJob(id);}return serial(async()=>{const job=await getJob(id);if(job.type!=='download')throw Error('Not a download job');if(['queued','running'].includes(job.status)){job.status='paused';job.pauseReason='DYNDON_PAUSED';job.error=null;await save(job);}return job;});}
  async function close(){closed=true;for(const controller of controllers.values())controller.abort(Object.assign(Error('Download paused because the broker closed'),{code:'DYNDON_CLOSED'}));await Promise.allSettled([...tasks.values()]);await queue;}
  async function runGeneration(id,producer,{extension='zim',kind='zim'}={}){
    if(closed)throw Error('DynDon manager is closed');if(running.has(id))throw Error('Job is already running');running.add(id);let job;const staged=path.join(stageDir,jobId(id)+'.generated.part');
    try{job=await getJob(id);if(job.type!=='generation')throw Error('Not a generation job');if(['cancelled','released'].includes(job.status))throw Error('Job has been released');if(job.status==='complete')return job;await diskCheck(job);job.status='running';job.error=null;await save(job);
      if(!/^[a-z\d]{1,12}$/.test(extension))throw Error('Invalid generated edition extension');const file=await open(staged,'w',0o600);let size=0;const digest=createHash('sha256');
      try{for await(const raw of producer){const chunk=Buffer.from(raw);if(size+chunk.length>job.plan.budget.newBytes)throw Error('Generation exceeded its estimated bytes; reservation cannot be overrun');await file.writeFile(chunk);digest.update(chunk);size+=chunk.length;}await file.sync();}finally{await file.close();}
      const hash=digest.digest('hex'),final=path.join(outputDir,job.id+'-'+hash+'.'+extension);await rename(staged,final);job.outputs=[{id:job.manifest.id||job.id,path:final,sha256:hash,size,kind,title:job.manifest.title||'Generated edition'}];job.status='complete';job.generatedBytes=size;await save(job);return job;
    }catch(e){await unlink(staged).catch(()=>{});if(job&&!['cancelled','released','complete'].includes(job.status)){job.status='paused';job.error=e.message;await save(job);}throw Object.assign(e,{jobId:id});}finally{running.delete(id);}
  }
  async function generateZim(records,options={}){
    if(!Array.isArray(records)||records.length>50000)throw Error('Generation requires at most 50,000 article records');
    const {metadata={},...budgetOptions}=options;
    const fixed=estimateZimBytes([],metadata);
    const manifest={id:options.id||'generated-zim',version:'1',title:metadata.title||'EnZIME generated edition',units:[{id:'__zim_structure__',domain:'Edition metadata',topic:'Metadata',size:fixed,essential:true},...records.map((record,i)=>({id:String(record.id||record.key||`article-${i+1}`),title:record.title,domain:record.domain,topic:record.topic,depth:record.depth,priority:record.priority,pinned:record.pinned,essential:record.essential,dependencies:record.dependencies||[],articleCount:1,size:estimateZimBytes([record],metadata)-fixed}))]};
    const job=await createJob('generation',manifest,budgetOptions);
    const selected=new Set(job.plan.selected.map(u=>u.id));const picked=records.filter((r,i)=>selected.has(String(r.id||r.key||`article-${i+1}`)));
    if(!picked.length){await releaseJob(job.id);throw Error('No complete article fits the generation budget');}
    // MIME-list deduplication only decreases the conservative sum of per-record estimates.
    return runGeneration(job.id,generateZimChunks(picked,metadata));
  }
  async function releaseJob(id,{removeFiles=false}={}){return serial(async()=>{if(running.has(id))throw Error('Cannot release a running job');const job=await getJob(id);
    if(!removeFiles&&job.outputs.length)throw Error('Move or import outputs, then release with removeFiles:true');
    if(removeFiles)for(const output of job.outputs)await unlink(output.path).catch(e=>{if(e.code!=='ENOENT')throw e;});
    for(const name of await readdir(stageDir))if(name.startsWith(job.id))await unlink(path.join(stageDir,name));
    job.status=job.status==='complete'?'released':'cancelled';await save(job);return job;
  });}
  return {plan:(manifest,options={})=>serial(async()=>planDynDon(manifest,await accountedOptions(options))),createDownloadJob:(manifest,options={})=>createJob('download',manifest,options),createGenerationJob:(manifest,options={})=>createJob('generation',manifest,options),runDownload,resumeDownload:runDownload,pauseDownload,close,runGeneration,getJob,listJobs,releaseJob,generateZim,
    async startDownload(manifest,options={}){const job=await createJob('download',manifest,options);return runDownload(job.id);}};
}
