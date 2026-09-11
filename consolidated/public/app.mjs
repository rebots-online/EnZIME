import DOMPurify from 'dompurify';
import {mountMesh} from './mesh.mjs';
const $=id=>document.getElementById(id);
const state={assets:[],current:null,source:null,pdf:null,page:1,key:'',font:19,view:'library',filter:'all',settings:{},history:[],messages:[],evidence:[],draft:null,manifest:null,plan:null,entriesOffset:0,opening:0,rendering:0};
let graph,renderTask,chatAbort,saveTimer,downloadTimer,downloadSnapshot='',entryQuery='',pdfTextMode=false,pdfSearchPage=1;
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
const report=e=>status(e.message||String(e),true);
const run=fn=>(...args)=>{try{return Promise.resolve(fn(...args)).catch(report);}catch(error){report(error);return Promise.resolve();}};
async function api(url,options){const res=await fetch(url,options);if(!res.ok){const x=await res.json().catch(()=>({error:`Request failed (${res.status})`}));throw Error(x.error);}return res.json();}
const post=value=>({method:'POST',headers:{'X-MBA-Client':'enzime','Content-Type':'application/json'},body:JSON.stringify(value)});
const bytes=n=>{if(!Number.isFinite(n))return '—';const units=['B','KiB','MiB','GiB','TiB'];let i=0;while(n>=1024&&i<4){n/=1024;i++;}return `${n.toFixed(i?1:0)} ${units[i]}`;};
function el(tag,attrs={},...children){const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==='class')n.className=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(v!==undefined&&v!==null)n.setAttribute(k,String(v));}for(const c of children.flat())if(c!==null&&c!==undefined)n.append(c instanceof Node?c:document.createTextNode(String(c)));return n;}
function show(view){clearTimeout(downloadTimer);state.view=view;document.querySelectorAll('.view').forEach(n=>n.classList.toggle('active',n.id===`view-${view}`));document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===view));if(view==='mesh')refreshGraph().catch(report);if(view==='create')loadDrafts().catch(report);if(view==='settings'){loadSettings().catch(report);loadRuntime().catch(report);}if(view==='downloads')loadDownloads().catch(report);}
function companion(open=true,tab='ask'){$('companion').classList.toggle('closed',!open);if(open){selectTab(tab);loadChatHistory().catch(report);}}
function selectTab(tab){document.querySelectorAll('.panel-tabs button').forEach(n=>n.classList.toggle('selected',n.dataset.tab===tab));document.querySelectorAll('.tab-panel').forEach(n=>n.classList.toggle('active',n.id===`tab-${tab}`));if(tab==='notes')refreshNotes().catch(report);}
function download(name,data,type='application/json'){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=el('a',{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function settings(value){state.settings=await api('/api/settings',post(value));}
async function refresh(){state.assets=await api('/api/assets');drawLibrary();await refreshStats();}
function drawLibrary(){
 const filtered=state.assets.filter(a=>state.filter==='all'||state.filter==='books'&&['pdf','epub','final','html'].includes(a.kind)||a.kind===state.filter);
 $('library-count').textContent=`${filtered.length} ${filtered.length===1?'work':'works'}`;
 $('library-empty').hidden=state.assets.length>0;
 $('library-grid').replaceChildren(...filtered.map(a=>{
  const cover=el('div',{class:'work-cover','data-kind':a.kind},el('span',{class:'format-mark'},({zim:'▤',pdf:'▱',epub:'▱',model:'◌',final:'✎',html:'⌘',audio:'♫',video:'▷'}[a.kind]||'▤')),el('span',{class:'format-name'},a.kind.toUpperCase()));
  return el('article',{class:'work-card'},cover,el('div',{class:'work-content'},el('div',{class:'work-meta'},a.kind==='zim'?'OFFLINE ARCHIVE':a.kind==='model'?'LOCAL INTELLIGENCE':'PERSONAL LIBRARY',el('span',{},bytes(a.size))),el('h3',{},a.name),el('button',{onclick:run(()=>openAsset(a))},a.kind==='model'?'Use this model ↗':'Open work →'),el('span',{class:'asset-storage'},a.storage==='missing'?'Source bytes need restoring':a.storage==='mounted'?'Linked to original file':'Stored on this device')));
 }));
}
async function refreshStats(){
 const x=await api('/api/stats'),s=x.storage,k=x.knowledge;
 $('asset-count').replaceChildren(String(state.assets.filter(a=>a.kind!=='model').length),el('small',{},'works'));
 $('library-size').textContent=`${bytes(s.managedBytes+s.mountedBytes)} · ${bytes(x.freeBytes)} free`;
 $('source-count').replaceChildren(String(k.activeSources??k.sources??0),el('small',{},'sources'));
 $('note-count').replaceChildren(String(s.annotations),el('small',{},'notes'));
 $('storage-details').textContent=`${bytes(s.managedBytes)} stored · ${bytes(s.mountedBytes)} linked · ${s.editions} editions. Retrieval caches are disposable; originals and notes persist.`;
 $('budget-used').style.width=`${Math.min(100,s.managedBytes/(+$('budget').value*1024**3)*100)}%`;
 $('budget-info').textContent=`${bytes(s.managedBytes)} installed · ${bytes(x.freeBytes)} free on disk · 64 MiB safety reserve`;
}
async function savePlace(){if(!state.current)return;const prior=await api(`/api/state/${state.current.id}`);await api(`/api/state/${state.current.id}`,post({...prior,page:state.page,key:state.key,font:state.font,scroll:$('reading').scrollTop}));}
async function openAsset(item,{key='',page,remember=true}={}){
 if(item.kind==='model'){show('settings');status('Model file linked. Select a running model, or start the configured local engine.');return;}
 if(item.storage==='missing')throw Error('This backup contains metadata only. Re-import the original file to restore reading.');
 if(remember&&state.current)state.history.push({item:state.current,key:state.key,page:state.page});
 const ticket=++state.opening;state.rendering++;renderTask?.cancel();const old=state.pdf;state.pdf=null;await old?.loadingTask.destroy();if(ticket!==state.opening)return;
 state.current=item;state.source=null;state.key=key;show('reader');$('work-title').textContent=item.name;$('reader-kind').textContent=item.kind.toUpperCase()+' · SOURCE READER';$('pdf-tools').hidden=true;$('entry-search-form').hidden=item.kind!=='zim';$('more-entries').hidden=true;$('entry-list').replaceChildren();$('reading').replaceChildren(el('div',{class:'empty-state'},'Opening your source…'));status(`Opening ${item.name}…`);
 const saved=await api(`/api/state/${item.id}`);if(ticket!==state.opening)return;state.page=page||saved.page||1;state.font=saved.font||19;state.key=key||saved.key||'';
 if(item.kind==='pdf'){
  const moduleUrl='/vendor/pdfjs/build/pdf.mjs';const lib=await import(moduleUrl);lib.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/build/pdf.worker.mjs';
  const pdf=await lib.getDocument({url:`/api/assets/${item.id}/bytes`,cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',wasmUrl:'/vendor/pdfjs/wasm/',isEvalSupported:false,enableXfa:false}).promise;
  if(ticket!==state.opening){await pdf.loadingTask.destroy();return;}state.pdf=pdf;state.pdfLib=lib;$('pdf-tools').hidden=false;await drawPdf();
  const outline=await pdf.getOutline();if(ticket!==state.opening)return;
  function outlineNodes(items){return items.flatMap(i=>[el('button',{class:'entry',onclick:run(async()=>{let dest=i.dest;if(typeof dest==='string')dest=await pdf.getDestination(dest);if(!dest)return;state.page=(typeof dest[0]==='object'?await pdf.getPageIndex(dest[0]):dest[0])+1;await drawPdf();})},i.title),...(i.items?outlineNodes(i.items):[])]);}
  $('entry-list').replaceChildren(...(outline?.length?outlineNodes(outline):[el('p',{class:'muted'},'This PDF has no embedded outline. Use the page controls or find text.')]));
 }else if(['audio','video'].includes(item.kind)){
  const media=el(item.kind,{controls:'',src:`/api/assets/${item.id}/bytes`});media.addEventListener('loadedmetadata',()=>media.currentTime=saved.time||0);media.addEventListener('pause',run(async()=>{const prior=await api(`/api/state/${item.id}`);await api(`/api/state/${item.id}`,post({...prior,time:media.currentTime}));}));$('reading').replaceChildren(media);
 }else{
  if(item.kind==='zim')await entries(true);
  const result=await api(`/api/assets/${item.id}/read?key=${encodeURIComponent(state.key)}`);if(ticket!==state.opening)return;await displayResult(result);
  if(item.kind==='epub')$('entry-list').replaceChildren(...result.chapters.map(c=>el('button',{class:'entry',onclick:run(()=>navigateKey(c.key))},c.title)));
 }
 if(ticket!==state.opening)return;await refreshNotes();await refreshStats();status(`Opened ${item.name}`);if(saved.scroll&&!key&&item.kind!=='pdf')$('reading').scrollTop=saved.scroll;
}
async function displayResult(result){
 state.source=result.source;state.key=result.key||result.source.locator?.key||'';
 $('work-title').textContent=result.source.title;$('source-status').textContent=`${result.source.kind.toUpperCase()} · edition ${result.source.edition.slice(0,10)} · ${result.source.key}`;
 if(result.html)renderArchiveHTML(result);else{const article=el('article',{class:'paper'},el('span',{class:'source-label'},state.current.name),result.text);article.style.fontSize=state.font+'px';$('reading').replaceChildren(article);}
 await savePlace();graph?.setSelected(state.source.id);highlightEntry();
}
function renderArchiveHTML(result){
 const fragment=DOMPurify.sanitize(result.html,{RETURN_DOM:true,FORBID_TAGS:['script','iframe','frame','object','embed','form','input','button','meta','base','link','style','video','audio'],FORBID_ATTR:['style','srcset','formaction','ping','target']});
 const base=new URL(result.key||'',location.origin+(result.resourceBase||'/'));
 for(const node of fragment.querySelectorAll('[src],[href]')){
  for(const attr of ['src','href']){if(!node.hasAttribute(attr))continue;const value=node.getAttribute(attr);if(attr==='href'&&value.startsWith('#'))continue;
   if(/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)){if(attr==='src')node.removeAttribute(attr);else{node.setAttribute('data-external',value);node.setAttribute('href','#external');}continue;}
   try{const url=value.startsWith('/')?new URL(value.replace(/^\/+/,''),location.origin+(result.resourceBase||'/')):new URL(value,base);if(url.pathname.startsWith(result.resourceBase||'/api/resources/'))node.setAttribute(attr,url.pathname+url.hash);else node.removeAttribute(attr);}catch{node.removeAttribute(attr);}
  }
 }
 const frame=el('iframe',{title:`Source: ${result.source.title}`,sandbox:'allow-same-origin'});
 const doc=new DOMParser().parseFromString('<!doctype html><html><head></head><body></body></html>','text/html');
 const csp=doc.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'none'; form-action 'none'; base-uri 'none'; script-src 'none'";doc.head.append(csp);
 const style=doc.createElement('style');style.textContent=`:root{color-scheme:light}body{max-width:780px;margin:0 auto;padding:35px 30px;background:#eae9e3;color:#202b32;font:${state.font}px/1.85 Georgia,serif;overflow-wrap:anywhere}h1{font-size:2em;line-height:1.3}h2,h3{line-height:1.4}a{color:#076b67}img{max-width:100%;height:auto}table{max-width:100%;border-collapse:collapse;font-size:.8em}td,th{border:1px solid #bac6c4;padding:7px}pre{white-space:pre-wrap;font-size:.85em}figure{margin:20px 0}@media(max-width:500px){body{padding:20px 18px}table{display:block;overflow:auto}}`;doc.head.append(style);doc.body.append(...Array.from(fragment.childNodes));
 frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;
 frame.addEventListener('load',()=>{const d=frame.contentDocument;if(!d)return;d.addEventListener('click',event=>{const a=event.target.closest('a');if(!a)return;if(a.hasAttribute('data-external')){event.preventDefault();status(`External reference: ${a.getAttribute('data-external')} (copy the address to open outside the offline reader).`);return;}const href=a.getAttribute('href');if(href?.startsWith('#'))return;event.preventDefault();try{const target=new URL(href,location.origin);const key=decodeURIComponent(target.pathname.slice(result.resourceBase.length));navigateKey(key).catch(report);}catch(e){report(e);}});d.addEventListener('selectionchange',()=>captureSelection(d.getSelection()?.toString()));});
 $('reading').replaceChildren(frame);
}
async function entries(reset=false){
 if(state.current?.kind!=='zim')return;const item=state.current;if(reset){state.entriesOffset=0;$('entry-list').replaceChildren();}
 const r=await api(`/api/assets/${item.id}/entries?query=${encodeURIComponent(entryQuery)}&offset=${state.entriesOffset}`);if(item.id!==state.current?.id)return;
 for(const e of r.entries)$('entry-list').append(el('button',{class:'entry','data-key':e.key,onclick:run(()=>navigateKey(e.key))},e.title||e.key));
 state.entriesOffset=r.nextOffset;$('more-entries').hidden=r.complete||!r.nextOffset;highlightEntry();
}
function highlightEntry(){document.querySelectorAll('#entry-list .entry').forEach(n=>n.classList.toggle('active',n.dataset.key===state.key));}
async function navigateKey(key){if(!state.current)return;state.history.push({item:state.current,key:state.key,page:state.page});const id=++state.opening,r=await api(`/api/assets/${state.current.id}/read?key=${encodeURIComponent(key)}`);if(id!==state.opening)return;await displayResult(r);await refreshNotes();await refreshStats();}
async function drawPdf(){
 const pdf=state.pdf;if(!pdf)return;const ticket=++state.rendering;renderTask?.cancel();state.page=Math.min(pdf.numPages,Math.max(1,state.page));$('page-number').value=state.page;$('page-total').textContent=`of ${pdf.numPages}`;
 const page=await pdf.getPage(state.page);if(ticket!==state.rendering)return;
 const text=await page.getTextContent();if(ticket!==state.rendering)return;
 if(pdfTextMode){$('reading').replaceChildren(el('article',{class:'paper'},text.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('')));}else{
  const defaultViewport=page.getViewport({scale:1});const scale=$('pdf-zoom').value==='fit'?Math.max(.3,Math.min(2,($('reading').clientWidth-40)/defaultViewport.width)):Number($('pdf-zoom').value);
  const viewport=page.getViewport({scale}),ratio=Math.min(2,window.devicePixelRatio||1),wrapper=el('div',{class:'pdf-page-wrapper'}),canvas=el('canvas',{'aria-label':`Page ${state.page} of ${pdf.numPages}`});
  wrapper.style.width=viewport.width+'px';wrapper.style.height=viewport.height+'px';wrapper.style.setProperty('--scale-factor',scale);wrapper.style.setProperty('--total-scale-factor',scale);canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';wrapper.append(canvas);$('reading').replaceChildren(wrapper);
  renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio!==1?[ratio,0,0,ratio,0,0]:null});try{await renderTask.promise;}catch(e){if(e.name!=='RenderingCancelledException')throw e;return;}if(ticket!==state.rendering)return;
  const layer=el('div',{class:'textLayer'});wrapper.append(layer);await new state.pdfLib.TextLayer({textContentSource:text,container:layer,viewport}).render();
 }
 const current=state.current;try{const r=await api(`/api/assets/${current.id}/read?page=${state.page}`);if(ticket!==state.rendering)return;state.source=r.source;state.key=`page:${state.page}`;$('source-status').textContent=`PDF · page ${state.page} · edition ${current.id.slice(0,10)}`;await savePlace();}catch(e){status(`Page rendered. Retrieval text: ${e.message}`,true);}await refreshNotes();
}
async function findPdf(){const q=$('pdf-find').value.trim().toLowerCase();if(!state.pdf||!q)return;status('Searching PDF text…');const pdf=state.pdf;for(let i=0;i<pdf.numPages;i++){const n=(pdfSearchPage+i-1)%pdf.numPages+1,p=await pdf.getPage(n),text=await p.getTextContent();if(pdf!==state.pdf)return;if(text.items.map(x=>x.str).join(' ').toLowerCase().includes(q)){state.page=n;pdfSearchPage=n%pdf.numPages+1;await drawPdf();status(`Found “${q}” on page ${n}.`);return;}p.cleanup();if(i%10===0)await new Promise(r=>setTimeout(r,0));}status('No match in the PDF text layer. Scanned pages may require OCR.');}
function captureSelection(text){if(!text?.trim())return;state.selection=text.trim().slice(0,4000);$('note-anchor').textContent=`Quote: “${state.selection.slice(0,150)}${state.selection.length>150?'…':''}”`;}
async function refreshNotes(){const list=await api('/api/annotations'+(state.current?`?assetId=${state.current.id}`:''));$('notes-list').replaceChildren(...list.map(n=>el('article',{class:'note-card'},el('small',{},new Date(n.created||n.updated||Date.now()).toLocaleString()),n.locator.quote?el('blockquote',{},n.locator.quote):null,el('p',{},n.text),el('small',{},n.locator.page?`Page ${n.locator.page}`:n.locator.key||'Whole work'))));}
async function openSource(id,citation){
 const sourceId=id||citation?.sourceId;if(!sourceId)throw Error('This citation has no source identity.');
 const result=await api(`/api/sources/${encodeURIComponent(sourceId)}/read`),source=result.source;
 const item=state.assets.find(a=>a.id===source.assetId);if(!item)throw Error('This source has no library record.');
 if(source.kind==='pdf'){await openAsset(item,{page:source.locator.page});return;}
 if(state.current)state.history.push({item:state.current,key:state.key,page:state.page});
 ++state.opening;++state.rendering;renderTask?.cancel();await state.pdf?.loadingTask.destroy();state.pdf=null;
 state.current=item;state.selection='';show('reader');$('pdf-tools').hidden=true;$('entry-search-form').hidden=source.kind!=='zim';$('entry-list').replaceChildren();$('more-entries').hidden=true;
 $('reader-kind').textContent=source.kind.toUpperCase()+' · CITED SOURCE';await displayResult(result);
 if(source.kind==='zim')await entries(true);await refreshNotes();status('Opened the exact cited source edition.');
}
async function refreshGraph(){
 const data=await api('/api/graph');if(!graph)graph=mountMesh($('mesh-canvas'),{camera:state.settings.camera,onSelect:run(id=>openSource(id)),onCameraChange:camera=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>settings({camera}).catch(report),300);}});
 graph.setGraph({nodes:data.nodes,edges:data.edges.map(e=>({from:e.sourceId,to:e.targetId,type:e.relation,kind:e.kind}))});graph.setSelected(state.source?.id);
 for(const name of ['edge-from','edge-to'])$(name).replaceChildren(...data.nodes.map(n=>el('option',{value:n.id},n.title)));
 if(state.source)$('edge-from').value=state.source.id;
}
function resultCard(r){const ref=r.citation||r.sourceRef;return el('article',{class:'search-hit'},el('span',{class:'eyebrow'},`${ref?.kind||'SOURCE'} · ${ref?.edition?.slice(0,10)||''}`),el('h3',{},r.title),el('p',{},r.excerpt||r.text),el('button',{onclick:run(()=>openSource(r.id||ref?.sourceId,ref))},'Open source →'));}
async function search(query){show('search');$('search-title').textContent=`Results for “${query}”`;$('search-status').textContent='Reading available source passages…';$('search-results').replaceChildren();const r=await api('/api/search',post({query}));$('search-results').replaceChildren(...r.results.map(resultCard));$('search-status').textContent=`${r.results.length} passages · ${r.status.mode||'lexical + graph'}${r.status.partial?' · bounded search; more sources may exist':''}${r.embeddingError?' · embeddings unavailable':''}`;if(!r.results.length)$('search-results').append(el('p',{class:'muted'},'No matching passages yet. Open a relevant ZIM article, PDF page or EPUB chapter to add its source reference. Imported text works are discoverable immediately.'));}
function showEvidence(results){state.evidence=results;$('evidence-list').replaceChildren(...results.map((r,i)=>el('article',{class:'evidence-card'},el('small',{},`[S${i+1}] · ${r.citation?.kind||'source'}`),el('button',{onclick:run(()=>openSource(r.id||r.citation?.sourceId,r.citation))},r.title),el('p',{},r.excerpt||r.text?.slice(0,400)))));}
function renderAnswer(node,text,citations=[]){node.replaceChildren();const parts=text.split(/(\[S\d+\])/g);for(const part of parts){const m=part.match(/^\[(S\d+)\]$/),c=m&&citations.find(x=>x.id===m[1]);if(c)node.append(el('button',{class:'citation',onclick:run(()=>openSource(c.sourceId,c.sourceRef))},part));else node.append(document.createTextNode(part));}}
async function sendChat(){
 const message=$('chat-input').value.trim();if(!message||chatAbort)return;companion(true);$('chat-input').value='';$('chat-messages').querySelector('.chat-welcome')?.remove();$('chat-messages').append(el('div',{class:'chat-message user'},message));
 const answer=el('div',{class:'chat-message assistant'},el('span',{class:'message-role'},'COMPANION')),body=el('div',{},'Retrieving sources…'),details=el('details',{class:'reasoning',open:''},el('summary',{},'Model reasoning')),reason=el('div',{});details.append(reason);details.hidden=true;answer.append(details,body);$('chat-messages').append(answer);
 chatAbort=new AbortController();$('stop-chat').hidden=false;$('send-chat').disabled=true;let text='',citations=[];
 try{
  const res=await fetch('/api/chat',{...post({message,sourceId:state.source?.id,model:$('model-select').value||state.settings.model,messages:state.messages.map(({role,content})=>({role,content}))}),signal:chatAbort.signal});if(!res.ok)throw Error((await res.json()).error);
  const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';
  for(;;){const{value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.trim())continue;const event=JSON.parse(line);
   if(event.type==='evidence'){showEvidence(event.results);body.textContent='Asking the local model…';}
   if(event.type==='start')citations=event.citations||[];
   if(event.type==='delta'){text+=event.text;renderAnswer(body,text,citations);}
   if(event.type==='reasoning'){details.hidden=false;reason.textContent+=event.text;}
   if(event.type==='done'){citations=event.citations||citations;renderAnswer(body,text,citations);}
   if(event.type==='error')throw Error(event.error);
   $('chat-messages').scrollTop=$('chat-messages').scrollHeight;
  }}if(text){state.messages.push({role:'user',content:message},{role:'assistant',content:text,citations});await loadChatHistory();}
 }catch(e){if(e.name==='AbortError'){if(!text)body.textContent='Generation stopped.';status('Local generation stopped.');}else{if(!text)body.textContent=e.message;else body.append(el('p',{class:'muted'},`Generation interrupted: ${e.message}`));report(e);}}finally{chatAbort=null;$('stop-chat').hidden=true;$('send-chat').disabled=false;}
}
async function loadRuntime(){const r=await api('/api/runtime');const models=state.assets.filter(a=>a.kind==='model'&&a.storage!=='missing');$('runtime-model').replaceChildren(...(models.length?models.map(a=>el('option',{value:a.id},a.name)):[el('option',{value:''},'Link or download a GGUF model')]));$('start-model').disabled=!r.configured||!models.length;$('stop-model').disabled=r.status.state!=='ready';$('runtime-status').textContent=r.configured?`Engine: ${r.status.state}${r.status.modelName?' · '+r.status.modelName:''}`:'To load models here, use the Linux bundle with its included engine, or set ENZIME_LLAMA_SERVER_BIN. You can also connect an engine below.';return r;}
async function loadChatHistory(){const chats=await api('/api/chats');$('chat-history-list').replaceChildren(...chats.slice(0,15).map(c=>el('button',{class:'draft-item',onclick:()=>{state.messages=c.messages;$('chat-messages').replaceChildren(...c.messages.map(m=>{const n=el('div',{class:'chat-message '+m.role});renderAnswer(n,m.content,m.citations||[]);return n;}));}},c.title)));}
async function loadSettings(){const config=await api('/api/config');state.settings=config.settings;$('endpoint').value=state.settings.endpoint||'http://127.0.0.1:8080/v1';$('embedding-model').value=state.settings.embeddingModel||'';if(config.checkoutReady){$('checkout').hidden=false;$('checkout').href=config.checkoutPath;$('billing-status').textContent='Hosted checkout is configured. Entitlement activation requires the central billing integration.';}await refreshStats();const refs=await api('/api/model-references');$('model-references').replaceChildren(...refs.map(r=>el('p',{class:'muted'},r.name)));}
async function connectModels(persist=true){status('Connecting to the local model engine…');if(persist)await settings({endpoint:$('endpoint').value,embeddingModel:$('embedding-model').value});const info=await api('/api/models');if(info.available===false||info.ok===false)throw Error(info.error?.message||info.error||'Local engine is unavailable. Start llama-server, LM Studio, or Ollama.');const models=(info.models||[]).map(m=>typeof m==='string'?m:m.id);$('model-select').replaceChildren(...models.map(id=>el('option',{value:id},id)));const recommended=info.recommendedModel||info.defaultModel||models.find(m=>/lfm.*2[._-]?5/i.test(m))||models[0];$('model-select').value=models.includes(state.settings.model)?state.settings.model:recommended||'';await settings({model:$('model-select').value});$('ai-state').textContent=models.length?'Connected':'No loaded model';$('chat-model-label').textContent=$('model-select').value||'No model loaded';$('model-status').textContent=models.length?`${models.length} model${models.length===1?'':'s'} available. Select the model that fits this device.`:'Engine reached, but no models are advertised.';$('kv-status').textContent='TurboQuant: '+(info.kvCache?.status||'not verified by this engine')+'. Model weight quantization is separate.';status('Local model connection checked.');}
async function loadDrafts(){const drafts=await api('/api/drafts');$('draft-list').replaceChildren(...drafts.map(d=>el('button',{class:'draft-item',onclick:()=>{state.draft=d;$('draft-title').value=d.title;$('draft-body').value=d.body;$('draft-status').textContent='Private draft';}},d.title)));}
async function saveDraft(){state.draft=await api('/api/drafts',post({id:state.draft?.id,title:$('draft-title').value,body:$('draft-body').value,format:'markdown',sourceRefs:state.source?[state.source]:[]}));$('draft-status').textContent='Draft saved';await loadDrafts();return state.draft;}
function planOptions(){return{breadth:Number($('breadth').value),capacityBytes:Number($('budget').value)*1024**3,reserveBytes:64*1024**2,maxDepth:Number($('depth').value),selectedDomains:$('domains').value.split(',').map(s=>s.trim()).filter(Boolean)};}
function collection(){if(state.manifest)return state.manifest;const title=$('download-title').value.trim()||'Offline collection',url=$('download-url').value.trim(),size=Number($('download-size').value),sha256=$('download-hash').value.trim();if(!url||!size||!/^[a-f0-9]{64}$/i.test(sha256))throw Error('Provide the archive URL, exact size and SHA-256, or import its manifest.');return{id:'local-selection',version:sha256,units:[{id:sha256,title,domain:'General',topic:'Complete archive',depth:0,size,sha256,url,kind:'zim',essential:true}]};}
async function previewPlan(){state.plan=await api('/api/dyndon/plan',post({manifest:collection(),options:planOptions()}));const p=state.plan;$('plan-result').replaceChildren(el('p',{class:'callout'},`${p.status} · ${p.selected.length} complete units selected`),...p.coverage.map(c=>el('div',{class:'coverage-row'},c.domain,el('strong',{},`${c.selectedUnits} / ${c.totalUnits} units`))),el('p',{class:'muted'},`${p.omitted.length} units omitted · ${bytes(p.budget.finalBytes??p.budget.selectedBytes??p.budget.reservationBytes)} selected/reserved`));$('install-plan').disabled=p.status!=='ready'&&p.status!=='fits';status('Coverage preview is ready.');}
async function loadDownloads(){
 clearTimeout(downloadTimer);const jobs=await api('/api/downloads');
 $('download-jobs').replaceChildren(...jobs.map(j=>{
  const received=(j.units||[]).reduce((n,u)=>n+(u.bytesReceived||0),0),total=(j.plan?.selected||[]).filter(u=>!u.installed).reduce((n,u)=>n+u.size,0);
  const action=j.type==='download'&&!['complete','released','cancelled'].includes(j.status)?el('button',{class:'outline small',onclick:run(async()=>{await api(`/api/dyndon/${j.active?'pause':'resume'}`,post({id:j.id}));status(j.active?'Transfer paused; received bytes are retained.':'Transfer resumed.');await loadDownloads();})},j.active?'Pause':'Resume'):null;
  return el('article',{class:'note-card'},el('strong',{},`${j.manifest?.title||j.manifest?.id||j.type} · ${j.status}`),el('p',{class:'muted'},`${bytes(received)} / ${bytes(total)} · ${j.units?.length||0} units`),el('progress',{max:Math.max(total,1),value:received,'aria-label':'Downloaded bytes'}),j.error||j.adoptionError?el('p',{class:'error'},j.adoptionError||j.error):null,action);
 }));
 const snapshot=jobs.map(j=>`${j.id}:${j.status}:${j.adoptionStatus}`).join('|');if(snapshot!==downloadSnapshot){downloadSnapshot=snapshot;await refresh();}else await refreshStats();
 if(state.view==='downloads'&&jobs.some(j=>j.active))downloadTimer=setTimeout(()=>loadDownloads().catch(report),1000);
}
async function importFiles(files){for(const file of files){const ext=file.name.split('.').pop().toLowerCase(),kind={zim:'zim',pdf:'pdf',epub:'epub',txt:'final',md:'final',html:'html',htm:'html',mp3:'audio',mp4:'video',gguf:'model'}[ext];if(!kind)throw Error(`Unsupported file: ${file.name}`);status(`Importing ${file.name}…`);const a=await api(`/api/assets?kind=${kind}&name=${encodeURIComponent(file.name)}`,{method:'POST',headers:{'X-MBA-Client':'enzime'},body:file});await refresh();if(files.length===1)await openAsset(a);}status('Import complete.');}
for(const n of document.querySelectorAll('[data-view]'))n.onclick=()=>show(n.dataset.view);
for(const n of document.querySelectorAll('[data-go]'))n.onclick=()=>show(n.dataset.go);
for(const n of document.querySelectorAll('[data-filter]'))n.onclick=()=>{state.filter=n.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b===n));drawLibrary();};
for(const n of document.querySelectorAll('[data-tab]'))n.onclick=()=>selectTab(n.dataset.tab);
$('upload').onchange=run(e=>importFiles([...e.target.files]));
$('search-form').onsubmit=run(async e=>{e.preventDefault();const q=$('search').value.trim();if(q)await search(q);});
$('toggle-assistant').onclick=()=>companion($('companion').classList.contains('closed'));$('close-companion').onclick=()=>companion(false);
$('theme-toggle').onclick=run(async()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;await settings({theme});});
$('reader-back').onclick=run(async()=>{const last=state.history.pop();if(last)await openAsset(last.item,{...last,remember:false});else show('library');});
$('reader-bookmark').onclick=run(async()=>{if(!state.current)throw Error('Open a work first.');await savePlace();status('Reading position saved.');});
$('reader-verify').onclick=run(async()=>{if(!state.current)return;status('Verifying the original bytes…');const v=await api(`/api/assets/${state.current.id}/verify`);status(v.ok?'SHA-256 verified. The source matches its saved edition.':'Integrity mismatch: the source has changed.',!v.ok);});
$('reader-correct').onclick=run(async()=>{if(!state.source)throw Error('Open a source passage first.');const r=await api(`/api/assets/${state.current.id}/read?key=${encodeURIComponent(state.key)}&page=${state.page}`);state.correction=state.source;state.draft=null;$('draft-title').value=state.source.title+' · correction';$('draft-body').value=r.text;$('draft-status').textContent='Correction overlay · original preserved';show('create');});
$('reader-focus').onclick=()=>document.body.classList.toggle('focus-mode');
$('reveal-mesh').onclick=()=>show('mesh');$('mesh-refresh').onclick=run(refreshGraph);
$('entry-search-form').onsubmit=run(e=>{e.preventDefault();entryQuery=$('entry-search').value;return entries(true);});$('more-entries').onclick=run(()=>entries(false));
$('prev-page').onclick=run(()=>{state.page--;return drawPdf();});$('next-page').onclick=run(()=>{state.page++;return drawPdf();});$('page-number').onchange=run(()=>{state.page=Number($('page-number').value)||1;return drawPdf();});$('pdf-zoom').onchange=run(drawPdf);$('pdf-text').onclick=run(()=>{pdfTextMode=!pdfTextMode;$('pdf-text').textContent=pdfTextMode?'Page view':'Text view';return drawPdf();});$('pdf-find-button').onclick=run(findPdf);
for(const[id,delta]of[['font-down',-1],['font-up',1]])$(id).onclick=run(async()=>{state.font=Math.max(14,Math.min(32,state.font+delta));const paper=$('reading').querySelector('.paper');if(paper)paper.style.fontSize=state.font+'px';const frame=$('reading').querySelector('iframe');if(frame?.contentDocument)frame.contentDocument.body.style.fontSize=state.font+'px';await savePlace();});
$('note-form').onsubmit=run(async e=>{e.preventDefault();if(!state.current)throw Error('Open a source before adding a note.');await api('/api/annotations',post({assetId:state.current.id,text:$('note-text').value,locator:{key:state.key,page:state.current.kind==='pdf'?state.page:undefined,quote:state.selection||'',sourceId:state.source?.id}}));$('note-text').value='';state.selection='';$('note-anchor').textContent='Select text in the reader to anchor your note.';await refreshNotes();await refreshStats();status('Note saved independently of the original.');});
$('reading').addEventListener('mouseup',()=>captureSelection(window.getSelection()?.toString()));
$('edge-form').onsubmit=run(async e=>{e.preventDefault();await api('/api/graph/edge',post({from:$('edge-from').value,to:$('edge-to').value,type:$('edge-type').value}));await refreshGraph();status('Your relationship is saved.');});
$('chat-form').onsubmit=run(e=>{e.preventDefault();return sendChat();});$('chat-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat().catch(report);}};$('stop-chat').onclick=()=>chatAbort?.abort();$('ask-selection').onclick=()=>{$('chat-input').value=state.selection?`Explain this passage using my library: ${state.selection}`:state.source?`Explain ${state.source.title} and connect it to relevant knowledge in my library.`:'What sources in my library can help with my current problem?';$('chat-input').focus();};
$('model-form').onsubmit=run(e=>{e.preventDefault();return connectModels();});$('model-select').onchange=run(async()=>{await settings({model:$('model-select').value});$('chat-model-label').textContent=$('model-select').value;});$('embedding-model').onchange=run(()=>settings({embeddingModel:$('embedding-model').value}));
$('clear-caches').onclick=run(async()=>{await api('/api/cache/clear',post({}));await refreshStats();status('Disposable retrieval caches cleared. Your originals and notes are intact.');});
$('backup-button').onclick=run(async()=>{download(`EnZIME-personal-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(await api('/api/backup'),null,2));status('Personal metadata exported. Transfer original source files separately.');});
$('restore-backup').onchange=run(async e=>{const file=e.target.files[0];if(!file)return;await api('/api/backup',post(JSON.parse(await file.text())));await refresh();status('Backup restored. Missing original files are marked in the library.');});
$('new-draft').onclick=()=>{state.draft=null;state.correction=null;$('draft-title').value='';$('draft-body').value='';$('draft-status').textContent='New private draft';};$('draft-form').onsubmit=run(e=>{e.preventDefault();return saveDraft();});
$('finalize-draft').onclick=run(async()=>{if(!$('draft-title').value.trim()||!$('draft-body').value.trim())throw Error('Give your work a title and text.');if(state.correction){await api('/api/overlay',post({sourceId:state.correction.id,text:$('draft-body').value}));state.correction=null;status('Correction saved as an immutable overlay. Active retrieval uses the correction.');}else{const d=await saveDraft();await api('/api/finalize',post({id:d.id}));status('Final revision saved. Earlier revisions remain available.');}$('draft-status').textContent='Finalized';await refresh();});
$('export-zim').onclick=run(async()=>{if(!$('draft-title').value.trim()||!$('draft-body').value.trim())throw Error('Write the work before creating its archive.');status('Planning and generating a valid ZIM…');const title=$('draft-title').value,body=$('draft-body').value;const r=await api('/api/dyndon/generate',post({records:[{key:'C/'+title.replace(/\s+/g,'_'),title,mime:'text/plain',text:body,domain:'Personal knowledge',topic:'Finished works',depth:0}],options:planOptions(),metadata:{title,creator:'Local author',language:'eng',description:'User-created EnZIME work'}}));await refresh();status(`ZIM generation ${r.status}. The original draft is preserved.`);});
$('breadth').oninput=()=>{$('breadth-label').textContent=+$('breadth').value>=.5?'Balanced breadth':'Prioritize depth';$('install-plan').disabled=true;};
$('budget').oninput=()=>{$('budget-label').textContent=$('budget').value+' GiB';$('install-plan').disabled=true;};$('depth').oninput=()=>{$('depth-label').textContent=$('depth').value==='10'?'All depths':$('depth').value;$('install-plan').disabled=true;};$('domains').oninput=()=>{$('install-plan').disabled=true;};
$('manifest-file').onchange=run(async e=>{const file=e.target.files[0];if(file){state.manifest=JSON.parse(await file.text());status('Collection manifest loaded. Preview its coverage.');}});$('plan-download').onclick=run(previewPlan);$('install-plan').onclick=run(async()=>{$('install-plan').disabled=true;status('Starting selected transfers…');try{await api('/api/dyndon/download',post({manifest:collection(),options:planOptions()}));await loadDownloads();status('Transfers started. Each unit is verified before it enters the library.');}finally{$('install-plan').disabled=false;}});
function openMount(kind='zim'){$('mount-kind').value=kind;$('mount-dialog').showModal();}$('mount-button').onclick=()=>openMount();$('link-model').onclick=()=>openMount('model');$('mount-close').onclick=()=>$('mount-dialog').close();
$('mount-form').onsubmit=run(async e=>{e.preventDefault();status('Fingerprinting the original file…');const item=await api('/api/mount',post({path:$('mount-path').value,kind:$('mount-kind').value}));if(item.kind==='model')await api('/api/model-references',post({name:item.name,assetId:item.id}));$('mount-dialog').close();await refresh();await openAsset(item);status('File linked without making another copy.');});
$('open-guide').onclick=run(async()=>{const response=await fetch('/field-guide.md');const text=await response.text();const item=await api('/api/assets?kind=final&name=EnZIME%20field%20guide.md',{method:'POST',headers:{'X-MBA-Client':'enzime'},body:text});await refresh();await openAsset(item);});
$('start-model').onclick=run(async()=>{status('Loading the local model…');$('start-model').disabled=true;try{const r=await api('/api/runtime/start',post({assetId:$('runtime-model').value,contextSize:Number($('context-size').value),gpuLayers:Number($('gpu-layers').value)}));$('endpoint').value=r.status?.endpoint||r.endpoint||$('endpoint').value;await connectModels(false);await loadRuntime();}finally{$('start-model').disabled=false;}});
$('stop-model').onclick=run(async()=>{await api('/api/runtime/stop',post({}));await loadRuntime();$('ai-state').textContent='Unloaded';$('chat-model-label').textContent='No model loaded';status('Model unloaded; its file stays in shared storage.');});
$('download-lfm').onclick=run(async()=>{status('Starting verified LFM2.5 download…');const id='b1b3de114215d9507409a662a501a631095a479a419584e8a2ded6304b19b4f5';await api('/api/dyndon/download',post({manifest:{id:'liquidai-lfm25',version:'6767265158422fb8a19c62ceb45f16f05363615b',units:[{id,title:'LFM2.5-1.2B-Instruct-Q4_K_M.gguf',domain:'Models',topic:'Local reasoning',depth:0,size:730895168,sha256:id,url:'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/resolve/6767265158422fb8a19c62ceb45f16f05363615b/LFM2.5-1.2B-Instruct-Q4_K_M.gguf',kind:'model',essential:true}]},options:{capacityBytes:Math.max(2,Number($('budget').value))*1024**3,reserveBytes:64*1024**2}}));await refresh();show('downloads');status('LFM2.5 transfer created. Progress is available in DynDon.');});
$('save-answer').onclick=run(async()=>{const last=[...state.messages].reverse().find(m=>m.role==='assistant');if(!last)throw Error('Generate an answer first.');state.draft=null;state.correction=null;$('draft-title').value='From a conversation with my library';$('draft-body').value=last.content;show('create');await saveDraft();});
$('export-chat').onclick=()=>download('EnZIME-conversation.md',state.messages.map(m=>`## ${m.role}\n\n${m.content}`).join('\n\n'),'text/markdown');
window.addEventListener('keydown',e=>{const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable;if(e.key==='/'&&!typing){e.preventDefault();$('search').focus();}if(e.key==='Escape'){document.body.classList.remove('focus-mode');if(innerWidth<1000)companion(false);}});
try{const config=await api('/api/config');state.settings=config.settings;document.documentElement.dataset.theme=state.settings.theme||'dark';if(innerWidth<1000)companion(false);await refresh();if(state.settings.endpoint){$('endpoint').value=state.settings.endpoint;await connectModels().catch(()=>status('Library ready. Your local model engine is not running yet.'));}}catch(e){report(e);}
