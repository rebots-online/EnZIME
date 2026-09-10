import { useRef, useState, useEffect, useCallback } from "react";

// ThinkSpace — 6DoF semantic concept navigator (mockup)
// Controls: drag empty space = pivot/orbit about a vertical hinge out front.
//   scroll = fall forward (banks toward focused node). grab bauble = haul mass
//   (Alt = pluck one). grab edge = haul by strut. double-click = dive to wiki.
//   E = pysanky: tap semi-auto, hold ≥1s = aimable slingshot (overcharge quivers
//   then glitches then misfires). 4 = journey map. ✶ sky = orientation stars.

const ONTO = {
  entity:{c:"#7ee8fa",label:"Entity"}, process:{c:"#b388ff",label:"Process"},
  abstract:{c:"#ff9ecd",label:"Abstract"}, place:{c:"#7cffc4",label:"Place"},
  artifact:{c:"#ffd479",label:"Artifact"}, field:{c:"#9db4ff",label:"Field"},
};
const REL = {
  is_a:{c:"#7ee8fa",label:"is-a"}, part_of:{c:"#7cffc4",label:"part-of"},
  causes:{c:"#ff9ecd",label:"causes"}, related:{c:"#b388ff",label:"related"}, uses:{c:"#ffd479",label:"uses"},
};
const SEED = {
  nodes:[
    {id:"entropy",title:"Entropy",onto:"abstract"},
    {id:"thermo",title:"Thermodynamics",onto:"field"},
    {id:"information",title:"Information Theory",onto:"field"},
    {id:"shannon",title:"Claude Shannon",onto:"entity"},
    {id:"heat",title:"Heat Death",onto:"process"},
    {id:"boltzmann",title:"Boltzmann",onto:"entity"},
    {id:"engine",title:"Heat Engine",onto:"artifact"},
    {id:"cosmos",title:"Observable Universe",onto:"place"},
    {id:"compression",title:"Data Compression",onto:"process"},
    {id:"order",title:"Order & Disorder",onto:"abstract"},
  ],
  edges:[
    {from:"entropy",to:"thermo",rel:"part_of",conf:0.92},
    {from:"entropy",to:"information",rel:"related",conf:0.81},
    {from:"shannon",to:"information",rel:"causes",conf:0.88},
    {from:"heat",to:"thermo",rel:"is_a",conf:0.74},
    {from:"boltzmann",to:"entropy",rel:"causes",conf:0.69},
    {from:"engine",to:"thermo",rel:"uses",conf:0.66},
    {from:"heat",to:"cosmos",rel:"related",conf:0.58},
    {from:"compression",to:"information",rel:"uses",conf:0.83},
    {from:"order",to:"entropy",rel:"related",conf:0.77},
    {from:"engine",to:"entropy",rel:"uses",conf:0.6},
  ],
};

const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scale=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const len=(a)=>Math.hypot(a[0],a[1],a[2])||1e-6;
const dist=(a,b)=>len(sub(a,b));
const segDist=(px,py,x1,y1,x2,y2)=>{const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy||1e-6;let t=((px-x1)*dx+(py-y1)*dy)/l2;t=Math.max(0,Math.min(1,t));return Math.hypot(px-(x1+t*dx),py-(y1+t*dy));};
function inferEdges(id,g){return new Promise(r=>setTimeout(()=>r(g.edges.filter(e=>e.from===id||e.to===id)),380));}

// ── ingest helpers: parse .md → node, embed, build similarity graph, project to 3D ──
function parseMd(name,text){
  // strip YAML frontmatter, pull title + tags if present
  let title=name.replace(/\.md$/i,""), tags=[], body=text;
  const fm=text.match(/^---\n([\s\S]*?)\n---\n?/);
  if(fm){ body=text.slice(fm[0].length);
    const tm=fm[1].match(/title:\s*"?([^"\n]+)"?/); if(tm) title=tm[1].trim();
  }
  // text used for embedding = title + body, trimmed
  return {title, tags, text:(title+"\n"+body).slice(0,8000), raw:body.slice(0,1200)};
}
// THE SEAM: real version POSTs to Ollama. stub returns deterministic pseudo-embedding
// from text so the whole pipeline is real except this one call.
async function embed(text, endpoint, model){
  if(endpoint){ // real Ollama path: accepts "192.168.0.41:11434" or full URL
    const base=/^https?:\/\//.test(endpoint)?endpoint:("http://"+endpoint);
    const r=await fetch(base.replace(/\/$/,"")+"/api/embeddings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model,prompt:text})});
    const j=await r.json(); return j.embedding;
  }
  // deterministic fake: hash text into a 48-d vector (stable, text-dependent)
  const D=48, v=new Array(D).fill(0);
  for(let i=0;i<text.length;i++){ const c=text.charCodeAt(i); v[i%D]+=Math.sin(c*0.13+(i%7))*0.5+Math.cos(c*0.07)*0.5; }
  const n=Math.hypot(...v)||1; return v.map(x=>x/n);
}
const cosine=(a,b)=>{let d=0,na=0,nb=0;for(let i=0;i<a.length;i++){d+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}return d/((Math.sqrt(na)*Math.sqrt(nb))||1);};
const hashStr=(s)=>{let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h+s.charCodeAt(i))|0;}return h;};
// project N-d embeddings → 3D via top-3 principal-ish axes (cheap power-iteration-free:
// use 3 fixed random orthogonal-ish projections, good enough for a layout seed)
function projectTo3D(vecs){
  const D=vecs[0].length;
  const axes=[0,1,2].map(s=>{const a=new Array(D).fill(0).map((_,i)=>Math.sin(i*1.7+s*2.1)+Math.cos(i*0.9+s*3.3));const n=Math.hypot(...a);return a.map(x=>x/n);});
  return vecs.map(v=>axes.map(ax=>{let d=0;for(let i=0;i<D;i++)d+=v[i]*ax[i];return d*260;}));
}

// ── connection helpers: Ollama + any OpenAI-compatible host:port ──────────
function normBase(host){ if(!host) return ""; const h=String(host).trim(); if(!h) return ""; const b=/^https?:\/\//.test(h)?h:("http://"+h); return b.replace(/\/+$/,""); }
async function listModels(host,key,oai){
  const base=normBase(host); if(!base) return [];
  try{
    if(oai){ const r=await fetch(base+"/v1/models",{headers:key?{Authorization:"Bearer "+key}:{}}); const j=await r.json(); return (j.data||[]).map(m=>m.id).filter(Boolean); }
    const r=await fetch(base+"/api/tags"); const j=await r.json(); return (j.models||[]).map(m=>m.name).filter(Boolean);
  }catch{ return []; }
}
async function embedUnified(text,host,model,key,oai){
  const base=normBase(host);
  if(!base){ // deterministic 48-d fallback so the pipeline still runs fully offline
    const D=48,v=new Array(D).fill(0);
    for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);v[i%D]+=Math.sin(c*0.13+(i%7))*0.5+Math.cos(c*0.07)*0.5;}
    const n=Math.hypot(...v)||1; return v.map(x=>x/n);
  }
  if(oai){ const r=await fetch(base+"/v1/embeddings",{method:"POST",headers:{"Content-Type":"application/json",...(key?{Authorization:"Bearer "+key}:{})},body:JSON.stringify({model,input:text})}); const j=await r.json(); return (j.data&&j.data[0]&&j.data[0].embedding)||[]; }
  const r=await fetch(base+"/api/embeddings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model,prompt:text})}); const j=await r.json(); return j.embedding||[];
}
// streaming chat for Ollama (/api/chat NDJSON) or OpenAI-compatible (/v1/chat/completions SSE)
async function chatStream({host,model,key,oai,system,messages,context,onToken}){
  const base=normBase(host); if(!base) throw new Error("no chat host");
  const sys=(system||"")+(context&&context.length?("\n\nCONTEXT (cite titles in [brackets]):\n"+context.join("\n\n---\n\n")):"");
  const body={model,stream:true,messages:[{role:"system",content:sys},...messages]};
  const url=base+(oai?"/v1/chat/completions":"/api/chat");
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",...(oai&&key?{Authorization:"Bearer "+key}:{})},body:JSON.stringify(body)});
  if(!r.ok||!r.body) throw new Error("http "+r.status);
  const rd=r.body.getReader(),dec=new TextDecoder(); let buf="",out="";
  for(;;){ const {value,done}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true});
    const lines=buf.split("\n"); buf=lines.pop();
    for(const ln of lines){ const s=ln.trim(); if(!s) continue;
      if(oai){ if(!s.startsWith("data:")) continue; const d=s.slice(5).trim(); if(d==="[DONE]") continue; try{ const j=JSON.parse(d); const tok=j.choices?.[0]?.delta?.content||""; if(tok){out+=tok;onToken&&onToken(tok);} }catch{} }
      else { try{ const j=JSON.parse(s); const tok=j.message?.content||""; if(tok){out+=tok;onToken&&onToken(tok);} }catch{} }
    }
  }
  return out;
}
const KB_SYSTEM="You are the knowledge-base companion inside ThinkSpace. Answer ONLY from the provided context. Cite the node titles you used inline like [Title]. If the answer is not in the context, say so plainly and suggest what to look for instead. Be concise and concrete.";

// ── tiny, escape-first markdown → html for the reader pane ────────────────
function escapeHtml(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function scrubHtml(h){ return String(h).replace(/<script[\s\S]*?<\/script>/gi,"").replace(/ on[a-z]+\s*=\s*"[^"]*"/gi,"").replace(/ on[a-z]+\s*=\s*'[^']*'/gi,"").replace(/javascript:/gi,""); }
function mdToHtml(src){
  if(!src) return "";
  const fences=[]; let s=String(src).replace(/```([\s\S]*?)```/g,(_,c)=>{fences.push(c);return `\u0000${fences.length-1}\u0000`;});
  s=escapeHtml(s);
  s=s.replace(/^###### (.*)$/gm,"<h6>$1</h6>").replace(/^##### (.*)$/gm,"<h5>$1</h5>").replace(/^#### (.*)$/gm,"<h4>$1</h4>").replace(/^### (.*)$/gm,"<h3>$1</h3>").replace(/^## (.*)$/gm,"<h2>$1</h2>").replace(/^# (.*)$/gm,"<h1>$1</h1>");
  s=s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img alt="$1" src="$2" style="max-width:100%;border-radius:8px"/>');
  s=s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
  s=s.replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>").replace(/(^|[^*])\*([^*\n]+)\*/g,"$1<i>$2</i>");
  s=s.replace(/`([^`]+)`/g,'<code style="background:#11183a;padding:1px 5px;border-radius:4px">$1</code>');
  s=s.replace(/(?:^|\n)((?:[ \t]*[-*+] .*(?:\n|$))+)/g,(m,blk)=>{const items=blk.trim().split(/\n/).map(l=>`<li>${l.replace(/^[ \t]*[-*+] /,"")}</li>`).join("");return `\n<ul>${items}</ul>\n`;});
  s=s.replace(/(?:^|\n)((?:[ \t]*\d+\. .*(?:\n|$))+)/g,(m,blk)=>{const items=blk.trim().split(/\n/).map(l=>`<li>${l.replace(/^[ \t]*\d+\. /,"")}</li>`).join("");return `\n<ol>${items}</ol>\n`;});
  s=s.split(/\n{2,}/).map(p=>/^\s*<(h\d|ul|ol|pre|img|blockquote)/.test(p.trim())?p:(p.trim()?`<p>${p.trim().replace(/\n/g,"<br/>")}</p>`:"")).join("\n");
  s=s.replace(/\u0000(\d+)\u0000/g,(_,i)=>`<pre style="background:#0a0e22;border:1px solid #1f2a55;border-radius:8px;padding:10px;overflow:auto"><code>${escapeHtml(fences[+i])}</code></pre>`);
  return s;
}
// ── screenshot the live viewport (svg + html overlays) via foreignObject ──
function fmtTs(){ const d=new Date(),p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
async function snapshotEl(node){
  if(!node) return;
  const rect=node.getBoundingClientRect(),w=Math.max(1,Math.ceil(rect.width)),h=Math.max(1,Math.ceil(rect.height));
  const clone=node.cloneNode(true);
  clone.querySelectorAll&&clone.querySelectorAll("svg").forEach(s=>s.setAttribute("xmlns","http://www.w3.org/2000/svg"));
  const xml=new XMLSerializer().serializeToString(clone);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;background:#05060f">${xml}</div></foreignObject></svg>`;
  const url="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
  try{
    const img=new Image(); await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url;});
    const scale=2,cv=document.createElement("canvas"); cv.width=w*scale; cv.height=h*scale;
    const ctx=cv.getContext("2d"); ctx.scale(scale,scale); ctx.fillStyle="#05060f"; ctx.fillRect(0,0,w,h); ctx.drawImage(img,0,0);
    const png=cv.toDataURL("image/png");
    const a=document.createElement("a"); a.href=png; a.download=`thinkspace-${fmtTs()}.png`; a.click();
    try{ const blob=await(await fetch(png)).blob(); if(navigator.clipboard&&window.ClipboardItem) await navigator.clipboard.write([new window.ClipboardItem({"image/png":blob})]); }catch{}
  }catch(err){ console.warn("snapshot failed",err); }
}

export default function ThinkSpace(){
  const W=760,H=520,FOV=620;
  const [,force]=useState(0);
  const tick=useCallback(()=>force(t=>(t+1)%1e9),[]);

  const [cfg,setCfg]=useState({damp:0.78,lookDamp:0.86,spring:0.018,charge:9000,breathe:0.5,glow:1,vignette:true,recenterIdle:true,przewalski:false});
  const cfgRef=useRef(cfg); cfgRef.current=cfg;
  const [trayOpen,setTrayOpen]=useState(false);

  // live graph: starts as SEED, replaced when a folder is ingested
  const graph=useRef(SEED);
  const [graphVer,setGraphVer]=useState(0);
  const [ingest,setIngest]=useState({open:false,busy:false,count:0,total:0,endpoint:"",model:"qwen3-embedding:8b",thresh:0.55});
  const [load,setLoad]=useState({maxNodes:300,minConf:0,total:0,shown:0,err:null});

  // ── tabs · connections · chat · reader (new) ──
  const [tab,setTab]=useState("spatial");          // "spatial" | "reader"
  const tabRef=useRef(tab); tabRef.current=tab;
  const [conn,setConn]=useState({
    embedHost:"", embedModel:"qwen3-embedding:8b", embedKey:"", embedOAI:false,
    chatHost:"",  chatModel:"gemma4:e2b",          chatKey:"",  chatOAI:false,
  });
  const connRef=useRef(conn); connRef.current=conn;
  const [models,setModels]=useState({embed:[],chat:[]});
  const [modelsBusy,setModelsBusy]=useState({embed:false,chat:false});
  const [chat,setChat]=useState({open:false,busy:false,q:"",msgs:[]});
  const [readerId,setReaderId]=useState("entropy");
  const nodeVecs=useRef({});                        // id -> Float-ish[] for RAG retrieval

  const sim=useRef(null);
  if(!sim.current){
    sim.current={nodes:SEED.nodes.map((n,i)=>{const a=(i/SEED.nodes.length)*Math.PI*2;const p=[Math.cos(a)*220,Math.sin(a*1.3)*120,Math.sin(a)*180];return{...n,p,v:[0,0,0],home:[...p]};})};
  }

  // ── load ANY conformant graph JSON (getrecall, claude-export, client-files,
  //    whatever) — keyed on SHAPE not filename. scale filters for big graphs. ──
  const loadGraphJson=async(file)=>{
    try{
      const j=JSON.parse(await file.text());
      // accept a few shapes: {nodes,edges} | {graph:{...}} | bare array of nodes
      const g = j.nodes ? j : (j.graph||j.data||{nodes:Array.isArray(j)?j:[],edges:[]});
      let nodes=(g.nodes||[]).map((n,i)=>({
        id:n.id!=null?String(n.id):("n"+i),
        title:n.title||n.name||n.label||("node "+i),
        onto:n.onto||n.type||n.category||"field",
        raw:n.raw||n.text||n.body||n.snippet||"",
        html:n.html||n.content_html||"",
        media:n.media||[],
        vec:(Array.isArray(n.vec)?n.vec:(Array.isArray(n.embedding)?n.embedding:null)),
        _pos:n.pos||n.position||null,
      }));
      // normalize unknown onto values into our palette buckets
      const okOnto=Object.keys(ONTO);
      nodes=nodes.map(n=>({...n,onto:okOnto.includes(n.onto)?n.onto:okOnto[Math.abs(hashStr(String(n.onto)))%okOnto.length]}));
      let edges=(g.edges||g.links||[]).map(e=>({
        from:String(e.from!=null?e.from:e.source),to:String(e.to!=null?e.to:e.target),
        rel:e.rel||e.type||"related",conf:e.conf!=null?e.conf:(e.weight!=null?e.weight:0.7),
      }));
      // ── scale guard: huge graphs (e.g. 4198 nodes) won't render in SVG. cap
      //    to the most-connected slice + a confidence floor, keep it flyable. ──
      const CAP=load.maxNodes||300;
      if(nodes.length>CAP){
        const deg={}; edges.forEach(e=>{deg[e.from]=(deg[e.from]||0)+e.conf;deg[e.to]=(deg[e.to]||0)+e.conf;});
        nodes=[...nodes].sort((a,b)=>(deg[b.id]||0)-(deg[a.id]||0)).slice(0,CAP);
        const keep=new Set(nodes.map(n=>n.id));
        edges=edges.filter(e=>keep.has(e.from)&&keep.has(e.to)&&e.conf>=(load.minConf||0));
      } else {
        edges=edges.filter(e=>e.conf>=(load.minConf||0));
      }
      const idset=new Set(nodes.map(n=>n.id));
      edges=edges.filter(e=>idset.has(e.from)&&idset.has(e.to));
      const placed=nodes.map((n,i)=>{
        const p=n._pos?[...n._pos]:[(Math.random()-0.5)*340,(Math.random()-0.5)*340,(Math.random()-0.5)*340];
        return {id:n.id,title:n.title,onto:n.onto,raw:n.raw,html:n.html,media:n.media,vec:n.vec,p};
      });
      graph.current={nodes:placed.map(n=>({id:n.id,title:n.title,onto:n.onto,raw:n.raw,html:n.html,media:n.media})),edges};
      sim.current={nodes:placed.map(n=>({...n,v:[0,0,0],home:[...n.p]}))};
      const nv={}; placed.forEach(n=>{ if(n.vec) nv[n.id]=n.vec; }); nodeVecs.current=nv;
      setSel(placed[0]?.id||"n0"); setReaderId(placed[0]?.id||"n0"); setGraphVer(v=>v+1);
      setLoad(s=>({...s,total:(g.nodes||[]).length,shown:placed.length,err:null}));
      setIngest(s=>({...s,open:false}));
    }catch(err){ setLoad(s=>({...s,err:"bad JSON: "+err.message})); }
  };
  const ONTO_KEYS=Object.keys(ONTO);
  const ingestFiles=async(fileList)=>{
    const files=Array.from(fileList).filter(f=>/\.md$/i.test(f.name));
    if(!files.length) return;
    setIngest(s=>({...s,busy:true,count:0,total:files.length}));
    const C=connRef.current;
    const docs=[];
    for(let i=0;i<files.length;i++){
      const f=files[i];
      const text=await f.text();
      const parsed=parseMd(f.name,text);
      // folder name (first path segment) → color hint only; drives nothing else
      const path=(f.webkitRelativePath||"").split("/");
      const folder=path.length>1?path[path.length-2]:"";
      const onto=ONTO_KEYS[Math.abs(hashStr(folder))%ONTO_KEYS.length];
      const vec=await embedUnified(parsed.text, C.embedHost, C.embedModel, C.embedKey, C.embedOAI);
      docs.push({id:"n"+i, title:parsed.title, onto, vec, raw:parsed.raw, folder});
      setIngest(s=>({...s,count:i+1}));
    }
    // edges: cosine similarity over the threshold
    const edges=[];
    for(let i=0;i<docs.length;i++)for(let j=i+1;j<docs.length;j++){
      const c=cosine(docs[i].vec,docs[j].vec);
      if(c>=ingest.thresh) edges.push({from:docs[i].id,to:docs[j].id,rel:"related",conf:Math.min(0.99,c)});
    }
    // 3D positions from embedding projection (the "shadow"); sim adds life on top
    const pos=projectTo3D(docs.map(d=>d.vec));
    graph.current={nodes:docs.map((d,i)=>({id:d.id,title:d.title,onto:d.onto,raw:d.raw})),edges};
    sim.current={nodes:docs.map((d,i)=>({id:d.id,title:d.title,onto:d.onto,raw:d.raw,p:[...pos[i]],v:[0,0,0],home:[...pos[i]]}))};
    const nv={}; docs.forEach(d=>{ nv[d.id]=d.vec; }); nodeVecs.current=nv;
    setSel(docs[0]?.id||"n0"); setReaderId(docs[0]?.id||"n0"); setGraphVer(v=>v+1);
    setIngest(s=>({...s,busy:false,open:false}));
  };

  const cam=useRef({pos:[0,0,-560],yaw:0,pitch:0,vYaw:0,vPitch:0,vFwd:0});
  const lookDrag=useRef(null), nodeDrag=useRef(null);
  const [sel,setSel]=useState("entropy");
  const selRef=useRef(sel); selRef.current=sel;
  const [hover,setHover]=useState(null);
  const [grabbed,setGrabbed]=useState(null);
  const [reResolving,setReResolving]=useState(false);
  const [edgeMode,setEdgeMode]=useState("vectors");
  const [showHud,setShowHud]=useState(true);
  const [diveInto,setDiveInto]=useState(null);
  const [selMenu,setSelMenu]=useState(null);   // {x,y,text} text-selection context menu in wiki
  const [annos,setAnnos]=useState([]);          // captured annotations (stub persistence)
  const [journey,setJourney]=useState(false);
  const [trail,setTrail]=useState(["entropy"]);
  const lastMouse=useRef({x:380,y:260});
  const interact=useRef(performance.now());   // last manipulation time (for idle self-right)
  const svgRef=useRef(null);
  const stageRef=useRef(null);                // viewport wrapper, used for screenshots

  // egg / slingshot state
  const eggs=useRef([]), shards=useRef([]), shatter=useRef({});
  const eggCooldown=useRef(0);
  const charge=useRef({active:false,since:0,armed:false});
  const [reticle,setReticle]=useState(null);

  // sound (defaults ON — actual audio graph arms on first user gesture, browser policy)
  const [sound,setSound]=useState(true);
  const soundRef=useRef(sound); soundRef.current=sound;
  const audio=useRef({ctx:null,pad:null});

  // sky (device orientation) — defaults ON
  const [sky,setSky]=useState({on:true,lat:null,lon:null});
  const skyHeading=useRef(0);

  // focus gate (so E doesn't leak into page inputs)
  const [focused,setFocused]=useState(false);
  const focusRef=useRef(false); focusRef.current=focused;
  const rootRef=useRef(null);

  const byId=()=>Object.fromEntries(sim.current.nodes.map(n=>[n.id,n]));

  useEffect(()=>{ setTrail(tr=>tr[tr.length-1]===sel?tr:[...tr,sel]); },[sel]);

  // ── audio (procedural, no files) ──
  const initAudio=()=>{
    if(audio.current.ctx) return;
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    audio.current.ctx=ctx;
    const g=ctx.createGain(); g.gain.value=0; g.connect(ctx.destination);
    const lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=700; lp.connect(g);
    [55,82.4,110,164.8].forEach((f,i)=>{
      const o=ctx.createOscillator(); o.type="sine"; o.frequency.value=f;
      const og=ctx.createGain(); og.gain.value=0.12/(i+1);
      const lfo=ctx.createOscillator(); lfo.frequency.value=0.05+i*0.02;
      const lg=ctx.createGain(); lg.gain.value=3; lfo.connect(lg); lg.connect(o.detune);
      o.connect(og); og.connect(lp); o.start(); lfo.start();
    });
    g.gain.linearRampToValueAtTime(0.5,ctx.currentTime+4);
    audio.current.pad=g;
  };
  const playShatter=()=>{
    const a=audio.current; if(!a.ctx) return;
    const ctx=a.ctx,dur=0.5;
    const buf=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.5);
    const src=ctx.createBufferSource(); src.buffer=buf;
    const bp=ctx.createBiquadFilter(); bp.type="highpass"; bp.frequency.value=2200;
    const g=ctx.createGain(); g.gain.value=0.4;
    src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start();
  };
  const toggleSound=()=>{
    setSound(s=>{
      if(!s){initAudio(); audio.current.ctx?.resume();}
      else if(audio.current.pad) audio.current.pad.gain.linearRampToValueAtTime(0,audio.current.ctx.currentTime+0.6);
      return !s;
    });
  };

  // ── sky enable (real orientation hooks + graceful fallback) ──
  const enableSky=async()=>{
    try{
      if(typeof DeviceOrientationEvent!=="undefined" && DeviceOrientationEvent.requestPermission){
        const p=await DeviceOrientationEvent.requestPermission();
        if(p!=="granted"){ setSky(s=>({...s,on:true})); return; }
      }
      window.addEventListener("deviceorientation",(e)=>{
        const h=e.webkitCompassHeading!=null?e.webkitCompassHeading:(e.alpha!=null?360-e.alpha:null);
        if(h!=null) skyHeading.current=h;
      },true);
      navigator.geolocation?.getCurrentPosition(
        pos=>setSky(s=>({...s,lat:pos.coords.latitude,lon:pos.coords.longitude,on:true})),
        ()=>setSky(s=>({...s,on:true})),{timeout:4000}
      );
      setSky(s=>({...s,on:true}));
    }catch{ setSky(s=>({...s,on:true})); }
  };
  const toggleSky=()=>{ if(sky.on) setSky(s=>({...s,on:false})); else enableSky(); };

  // ── default-on bootstrapping: heading listener + arm ambient audio on first gesture ──
  useEffect(()=>{
    const onOri=(e)=>{ const h=e.webkitCompassHeading!=null?e.webkitCompassHeading:(e.alpha!=null?360-e.alpha:null); if(h!=null) skyHeading.current=h; };
    window.addEventListener("deviceorientation",onOri,true);
    const arm=()=>{ if(soundRef.current){ initAudio(); audio.current.ctx?.resume(); } window.removeEventListener("pointerdown",arm); window.removeEventListener("keydown",arm); };
    window.addEventListener("pointerdown",arm); window.addEventListener("keydown",arm);
    return ()=>{ window.removeEventListener("deviceorientation",onOri,true); window.removeEventListener("pointerdown",arm); window.removeEventListener("keydown",arm); };
  },[]);

  // ── projectile launchers ──
  const fireSlingshot=(aimX,aimY,power)=>{
    const ang=Math.atan2(aimY-(H-30),aimX-W/2);
    eggs.current.push({mode:"ballistic",x:W/2,y:H-30,vx:Math.cos(ang)*power*3.4,vy:Math.sin(ang)*power*3.4,
      hue:Math.random()*360,life:9,seed:Math.floor(Math.random()*99999),
      spin:Math.random()<0.5?"tumble":"spiral",spinV:1.5+Math.random()*2});
  };
  const fireEgg=(targetId)=>{
    const ns=sim.current.nodes;
    const tgt=targetId?byId()[targetId]:ns[Math.floor(Math.random()*ns.length)];
    const sp=projectRef.current(tgt.p); if(!sp) return;
    eggs.current.push({mode:"homing",x:W/2,y:H-30,tx:sp.x,ty:sp.y,t:0,target:tgt.id,hue:Math.random()*360,
      seed:Math.floor(Math.random()*99999),spin:Math.random()<0.5?"tumble":"spiral",spinV:1.5+Math.random()*2});
  };

  const basis=()=>{
    const c=cam.current;
    const cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch);
    const fwd=[sy*cp,-sp,cy*cp];
    const right=[cy,0,-sy];
    const up=[right[1]*fwd[2]-right[2]*fwd[1],right[2]*fwd[0]-right[0]*fwd[2],right[0]*fwd[1]-right[1]*fwd[0]];
    return {fwd,right,up};
  };
  const project=(world)=>{
    const c=cam.current; const {fwd,right,up}=basis();
    const d=sub(world,c.pos);
    const x=d[0]*right[0]+d[1]*right[1]+d[2]*right[2];
    const y=d[0]*up[0]+d[1]*up[1]+d[2]*up[2];
    const z=d[0]*fwd[0]+d[1]*fwd[1]+d[2]*fwd[2];
    if(z<=1) return null;
    const s=FOV/z;
    return {x:W/2+x*s,y:H/2-y*s,z,s};
  };
  const projectRef=useRef(project); projectRef.current=project;
  const screenToWorldAtDepth=(sx,sy,depth)=>{
    const c=cam.current; const {fwd,right,up}=basis();
    const k=depth/FOV;
    const ndcx=(sx-W/2)*k, ndcy=-(sy-H/2)*k;
    return add(c.pos,add(scale(fwd,depth),add(scale(right,ndcx),scale(up,ndcy))));
  };

  // ── main loop ──
  useEffect(()=>{
    let raf;
    const step=()=>{
      const C=cfgRef.current;
      const ns=sim.current.nodes;
      const map={}; ns.forEach(n=>map[n.id]=n);
      const t=performance.now()*0.001;
      const grabId=nodeDrag.current?.id;
      const feral=C.przewalski;

      for(let i=0;i<ns.length;i++){
        const n=ns[i];
        if(n.id===grabId) continue;
        let f=[0,0,0];
        for(let j=0;j<ns.length;j++){
          if(i===j) continue;
          const d=sub(n.p,ns[j].p); const r=len(d);
          f=add(f,scale(d,C.charge/(r*r*r)));
        }
        f=add(f,scale(n.p,feral?-0.003:-0.012));
        // home-tether: untouched node springboks to its slot; a wrangled/re-placed
        // node's `home` has MOVED, so this tethers it to the NEW equilibrium.
        f=add(f,scale(sub(n.home,n.p),feral?0.004:0.02));
        const br=Math.sin(t*0.7+i*1.3)*C.breathe*(feral?2.2:1);
        f=add(f,[br*0.4,Math.cos(t*0.6+i)*C.breathe*(feral?2.2:1),br*0.3]);
        n._f=f;
      }
      graph.current.edges.forEach(e=>{
        const a=map[e.from],b=map[e.to]; if(!a||!b) return;
        const d=sub(b.p,a.p); const r=len(d);
        const rest=120+(1-e.conf)*160;
        const sF=(r-rest)*C.spring*(0.4+e.conf);
        const dir=scale(d,sF/r);
        if(a.id!==grabId) a._f=add(a._f,dir);
        if(b.id!==grabId) b._f=add(b._f,scale(dir,-1));
      });
      ns.forEach(n=>{ if(n.id===grabId) return; n.v=scale(add(n.v,scale(n._f,0.18)),C.damp); n.p=add(n.p,n.v); });

      // camera look (pivot about offset vertical hinge handled in drag); fall fwd
      const c=cam.current;
      c.pitch=Math.max(-1.1,Math.min(1.1,c.pitch));
      const {fwd}=basis();
      if(Math.abs(c.vFwd)>0.01 && map[selRef.current]){
        const tgt=map[selRef.current].p, toTgt=sub(tgt,c.pos), dd=len(toTgt);
        const desired=scale(toTgt,1/dd);
        const bank=Math.max(0,Math.min(0.5,220/dd));
        const travel=add(scale(fwd,1-bank),scale(desired,bank));
        const tl=len(travel)||1;
        c.pos=add(c.pos,scale([travel[0]/tl,travel[1]/tl,travel[2]/tl],c.vFwd));
        const wantYaw=Math.atan2(toTgt[0],toTgt[2]);
        let dY=((wantYaw-c.yaw+Math.PI)%(2*Math.PI))-Math.PI;
        c.yaw+=dY*0.03;
      } else {
        c.pos=add(c.pos,scale(fwd,c.vFwd));
      }
      c.vFwd*=0.84;

      // ── gentle self-right: after a beat of no manipulation, if the structure has
      //    drifted off the central zone, ease yaw/pitch (and, if it slipped behind,
      //    position) back so you can't lose it off-screen. toggle in CONTROLS. ──
      if(C.recenterIdle && !nodeDrag.current && !lookDrag.current && !charge.current.active && Math.abs(c.vFwd)<0.02 && (performance.now()-interact.current)>900){
        let cen=[0,0,0]; for(let i=0;i<ns.length;i++) cen=add(cen,ns[i].p); cen=scale(cen,1/(ns.length||1));
        const sp=project(cen);
        const offscreen = !sp || sp.x<W*0.2 || sp.x>W*0.8 || sp.y<H*0.2 || sp.y>H*0.8;
        if(offscreen){
          const toCen=sub(cen,c.pos), dd=len(toCen);
          const wantYaw=Math.atan2(toCen[0],toCen[2]);
          let dY=((wantYaw-c.yaw+Math.PI)%(2*Math.PI))-Math.PI; c.yaw+=dY*0.045;
          const wantPitch=Math.max(-1.1,Math.min(1.1,-Math.asin(Math.max(-1,Math.min(1,toCen[1]/dd)))));
          c.pitch+=(wantPitch-c.pitch)*0.045;
          if(!sp || sp.z<1){ const {fwd}=basis(); const want=sub(cen,scale(fwd,440)); c.pos=add(c.pos,scale(sub(want,c.pos),0.03)); }
        }
      }

      // charge battery
      if(charge.current.active){
        const held=performance.now()-charge.current.since;
        const power=held<1000?0:Math.min(1,(held-1000)/1400);
        const over=held>2400?(held-2400)/800:0;
        if(held>=1000) charge.current.armed=true;
        setReticle({x:lastMouse.current.x,y:lastMouse.current.y,power,over:Math.min(1.4,over)});
      }

      // eggs
      for(let i=eggs.current.length-1;i>=0;i--){
        const egg=eggs.current[i];
        if(egg.mode==="ballistic"){
          egg.x+=egg.vx; egg.y+=egg.vy; egg.vy+=0.02; egg.life-=0.0065;
          let struck=null;
          for(const n of ns){ const sp=project(n.p); if(!sp) continue; const r=Math.max(7,22*(FOV/sp.z)*0.5); if(Math.hypot(sp.x-egg.x,sp.y-egg.y)<r+5){struck=n;break;} }
          if(struck||egg.life<=0||egg.y>H+40){
            if(struck){ shatter.current[struck.id]=1; const sp=project(struck.p); if(sp) for(let s=0;s<14;s++){const a=Math.random()*Math.PI*2,sd=1+Math.random()*3;shards.current.push({x:sp.x,y:sp.y,vx:Math.cos(a)*sd,vy:Math.sin(a)*sd-1,life:1,hue:ONTO[struck.onto].c,sz:2+Math.random()*4});} if(soundRef.current) playShatter(); }
            eggs.current.splice(i,1);
          }
          continue;
        }
        egg.t+=0.045;
        if(egg.t>=1){
          shatter.current[egg.target]=1;
          const tn=map[egg.target]; const sp=project(tn.p);
          if(sp) for(let s=0;s<14;s++){const a=Math.random()*Math.PI*2,sd=1+Math.random()*3;shards.current.push({x:sp.x,y:sp.y,vx:Math.cos(a)*sd,vy:Math.sin(a)*sd-1,life:1,hue:ONTO[tn.onto].c,sz:2+Math.random()*4});}
          if(soundRef.current) playShatter();
          eggs.current.splice(i,1);
        }
      }
      for(let i=shards.current.length-1;i>=0;i--){ const sh=shards.current[i]; sh.x+=sh.vx; sh.y+=sh.vy; sh.vy+=0.18; sh.life-=0.025; if(sh.life<=0) shards.current.splice(i,1); }
      for(const id in shatter.current){ shatter.current[id]-=0.012; if(shatter.current[id]<=0) delete shatter.current[id]; }

      tick();
      raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);

    const GAME=["e","E","4","Escape"];
    const inField=(t)=>t&&(/(input|textarea|select)/i.test(t.tagName)||t.isContentEditable);
    const onKey=(e)=>{
      if(!focusRef.current) return;
      if(inField(e.target)) return;            // don't hijack typing in chat / host / model
      if(tabRef.current!=="spatial") return;   // pysanky / 411 are spatial-only
      interact.current=performance.now();
      if(GAME.includes(e.key)) e.preventDefault();
      if(e.key==="4") setJourney(j=>!j);
      if(e.key==="Escape"){ setJourney(false); setDiveInto(null); charge.current={active:false,since:0,armed:false}; setReticle(null); }
      if((e.key==="e"||e.key==="E") && !e.repeat){
        if(!lastMouse.current||(lastMouse.current.x===380&&lastMouse.current.y===260)) lastMouse.current={x:W/2,y:H/2};
        charge.current={active:true,since:performance.now(),armed:false};
        setReticle({x:lastMouse.current.x,y:lastMouse.current.y,power:0,over:0});
      }
    };
    const onKeyUp=(e)=>{
      if(!focusRef.current) return;
      if(inField(e.target)) return;
      if(tabRef.current!=="spatial") return;
      if(e.key==="e"||e.key==="E"){
        e.preventDefault();
        const ch=charge.current; if(!ch.active) return;
        const held=performance.now()-ch.since;
        if(ch.armed){
          const power=Math.min(1,(held-1000)/1400);
          const over=held>2400?(held-2400)/800:0;
          if(over>1){ const n=2+Math.floor(Math.random()*3); for(let k=0;k<n;k++) fireSlingshot(lastMouse.current.x+(Math.random()-0.5)*180,lastMouse.current.y+(Math.random()-0.5)*180,0.6+Math.random()*0.8); }
          else fireSlingshot(lastMouse.current.x,lastMouse.current.y,0.35+power*0.9);
        } else {
          const now=performance.now();
          if(now-(eggCooldown.current||0)>=90){ eggCooldown.current=now; fireEgg(); }
        }
        charge.current={active:false,since:0,armed:false};
        setReticle(null);
      }
    };
    const onWinMove=(ev)=>{ const r=svgRef.current?.getBoundingClientRect(); if(!r) return; lastMouse.current={x:(ev.clientX-r.left)*(W/r.width),y:(ev.clientY-r.top)*(H/r.height)}; };
    window.addEventListener("keydown",onKey);
    window.addEventListener("keyup",onKeyUp);
    window.addEventListener("pointermove",onWinMove);
    window.addEventListener("mousemove",onWinMove);
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener("keydown",onKey); window.removeEventListener("keyup",onKeyUp); window.removeEventListener("pointermove",onWinMove); window.removeEventListener("mousemove",onWinMove); };
  },[tick]);

  const onWheel=useCallback((e)=>{ e.preventDefault(); const c=cam.current; const {fwd}=basis(); c.vFwd+=-e.deltaY*0.05; interact.current=performance.now(); },[]);
  const evtXY=(e)=>{ const r=svgRef.current.getBoundingClientRect(); return [(e.clientX-r.left)*(W/r.width),(e.clientY-r.top)*(H/r.height)]; };
  const onDown=(e)=>{
    interact.current=performance.now();
    const [mx,my]=evtXY(e); const map=byId();
    let hit=null,hitD=1e9;
    for(const n of sim.current.nodes){ const sp=project(n.p); if(!sp) continue; const r=Math.max(7,22*(FOV/sp.z)*0.5); const dd=Math.hypot(sp.x-mx,sp.y-my); if(dd<r+4&&sp.z<hitD){hit=n;hitD=sp.z;} }
    if(hit){ nodeDrag.current={id:hit.id,depth:project(hit.p).z,moved:0,origin:[...hit.p],lastX:null,lastY:null,wrangle:!e.altKey}; setGrabbed(hit.id); return; }
    let eHit=null,eBest=14;
    for(const ed of graph.current.edges){ const a=project(map[ed.from]?.p),b=project(map[ed.to]?.p); if(!a||!b) continue; const d=segDist(mx,my,a.x,a.y,b.x,b.y); const aura=(0.8+ed.conf*3.4)+8; if(d<aura&&d<eBest){eBest=d;eHit=ed;} }
    if(eHit){ const depth=(project(map[eHit.from].p).z+project(map[eHit.to].p).z)/2; nodeDrag.current={id:eHit.from,depth,moved:0,origin:[...map[eHit.from].p],lastX:null,lastY:null,wrangle:true}; setGrabbed(eHit.from); return; }
    lookDrag.current={x:e.clientX,y:e.clientY};
  };
  const onMove=(e)=>{
    const [mx,my]=evtXY(e); lastMouse.current={x:mx,y:my};
    if(charge.current.active) return;
    if(nodeDrag.current||lookDrag.current) interact.current=performance.now();
    if(nodeDrag.current){
      const nd=nodeDrag.current; const node=byId()[nd.id];
      const lastX=nd.lastX??mx,lastY=nd.lastY??my;
      const before=screenToWorldAtDepth(lastX,lastY,nd.depth);
      let after;
      if(e.shiftKey){ nd.depth=Math.max(60,Math.min(1400,nd.depth-(my-lastY)*(nd.depth/FOV)*3)); after=screenToWorldAtDepth(lastX,my,nd.depth); }
      else after=screenToWorldAtDepth(mx,my,nd.depth);
      const wd=sub(after,before);
      if(nd.wrangle){ sim.current.nodes.forEach(p=>{p.p=add(p.p,wd);p.home=add(p.home,wd);p.v=[0,0,0];}); }
      else { node.p=add(node.p,wd); node.v=[0,0,0]; }
      nd.moved+=len(wd); nd.lastX=mx; nd.lastY=my; return;
    }
    if(lookDrag.current){
      const dx=e.clientX-lookDrag.current.x,dy=e.clientY-lookDrag.current.y;
      lookDrag.current.x=e.clientX; lookDrag.current.y=e.clientY;
      const c=cam.current;
      const ns=sim.current.nodes; let cen=[0,0,0]; ns.forEach(n=>cen=add(cen,n.p)); cen=scale(cen,1/ns.length);
      const hinge=add(c.pos,scale(sub(cen,c.pos),0.55));
      const dYaw=dx*0.0042;
      const rel=sub(c.pos,hinge); const cs=Math.cos(dYaw),sn=Math.sin(dYaw);
      c.pos=[hinge[0]+(rel[0]*cs-rel[2]*sn),c.pos[1],hinge[2]+(rel[0]*sn+rel[2]*cs)];
      c.yaw+=dYaw;
      c.pitch=Math.max(-1.1,Math.min(1.1,c.pitch+dy*0.0016));
    }
  };
  const onUp=()=>{
    const nd=nodeDrag.current;
    if(nd){
      if(!nd.wrangle){
        const node=byId()[nd.id]; const disp=dist(node.p,nd.origin);
        if(disp<60) node.home=nd.origin;
        else { node.home=[...node.p]; setSel(nd.id); setReResolving(true); inferEdges(nd.id,graph.current).then(()=>setReResolving(false)); }
      }
      nodeDrag.current=null; setGrabbed(null);
    }
    lookDrag.current=null;
  };
  const onDoubleClick=(e)=>{
    const [mx,my]=evtXY(e);
    let hit=null,hitD=1e9;
    for(const n of sim.current.nodes){ const sp=project(n.p); if(!sp) continue; const r=Math.max(7,22*(FOV/sp.z)*0.5); if(Math.hypot(sp.x-mx,sp.y-my)<r+4&&sp.z<hitD){hit=n;hitD=sp.z;} }
    if(hit){ setSel(hit.id); setDiveInto(hit.id); }
  };
  const onClickNode=(id)=>{ if((nodeDrag.current?.moved||0)<4) setSel(id); };
  const recenter=()=>{ cam.current={pos:[0,0,-560],yaw:0,pitch:0,vYaw:0,vPitch:0,vFwd:0}; sim.current.nodes.forEach((n,i)=>{const a=(i/sim.current.nodes.length)*Math.PI*2;n.home=[Math.cos(a)*220,Math.sin(a*1.3)*120,Math.sin(a)*180];}); };
  const set=(k)=>(e)=>setCfg(c=>({...c,[k]:parseFloat(e.target.value)}));

  // ── pull model list from a host into the combo dropdown ──
  const fetchModels=async(kind)=>{
    const host=kind==="embed"?conn.embedHost:conn.chatHost;
    const key =kind==="embed"?conn.embedKey :conn.chatKey;
    const oai =kind==="embed"?conn.embedOAI :conn.chatOAI;
    setModelsBusy(s=>({...s,[kind]:true}));
    const list=await listModels(host,key,oai);
    setModels(s=>({...s,[kind]:list}));
    setModelsBusy(s=>({...s,[kind]:false}));
  };

  // ── RAG retrieval over the loaded nodes (vectors if dims match query, else lexical) ──
  const retrieveKB=async(query,k=6)=>{
    const ns=graph.current.nodes, vmap=nodeVecs.current;
    const sampleVec=ns.map(n=>vmap[n.id]).find(Boolean);
    if(sampleVec){
      try{
        const qv=await embedUnified(query,conn.embedHost,conn.embedModel,conn.embedKey,conn.embedOAI);
        if(qv.length===sampleVec.length){
          const scored=ns.filter(n=>vmap[n.id]).map(n=>({n,score:cosine(qv,vmap[n.id])})).sort((a,b)=>b.score-a.score).slice(0,k);
          if(scored.length) return scored.map(s=>({id:s.n.id,title:s.n.title,onto:s.n.onto,raw:s.n.raw,score:s.score}));
        }
      }catch{}
    }
    const toks=query.toLowerCase().split(/\W+/).filter(w=>w.length>2);
    const scored=ns.map(n=>{const hay=((n.title||"")+" "+(n.raw||"")).toLowerCase();let sc=0;toks.forEach(tk=>{if(hay.includes(tk))sc++;});return {n,score:sc};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,k);
    const pick=scored.length?scored:ns.slice(0,Math.min(k,ns.length)).map(n=>({n,score:0}));
    return pick.map(s=>({id:s.n.id,title:s.n.title,onto:s.n.onto,raw:s.n.raw,score:s.score}));
  };

  const sendChat=async(preset)=>{
    const q=(preset!=null?preset:chat.q).trim(); if(!q||chat.busy) return;
    const history=chat.msgs.filter(m=>m.content).map(m=>({role:m.role,content:m.content}));
    setChat(c=>({...c,q:"",busy:true,msgs:[...c.msgs,{role:"user",content:q},{role:"assistant",content:""}]}));
    if(!normBase(conn.chatHost)){
      setChat(c=>{const m=[...c.msgs];m[m.length-1]={role:"assistant",content:"No chat host set. Open ⊞ data → CHAT and enter an Ollama ip:port (e.g. 192.168.0.41:11434) or an OpenAI-compatible base URL + API key, then ↻ models to pick one."};return {...c,busy:false,msgs:m};});
      return;
    }
    try{
      const top=await retrieveKB(q);
      const context=top.map(n=>`[${n.title}]\n${(n.raw||"").slice(0,1200)}`);
      await chatStream({host:conn.chatHost,model:conn.chatModel,key:conn.chatKey,oai:conn.chatOAI,system:KB_SYSTEM,context,
        messages:[...history,{role:"user",content:q}],
        onToken:(tok)=>setChat(c=>{const m=[...c.msgs];const last=m[m.length-1];m[m.length-1]={...last,content:(last.content||"")+tok};return {...c,msgs:m};})});
      setChat(c=>{const m=[...c.msgs];m[m.length-1]={...m[m.length-1],sources:top};return {...c,busy:false,msgs:m};});
    }catch(err){
      setChat(c=>{const m=[...c.msgs];m[m.length-1]={role:"assistant",content:"⚠ chat failed: "+err.message+" — check the Chat host/model in ⊞ data (and that the server permits this origin; native Tauri bypasses CORS)."};return {...c,busy:false,msgs:m};});
    }
  };

  // citation chip → fly-to in space, or open in reader
  const onSource=(id)=>{
    if(!graph.current.nodes.find(n=>n.id===id)) return;
    if(tabRef.current==="reader"){ setReaderId(id); }
    else { setSel(id); cam.current.vFwd+=6; interact.current=performance.now(); }
  };
  const onShot=()=>snapshotEl(stageRef.current);

  const map=byId();
  const projected=sim.current.nodes.map(n=>({...n,sp:project(n.p)})).filter(n=>n.sp);
  const selEdges=graph.current.edges.filter(e=>e.from===sel||e.to===sel);
  const selNode=map[sel];
  const t=performance.now()*0.001;
  const G=cfg.glow;

  return (
    <div ref={rootRef} tabIndex={0}
      onMouseEnter={()=>{rootRef.current?.focus();setFocused(true);}}
      onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
      style={{fontFamily:"ui-sans-serif, system-ui",color:"#dfe7ff",background:"#05060f",borderRadius:16,overflow:"hidden",border:`1px solid ${focused?"#2a4a7a":"#1b2140"}`,maxWidth:900,margin:"0 auto",outline:"none"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,rowGap:8,flexWrap:"wrap",padding:"10px 14px",borderBottom:"1px solid #161b38",background:"linear-gradient(90deg,#0a0d22,#070818)"}}>
        <div style={{width:9,height:9,borderRadius:9,background:"#7ee8fa",boxShadow:"0 0 10px #7ee8fa"}}/>
        <strong style={{letterSpacing:1,fontSize:13}}>THINKSPACE</strong>
        <span style={{fontSize:11,color:"#7a86b8"}}>6DoF semantic navigator</span>
        <div style={{display:"flex",gap:2,marginLeft:6,background:"#0a0e22",border:"1px solid #1f2a55",borderRadius:9,padding:2}}>
          {[["spatial","✦ space"],["reader","▤ reader"]].map(([k,lab])=>(
            <button key={k} onClick={()=>setTab(k)} style={{border:"none",borderRadius:7,padding:"4px 11px",fontSize:11,cursor:"pointer",fontWeight:tab===k?700:400,color:tab===k?"#05060f":"#9ad8ff",background:tab===k?"#7ee8fa":"transparent",transition:"all .15s"}}>{lab}</button>
          ))}
        </div>
        <div style={{flex:1}}/>
        <button onClick={()=>setIngest(s=>({...s,open:!s.open}))} style={{...btn,color:graphVer>0?"#05060f":"#9ad8ff",background:graphVer>0?"#ffd479":"rgba(126,232,250,0.08)"}}>⊞ data</button>
        <button onClick={()=>setChat(c=>({...c,open:!c.open}))} style={{...btn,color:chat.open?"#05060f":"#9ad8ff",background:chat.open?"#7cffc4":"rgba(126,232,250,0.08)"}} title="chat with your knowledge (RAG)">✦ chat</button>
        <button onClick={onShot} style={btn} title="screenshot the viewport">📷</button>
        {tab==="spatial"&&<button onClick={recenter} style={btn}>⟲ recenter</button>}
        {tab==="spatial"&&<button onClick={toggleSky} style={{...btn,color:sky.on?"#05060f":"#9ad8ff",background:sky.on?"#9db4ff":"rgba(126,232,250,0.08)"}} title="real constellations for your heading — squint">✶ sky</button>}
        <button onClick={toggleSound} style={{...btn,color:sound?"#05060f":"#9ad8ff",background:sound?"#7cffc4":"rgba(126,232,250,0.08)"}}>{sound?"♪ on":"♪ off"}</button>
        {tab==="spatial"&&<button onClick={()=>setJourney(j=>!j)} style={{...btn,color:journey?"#05060f":"#9ad8ff",background:journey?"#7ee8fa":"rgba(126,232,250,0.08)"}}>411</button>}
        {tab==="spatial"&&<button onClick={()=>setEdgeMode(m=>m==="vectors"?"flow":"vectors")} style={btn}>edge: {edgeMode}</button>}
      </div>

      <div ref={stageRef} style={{position:"relative",aspectRatio:"760 / 520"}}>
        {ingest.open&&(
          <div style={{position:"absolute",top:10,left:"50%",transform:"translateX(-50%)",zIndex:12,width:340,maxHeight:"calc(100% - 20px)",overflowY:"auto",padding:16,borderRadius:14,background:"rgba(12,16,38,0.96)",backdropFilter:"blur(16px)",border:"1px solid #2a3a6a",boxShadow:"0 20px 60px #000a"}}>
            <div style={{display:"flex",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:11,letterSpacing:1,color:"#ffd479",textShadow:"0 0 8px #ffd479"}}>⊞ DATA · CONNECTIONS · INGEST</span>
              <div style={{flex:1}}/>
              <span onClick={()=>setIngest(s=>({...s,open:false}))} style={{cursor:"pointer",color:"#7a86b8",fontSize:14}}>✕</span>
            </div>
            <p style={{fontSize:11,color:"#9aa6d8",lineHeight:1.6,margin:"0 0 12px"}}>
              Point <b style={{color:"#7cffc4"}}>embeddings</b> + <b style={{color:"#7cffc4"}}>chat</b> at any Ollama <i>ip:port</i> (they can differ) or an OpenAI-compatible base URL. Blank embed host = built-in demo. Then ↻ to pull the model list.
            </p>
            <div style={{fontSize:10,letterSpacing:1,color:"#7ee8fa",textShadow:"0 0 8px #7ee8fa",margin:"0 0 8px"}}>CONNECTIONS</div>
            <ConnFields kind="embed" conn={conn} setConn={setConn} models={models.embed} busy={modelsBusy.embed} onList={()=>fetchModels("embed")} title="embeddings" accent="#7cffc4" phHost="192.168.0.41:11434 (blank = demo)" phModel="qwen3-embedding:8b"/>
            <ConnFields kind="chat" conn={conn} setConn={setConn} models={models.chat} busy={modelsBusy.chat} onList={()=>fetchModels("chat")} title="chat / inference" accent="#7ee8fa" phHost="192.168.0.41:11434 or OpenAI URL" phModel="gemma4:e2b"/>
            <div style={{fontSize:10,letterSpacing:1,color:"#5d6796",textAlign:"center",margin:"4px 0 10px"}}>— ingest / load —</div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <div style={{flex:1}}>
                <label style={{display:"block",fontSize:10,color:"#7a86b8",marginBottom:4}}>max nodes · {load.maxNodes}</label>
                <input type="range" min="50" max="800" step="25" value={load.maxNodes} onChange={e=>setLoad(s=>({...s,maxNodes:parseInt(e.target.value)}))} style={{width:"100%",accentColor:"#7cffc4"}}/>
              </div>
              <div style={{flex:1}}>
                <label style={{display:"block",fontSize:10,color:"#7a86b8",marginBottom:4}}>min edge · {load.minConf.toFixed(2)}</label>
                <input type="range" min="0" max="0.9" step="0.05" value={load.minConf} onChange={e=>setLoad(s=>({...s,minConf:parseFloat(e.target.value)}))} style={{width:"100%",accentColor:"#7cffc4"}}/>
              </div>
            </div>
            <label style={{display:"block",textAlign:"center",padding:"12px",border:"1.5px dashed #7cffc4",borderRadius:10,cursor:"pointer",fontSize:12,color:"#7cffc4",background:"rgba(124,255,196,0.05)",marginBottom:8}}>
              ⬆ load graph JSON (any name)
              <input type="file" accept=".json,application/json" style={{display:"none"}} onChange={e=>e.target.files[0]&&loadGraphJson(e.target.files[0])}/>
            </label>
            {load.shown>0&&<div style={{fontSize:10,color:load.shown<load.total?"#ffd479":"#7cffc4",textAlign:"center",marginBottom:8}}>showing {load.shown} of {load.total} nodes{load.shown<load.total?" (most-connected slice — raise cap or lower min-edge for more)":""}</div>}
            {load.err&&<div style={{fontSize:10,color:"#ff7a7a",textAlign:"center",marginBottom:8}}>{load.err}</div>}
            <label style={{display:"block",fontSize:10,color:"#7a86b8",marginBottom:4}}>edge threshold · {ingest.thresh.toFixed(2)} (cosine)</label>
            <input type="range" min="0.3" max="0.95" step="0.01" value={ingest.thresh} onChange={e=>setIngest(s=>({...s,thresh:parseFloat(e.target.value)}))} style={{width:"100%",accentColor:"#ffd479",marginBottom:12}}/>
            {ingest.busy ? (
              <div style={{fontSize:11,color:"#ffd479",textAlign:"center",padding:"8px 0"}}>◌ embedding {ingest.count}/{ingest.total}…</div>
            ) : (
              <label style={{display:"block",textAlign:"center",padding:"14px",border:"1.5px dashed #2a3a6a",borderRadius:10,cursor:"pointer",fontSize:12,color:"#9ad8ff",background:"rgba(126,232,250,0.04)"}}>
                choose folder of .md files
                <input type="file" webkitdirectory="" directory="" multiple style={{display:"none"}} onChange={e=>ingestFiles(e.target.files)}/>
              </label>
            )}
            {graphVer>0&&<div style={{fontSize:10,color:"#7cffc4",textAlign:"center",marginTop:8}}>✓ live graph: {graph.current.nodes.length} nodes · {graph.current.edges.length} edges</div>}
          </div>
        )}
        {tab==="spatial" && (<>
        <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width="100%" viewBox={`0 0 ${W} ${H}`}
          onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onDoubleClick={onDoubleClick}
          style={{display:"block",cursor:nodeDrag.current||lookDrag.current?"grabbing":"grab",background:"radial-gradient(ellipse at 50% 40%, #0b1030 0%, #05060f 70%)"}}>
          <defs>
            <radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fff" stopOpacity="0.9"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></radialGradient>
            {Object.entries(ONTO).map(([k,v])=>(
              <radialGradient key={k} id={`sph-${k}`} cx="36%" cy="32%" r="72%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95"/><stop offset="16%" stopColor={v.c} stopOpacity="0.9"/>
                <stop offset="58%" stopColor={v.c} stopOpacity="0.42"/><stop offset="100%" stopColor="#04060f" stopOpacity="1"/>
              </radialGradient>
            ))}
            <radialGradient id="vig" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#000" stopOpacity="0"/><stop offset="62%" stopColor="#000" stopOpacity="0"/><stop offset="100%" stopColor="#000" stopOpacity="0.55"/></radialGradient>
            {Object.entries(REL).map(([k,v])=>(<marker key={k} id={`arrow-${k}`} markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={v.c}/></marker>))}
          </defs>

          {Array.from({length:60}).map((_,i)=>{const x=(i*137.5)%W,y=(i*89.3)%H;return <circle key={i} cx={x} cy={y} r={(i%3)*0.4+0.3} fill="#8893c8" opacity={0.25}/>;})}

          {/* orientation-aware constellations: drift with heading, faint by design */}
          {sky.on && (()=>{
            const hdg=skyHeading.current||0;
            const CON=[
              {n:"Orion",az:20,stars:[[0,0],[8,4],[16,2],[6,14],[14,16],[10,24],[4,30]],links:[[0,1],[1,2],[1,3],[2,4],[3,4],[3,5],[4,5],[5,6]]},
              {n:"Ursa Major",az:120,stars:[[0,0],[10,2],[20,0],[28,6],[26,16],[16,18],[8,14]],links:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]]},
              {n:"Cassiopeia",az:220,stars:[[0,8],[8,0],[16,8],[24,2],[32,10]],links:[[0,1],[1,2],[2,3],[3,4]]},
              {n:"Scorpius",az:300,stars:[[0,0],[6,4],[12,6],[18,10],[20,18],[16,26],[22,30]],links:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]]},
            ];
            return CON.map((c,ci)=>{
              let rel=((c.az-hdg+540)%360)-180;
              if(Math.abs(rel)>90) return null;
              const cx=W/2+(rel/90)*(W*0.46), cy=60+(ci*90)%(H-160);
              return (
                <g key={c.n} opacity={0.16} style={{filter:"drop-shadow(0 0 2px #aab8ff)"}}>
                  {c.links.map(([a,b],li)=>(<line key={li} x1={cx+c.stars[a][0]} y1={cy+c.stars[a][1]} x2={cx+c.stars[b][0]} y2={cy+c.stars[b][1]} stroke="#9fb0ff" strokeWidth={0.5}/>))}
                  {c.stars.map(([sx,sy],si)=>(<circle key={si} cx={cx+sx} cy={cy+sy} r={si===0?1.3:0.9} fill="#dfe7ff"/>))}
                  <text x={cx+4} y={cy-4} fontSize={6} fill="#7a86b8" opacity={0.7} style={{letterSpacing:1}}>{c.n}</text>
                </g>
              );
            });
          })()}

          {graph.current.edges.map((e,i)=>{
            const a=project(map[e.from]?.p),b=project(map[e.to]?.p); if(!a||!b) return null;
            const active=e.from===sel||e.to===sel; const col=REL[e.rel].c; const wgt=0.8+e.conf*3.4;
            const mx=(a.x+b.x)/2,my=(a.y+b.y)/2; const nx=-(b.y-a.y),ny=(b.x-a.x); const nl=Math.hypot(nx,ny)||1;
            const bow=Math.sin(t*1.2+i)*14*(cfg.breathe/0.5); const cx=mx+(nx/nl)*bow,cy=my+(ny/nl)*bow;
            return (
              <path key={i} d={`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`} fill="none" stroke={col} strokeWidth={wgt} strokeLinecap="round"
                opacity={active?1:0.26} markerEnd={edgeMode==="vectors"?`url(#arrow-${e.rel})`:undefined}
                strokeDasharray={edgeMode==="flow"?"6 9":"none"} style={{filter:active?`drop-shadow(0 0 ${6*G}px ${col})`:"none"}}>
                {edgeMode==="flow"&&active&&<animate attributeName="stroke-dashoffset" from="15" to="0" dur="0.7s" repeatCount="indefinite"/>}
              </path>
            );
          })}

          {projected.sort((a,b)=>b.sp.z-a.sp.z).map((n,idx)=>{
            const r=Math.max(5,22*(FOV/n.sp.z)*0.5); const col=ONTO[n.onto].c;
            const isSel=n.id===sel,isHov=n.id===hover,isGrab=n.id===grabbed;
            const sh=shatter.current[n.id]||0; const grow=sh>0?(1-sh)*0.9+0.1:1;
            const pulse=1+Math.sin(t*1.6+idx*0.9)*0.05*(cfg.breathe/0.5);
            const rr=r*pulse*(isGrab?1.18:1)*grow; const wob=Math.sin(t*2+idx)*0.04;
            return (
              <g key={n.id} onClick={()=>onClickNode(n.id)} onMouseEnter={()=>setHover(n.id)} onMouseLeave={()=>setHover(null)} style={{cursor:"grab"}}>
                <circle cx={n.sp.x} cy={n.sp.y} r={rr*2.6} fill="url(#halo)" opacity={((isSel||isGrab)?0.55:0.2)*G} style={{mixBlendMode:"screen"}}/>
                <circle cx={n.sp.x} cy={n.sp.y} r={rr*1.6} fill={col} opacity={((isSel||isGrab)?0.36:0.13)*G} style={{filter:`blur(${rr*0.45}px)`,mixBlendMode:"screen"}}/>
                <ellipse cx={n.sp.x} cy={n.sp.y} rx={rr*(1+wob)} ry={rr*(1-wob)} fill={`url(#sph-${n.onto})`} stroke={col} strokeWidth={isSel||isGrab?1.8:0.8} strokeOpacity={0.9} style={{filter:`drop-shadow(0 0 ${(isGrab?22:isSel?16:7)*G}px ${col})`}}/>
                {cfg.vignette&&<ellipse cx={n.sp.x} cy={n.sp.y} rx={rr*(1+wob)} ry={rr*(1-wob)} fill="url(#vig)" style={{mixBlendMode:"multiply"}}/>}
                <ellipse cx={n.sp.x-rr*0.04} cy={n.sp.y-rr*0.04} rx={rr*0.97} ry={rr*0.97} fill="none" stroke={col} strokeWidth={rr*0.09} strokeOpacity={0.5} strokeDasharray={`${rr*2.6} ${rr*8}`} strokeDashoffset={rr*1.3} style={{mixBlendMode:"screen"}}/>
                <ellipse cx={n.sp.x-rr*0.34} cy={n.sp.y-rr*0.36} rx={rr*0.26} ry={rr*0.2} fill="#fff" opacity={0.8} style={{filter:`blur(${rr*0.08}px)`}}/>
                {isGrab&&(()=>{ const cg=rr*1.42; const spin=t*22%360; const ring=(rx,ry,rot)=>(<ellipse cx={n.sp.x} cy={n.sp.y} rx={rx} ry={ry} transform={`rotate(${rot} ${n.sp.x} ${n.sp.y})`} fill="none" stroke={col} strokeWidth={1.1} strokeOpacity={0.85} style={{filter:`drop-shadow(0 0 4px ${col})`}}/>);
                  return (<g style={{pointerEvents:"none"}}>{ring(cg,cg*0.34,spin)}{ring(cg,cg*0.34,spin+60)}{ring(cg,cg*0.34,spin+120)}<circle cx={n.sp.x} cy={n.sp.y} r={cg} fill="none" stroke={col} strokeWidth={1.1} strokeOpacity={0.9} style={{filter:`drop-shadow(0 0 5px ${col})`}}/>{ring(cg*0.34,cg,spin*0.5)}{[0,60,120,180,240,300].map(a=>{const rad=(a+spin)*Math.PI/180;return <circle key={a} cx={n.sp.x+Math.cos(rad)*cg} cy={n.sp.y+Math.sin(rad)*cg} r={1.8} fill={col} style={{filter:`drop-shadow(0 0 3px ${col})`}}/>;})}</g>);
                })()}
                {(isHov||isSel||isGrab||r>9)&&<text x={n.sp.x} y={n.sp.y+rr+14} textAnchor="middle" fontSize={Math.max(9,Math.min(13,r*0.7))} fill="#e6ecff" style={{pointerEvents:"none",textShadow:"0 0 6px #000"}}>{n.title}</text>}
              </g>
            );
          })}

          {eggs.current.map((egg,i)=>{
            let x,y,trailPts;
            if(egg.mode==="ballistic"){ x=egg.x; y=egg.y; trailPts=[0,1,2,3].map(k=>({x:egg.x-egg.vx*k*1.4,y:egg.y-egg.vy*k*1.4,k})); }
            else { const ease=egg.t*egg.t; x=W/2+(egg.tx-W/2)*ease; y=(H-30)+(egg.ty-(H-30))*ease-Math.sin(egg.t*Math.PI)*60; trailPts=[0,1,2,3].map(k=>{const tt=Math.max(0,egg.t-k*0.04);return{x:W/2+(egg.tx-W/2)*(tt*tt),y:(H-30)+(egg.ty-(H-30))*(tt*tt)-Math.sin(tt*Math.PI)*60,k};}); }
            const age=egg.mode==="ballistic"?(9-egg.life):egg.t*4; const spinV=egg.spinV||4; const rot=age*spinV*60;
            const isSpiral=egg.spin==="spiral"; const squash=isSpiral?1:(0.55+0.45*Math.abs(Math.cos(age*spinV)));
            const sd=egg.seed||0; const band1=(sd%5)+2,band2=((sd>>3)%4)+1,dots=(sd>>6)%6+3; const hue2=(egg.hue+40+(sd%80))%360;
            return (
              <g key={`egg${i}`}>
                {trailPts.map(tp=>(<circle key={tp.k} cx={tp.x} cy={tp.y} r={7-tp.k*1.4} fill={`hsl(${30+tp.k*8}, 100%, ${60-tp.k*8}%)`} opacity={0.6-tp.k*0.13} style={{filter:"blur(1px)"}}/>))}
                <g transform={`translate(${x},${y}) rotate(${rot}) scale(${isSpiral?1:squash}, 1)`}>
                  <ellipse rx={13} ry={18} fill={`hsl(${egg.hue},68%,54%)`} stroke="#fff9" strokeWidth={0.8} style={{filter:`drop-shadow(0 0 12px hsl(${egg.hue},100%,60%))`}}/>
                  {Array.from({length:band1}).map((_,b)=>{const yy=-18+(b+1)*(36/(band1+1));return <line key={b} x1={-13} y1={yy} x2={13} y2={yy} stroke={`hsl(${hue2},80%,75%)`} strokeWidth={1} opacity={0.85}/>;})}
                  <path d="M0,-18 V18" stroke="#fff8" strokeWidth={0.8}/>
                  {Array.from({length:band2}).map((_,b)=>{const yy=-10+b*8;return <path key={b} d={`M-8,${yy} q8,6 16,0`} stroke="#ffffffcc" strokeWidth={0.8} fill="none"/>;})}
                  {Array.from({length:dots}).map((_,b)=>{const a=(b/dots)*Math.PI*2+sd;return <circle key={b} cx={Math.cos(a)*7} cy={Math.sin(a)*10} r={1.4} fill={`hsl(${hue2},90%,85%)`}/>;})}
                </g>
              </g>
            );
          })}
          {shards.current.map((sh,i)=>(<polygon key={`sh${i}`} points={`${sh.x},${sh.y} ${sh.x+sh.sz},${sh.y+sh.sz*0.6} ${sh.x+sh.sz*0.3},${sh.y+sh.sz*1.4}`} fill={sh.hue} opacity={sh.life*0.9} style={{filter:`drop-shadow(0 0 3px ${sh.hue})`}}/>))}

          {reticle&&(()=>{
            const over=reticle.over||0; const qv=over>0?over*6:0;
            const jx=reticle.x+(Math.random()-0.5)*qv, jy=reticle.y+(Math.random()-0.5)*qv;
            const glitch=over>1; const pwHue=90-reticle.power*90;
            const ringCol=glitch?`hsl(${Math.random()*360},100%,60%)`:`hsl(${pwHue},90%,58%)`;
            return (
              <g style={{pointerEvents:"none"}} opacity={glitch&&Math.random()>0.7?0.4:1}>
                <line x1={W/2} y1={H-30} x2={jx} y2={jy} stroke={ringCol} strokeWidth={1+reticle.power*2} strokeDasharray={glitch?"2 3":"3 4"} opacity={0.7}/>
                <circle cx={jx} cy={jy} r={16+reticle.power*10} fill="none" stroke={ringCol} strokeWidth={2} style={{filter:`drop-shadow(0 0 ${6+over*8}px ${ringCol})`}}/>
                <circle cx={jx} cy={jy} r={2.5} fill="#fff"/>
                {[[-22,0,-9,0],[9,0,22,0],[0,-22,0,-9],[0,9,0,22]].map((l,k)=>(<line key={k} x1={jx+l[0]} y1={jy+l[1]} x2={jx+l[2]} y2={jy+l[3]} stroke="#fff" strokeWidth={1.5}/>))}
                {glitch&&Array.from({length:5}).map((_,k)=>(<rect key={k} x={jx-30+Math.random()*60} y={jy-30+Math.random()*60} width={10+Math.random()*30} height={1+Math.random()*3} fill={`hsl(${Math.random()*360},100%,60%)`} opacity={0.6}/>))}
                {glitch&&<text x={jx} y={jy-28} textAnchor="middle" fontSize={9} fill="#ff5a5a" style={{filter:"drop-shadow(0 0 4px #ff0000)"}}>{Math.random()>0.5?"⚠ OVERCHARGE":"█▓▒ T4RG3T_L0$T"}</text>}
                <g transform={`translate(${jx+30}, ${jy-24})`}>
                  <rect x={-2} y={-2} width={12} height={52} rx={2} fill="rgba(0,0,0,0.5)" stroke="#2a3a6a" strokeWidth={1}/>
                  {Array.from({length:8}).map((_,k)=>{const cp=(8-k)/8;const lit=reticle.power>=cp-0.06;const co=glitch&&Math.random()>0.5;return <rect key={k} x={0} y={k*6} width={8} height={5} rx={1} fill={lit?(co?`hsl(${Math.random()*360},100%,60%)`:`hsl(${90-cp*90},90%,55%)`):"#1a2240"} opacity={lit?(0.6+(over>0?Math.random()*0.4:0.4)):1}/>;})}
                </g>
              </g>
            );
          })()}
        </svg>

        {grabbed&&<div style={{position:"absolute",top:14,left:"50%",transform:"translateX(-50%)",padding:"6px 14px",borderRadius:20,background:"rgba(126,232,250,0.12)",border:"1px solid #2a4a7a",fontSize:11,color:"#9ad8ff",backdropFilter:"blur(8px)"}}>handling <b>{map[grabbed]?.title}</b> · drag hauls the field · Alt-grab plucks one · Shift = depth</div>}

        {diveInto&&(()=>{
          const dn=map[diveInto]; const col=ONTO[dn.onto].c; const links=graph.current.edges.filter(e=>e.from===diveInto||e.to===diveInto);
          return (
            <div onClick={()=>setDiveInto(null)} style={{position:"absolute",inset:0,zIndex:5,background:"radial-gradient(ellipse at 50% 45%, rgba(10,14,40,0.7), rgba(4,6,16,0.94))",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",animation:"tsZoom 0.4s cubic-bezier(.2,.9,.3,1)"}}>
              <style>{`@keyframes tsZoom{from{opacity:0;transform:scale(1.25)}to{opacity:1;transform:scale(1)}}`}</style>
              <div onClick={ev=>ev.stopPropagation()} style={{width:440,maxHeight:"86%",overflowY:"auto",borderRadius:18,background:"rgba(9,12,30,0.82)",border:`1px solid ${col}55`,boxShadow:`0 0 60px ${col}33, inset 0 0 40px ${col}11`}}>
                <div style={{position:"relative",height:120,borderRadius:"18px 18px 0 0",overflow:"hidden",background:`radial-gradient(circle at 38% 35%, ${col}, #04060f 72%)`}}>
                  <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 50% 50%, transparent 55%, #000a 100%)"}}/>
                  <div style={{position:"absolute",bottom:12,left:18}}>
                    <div style={{fontSize:10,letterSpacing:1,color:col,textShadow:`0 0 8px ${col}`}}>{ONTO[dn.onto].label.toUpperCase()} · ZIM ARTICLE</div>
                    <div style={{fontSize:22,fontWeight:800,color:"#fff",textShadow:"0 2px 12px #000"}}>{dn.title}</div>
                  </div>
                  <button onClick={()=>setDiveInto(null)} style={{position:"absolute",top:10,right:12,background:"rgba(0,0,0,0.4)",border:`1px solid ${col}55`,borderRadius:8,color:"#fff",cursor:"pointer",fontSize:11,padding:"3px 9px"}}>✕ surface</button>
                </div>
                <div style={{padding:"16px 20px"}}
                  onMouseUp={(ev)=>{
                    const s=window.getSelection&&window.getSelection();
                    const txt=s&&s.toString().trim();
                    if(txt&&txt.length>0){
                      const rect=ev.currentTarget.getBoundingClientRect();
                      setSelMenu({x:ev.clientX-rect.left+20,y:ev.clientY-rect.top+96,text:txt});
                    } else setSelMenu(null);
                  }}>
                  <p style={{fontSize:13,lineHeight:1.7,color:"#c8d2f5",margin:"0 0 14px"}}>
                    <span style={{float:"left",fontSize:30,fontWeight:800,color:col,lineHeight:0.9,paddingRight:8,textShadow:`0 0 10px ${col}`}}>{dn.title[0]}</span>
                    {dn.raw ? dn.raw : `${dn.title} sits in this region of the knowledge-space, bound to its neighbors by the semantic vectors radiating out. In the live build this panel streams the actual ZIM/Wikipedia article via litert-lm, inline links resolving to baubles you dive straight into.`} {!dn.raw&&"Select any of this text to annotate, highlight, share, drop a voice note, or scribble on it."}
                  </p>
                  <div style={{fontSize:10,letterSpacing:1,color:"#7a86b8",margin:"16px 0 8px"}}>OUTBOUND VECTORS</div>
                  {links.map((e,i)=>{const other=e.from===diveInto?e.to:e.from;return (<div key={i} onClick={()=>{setSelMenu(null);setDiveInto(other);}} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:5,borderRadius:10,cursor:"pointer",background:"rgba(255,255,255,0.03)",border:`1px solid ${REL[e.rel].c}22`}}><span style={{width:7,height:7,borderRadius:7,background:REL[e.rel].c,boxShadow:`0 0 6px ${REL[e.rel].c}`}}/><span style={{fontSize:11,color:REL[e.rel].c,width:56}}>{REL[e.rel].label}</span><span style={{flex:1,fontSize:13,color:"#e6ecff"}}>{map[other].title}</span><span style={{fontSize:14,color:"#5d6796"}}>↳</span></div>);})}
                  {annos.length>0&&<div style={{fontSize:10,letterSpacing:1,color:"#7a86b8",margin:"16px 0 8px"}}>YOUR MARKS ({annos.length})</div>}
                  {annos.map((a,i)=>(<div key={i} style={{fontSize:11,color:"#9aa6d8",padding:"4px 0",borderLeft:`2px solid ${col}`,paddingLeft:8,marginBottom:4}}><span style={{color:col}}>{a.kind}</span> · "{a.text.slice(0,42)}{a.text.length>42?"…":""}"</div>))}
                </div>
                {selMenu&&(()=>{
                  const items=[["✎","annotate"],["▤","highlight"],["⤴","share"],["🎙","voice note"],["✐","scribble"]];
                  return (
                    <div style={{position:"absolute",left:Math.min(selMenu.x,270),top:selMenu.y,zIndex:9,background:"rgba(12,16,38,0.96)",backdropFilter:"blur(14px)",border:`1px solid ${col}55`,borderRadius:12,boxShadow:`0 10px 40px #000a, 0 0 24px ${col}22`,overflow:"hidden",minWidth:150}}>
                      {items.map(([ic,label],i)=>(
                        <div key={i} onClick={()=>{ setAnnos(a=>[...a,{kind:label,text:selMenu.text}]); setSelMenu(null); window.getSelection&&window.getSelection().removeAllRanges(); }}
                          style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:12,color:"#dfe7ff",cursor:"pointer",borderBottom:i<items.length-1?"1px solid #1b2245":"none"}}
                          onMouseEnter={e=>e.currentTarget.style.background=`${col}18`} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <span style={{width:16,textAlign:"center",color:col}}>{ic}</span>{label}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}

        {journey&&(
          <div style={{position:"absolute",inset:0,background:"rgba(4,6,16,0.82)",backdropFilter:"blur(3px)",display:"flex",flexDirection:"column",padding:18}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span style={{fontSize:11,letterSpacing:1,color:"#7ee8fa",textShadow:"0 0 8px #7ee8fa"}}>◷ THE 411 · YOUR JOURNEY</span>
              <span style={{fontSize:10,color:"#7a86b8"}}>{trail.length} stops · 4 or Esc to dive back in</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H-60}`} style={{flex:1,width:"100%"}}>
              {(()=>{ const pts=trail.map((id,i)=>{const x=60+(i/Math.max(1,trail.length-1))*(W-120);const y=(H-60)/2+Math.sin(i*1.3)*90+Math.cos(i*0.7)*40;return{id,x,y,onto:map[id].onto,title:map[id].title};});
                return (<>{pts.slice(1).map((p,i)=>{const a=pts[i];const mx=(a.x+p.x)/2,my=(a.y+p.y)/2-28;return <path key={i} d={`M${a.x},${a.y} Q${mx},${my} ${p.x},${p.y}`} fill="none" stroke="#3a4a7a" strokeWidth={2} strokeDasharray="2 5" markerEnd="url(#jar)"/>;})}
                  <defs><marker id="jar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#5a6aaa"/></marker></defs>
                  {pts.map((p,i)=>(<g key={i} style={{cursor:"pointer"}} onClick={()=>{setSel(p.id);setJourney(false);}}><circle cx={p.x} cy={p.y} r={14} fill="#0a0e22" stroke={ONTO[p.onto].c} strokeWidth={2} style={{filter:`drop-shadow(0 0 8px ${ONTO[p.onto].c})`}}/><text x={p.x} y={p.y+30} textAnchor="middle" fontSize={10} fill="#dfe7ff">{p.title}</text><text x={p.x} y={p.y+4} textAnchor="middle" fontSize={9} fill="#7a86b8">{i+1}</text></g>))}</>);
              })()}
            </svg>
          </div>
        )}

        <div style={{position:"absolute",top:0,left:0,height:"100%",width:200,transform:trayOpen?"translateX(0)":"translateX(-200px)",transition:"transform 0.32s cubic-bezier(.2,.9,.3,1)",background:"rgba(10,14,34,0.66)",backdropFilter:"blur(16px)",borderRight:"1px solid #1f2a55",padding:14,boxShadow:"8px 0 40px #0008",overflowY:"auto"}}>
          <div style={{fontSize:10,letterSpacing:1,color:"#7ee8fa",textShadow:"0 0 8px #7ee8fa",marginBottom:10}}>CONTROLS</div>
          <Slider label="float / drift" min="0.62" max="0.95" step="0.01" val={cfg.damp} on={set("damp")} fmt={v=>v.toFixed(2)}/>
          <Slider label="look coast" min="0.7" max="0.95" step="0.01" val={cfg.lookDamp} on={set("lookDamp")} fmt={v=>v.toFixed(2)}/>
          <Slider label="spring stiffness" min="0.004" max="0.05" step="0.002" val={cfg.spring} on={set("spring")} fmt={v=>v.toFixed(3)}/>
          <Slider label="node spacing" min="3000" max="18000" step="500" val={cfg.charge} on={set("charge")} fmt={v=>(v/1000).toFixed(1)+"k"}/>
          <Slider label="breathing" min="0" max="1.4" step="0.05" val={cfg.breathe} on={set("breathe")} fmt={v=>v.toFixed(2)}/>
          <Slider label="glow" min="0.3" max="2" step="0.1" val={cfg.glow} on={set("glow")} fmt={v=>v.toFixed(1)}/>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:11,color:"#9aa6d8",marginTop:10,cursor:"pointer"}}><input type="checkbox" checked={cfg.vignette} onChange={e=>setCfg(c=>({...c,vignette:e.target.checked}))}/>bubble vignettes</label>
          <label title="when you stop touching it, the field eases back to centre" style={{display:"flex",alignItems:"center",gap:8,fontSize:11,color:"#9aa6d8",marginTop:8,cursor:"pointer"}}><input type="checkbox" checked={cfg.recenterIdle} onChange={e=>setCfg(c=>({...c,recenterIdle:e.target.checked}))}/>self-right (keep centered)</label>
          <button onClick={()=>setCfg(c=>({damp:0.78,lookDamp:0.86,spring:0.018,charge:9000,breathe:0.5,glow:1,vignette:true,recenterIdle:true,przewalski:c.przewalski}))} style={{...btn,width:"100%",marginTop:12}}>reset feel</button>
          <label title="said neigh" style={{display:"flex",alignItems:"center",gap:8,fontSize:10,color:"#4a5680",marginTop:22,cursor:"pointer",opacity:0.55}}><input type="checkbox" checked={!!cfg.przewalski} onChange={e=>setCfg(c=>({...c,przewalski:e.target.checked}))}/>Przewalski</label>
        </div>
        <button onClick={()=>setTrayOpen(o=>!o)} style={{position:"absolute",top:"50%",marginTop:-34,left:trayOpen?200:0,transition:"left 0.32s cubic-bezier(.2,.9,.3,1)",width:26,height:68,background:"rgba(14,18,42,0.82)",backdropFilter:"blur(10px)",border:"1px solid #1f2a55",borderLeft:trayOpen?"1px solid #1f2a55":"none",borderRadius:"0 10px 10px 0",color:"#9ad8ff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,padding:0}}>{trayOpen?"‹":"›"}</button>

        {showHud&&selNode&&(
          <div style={{position:"absolute",top:14,right:14,width:230,padding:14,borderRadius:14,background:"rgba(14,18,42,0.55)",backdropFilter:"blur(14px)",border:`1px solid ${ONTO[selNode.onto].c}44`,boxShadow:`0 0 30px ${ONTO[selNode.onto].c}22`}}>
            <div style={{fontSize:10,letterSpacing:1,color:ONTO[selNode.onto].c,textShadow:`0 0 8px ${ONTO[selNode.onto].c}`}}>{ONTO[selNode.onto].label.toUpperCase()}</div>
            <div style={{fontSize:17,fontWeight:700,margin:"4px 0 8px"}}>{selNode.title}</div>
            <div style={{fontSize:11,color:"#9aa6d8",marginBottom:8}}>{reResolving?"◌ re-resolving vectors…":`${selEdges.length} semantic vectors`}</div>
            {selEdges.map((e,i)=>{const other=e.from===sel?e.to:e.from;const dir=e.from===sel?"→":"←";return (<div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,padding:"3px 0"}}><span style={{width:6,height:6,borderRadius:6,background:REL[e.rel].c,boxShadow:`0 0 6px ${REL[e.rel].c}`}}/><span style={{color:REL[e.rel].c,width:52}}>{REL[e.rel].label}</span><span style={{color:"#7a86b8"}}>{dir}</span><span style={{flex:1,color:"#dfe7ff",cursor:"pointer"}} onClick={()=>setSel(other)}>{map[other].title}</span><span style={{color:"#5d6796",fontSize:9}}>{(e.conf*100|0)}%</span></div>);})}
          </div>
        )}

        {showHud&&(
          <div style={{position:"absolute",bottom:12,right:12,padding:"8px 12px",borderRadius:10,background:"rgba(10,14,34,0.5)",backdropFilter:"blur(10px)",border:"1px solid #1b2140",fontSize:10,color:"#8893c8",lineHeight:1.7,maxWidth:300}}>
            <div><b style={{color:"#cdd6ff"}}>drag</b> pivot · <b style={{color:"#cdd6ff"}}>scroll</b> fall fwd · <b style={{color:"#cdd6ff"}}>grab</b> haul · <b style={{color:"#cdd6ff"}}>dbl-click</b> dive · <b style={{color:"#cdd6ff"}}>E</b> pysanky</div>
            <div style={{marginTop:4,display:"flex",gap:8,flexWrap:"wrap"}}>{Object.values(ONTO).map(o=>(<span key={o.label} style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:7,height:7,borderRadius:7,background:o.c,boxShadow:`0 0 5px ${o.c}`}}/>{o.label}</span>))}</div>
          </div>
        )}
        </>)}

        {tab==="reader" && (
          <ReaderView
            nodes={graph.current.nodes}
            edges={graph.current.edges}
            sel={readerId}
            onSel={setReaderId}
            annos={annos}
            addAnno={(kind,text)=>setAnnos(a=>[...a,{kind,text}])}
            onSpatial={(id)=>{setSel(id);setReaderId(id);setTab("spatial");cam.current.vFwd+=5;interact.current=performance.now();}}
            onChat={(title)=>{setChat(c=>({...c,open:true}));sendChat("Tell me about "+title+".");}}
          />
        )}

        {chat.open && (
          <ChatPanel
            chat={chat}
            setChat={setChat}
            onSend={()=>sendChat()}
            onSource={onSource}
            onClose={()=>setChat(c=>({...c,open:false}))}
            connOk={!!normBase(conn.chatHost)}
          />
        )}

        <div style={{position:"absolute",bottom:8,right:10,zIndex:4,pointerEvents:"none",textAlign:"right",lineHeight:1.5}}>
          <div style={{fontSize:9,color:"#3a4468",letterSpacing:"0.04em",userSelect:"none"}}>
            v1.02.build
          </div>
          <div style={{fontSize:9,color:"#2d3352",letterSpacing:"0.03em",userSelect:"none"}}>
            © 2026 Robin L. M. Cheung. All Rights Reserved
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({label,min,max,step,val,on,fmt}){
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#9aa6d8",marginBottom:3}}><span>{label}</span><span style={{color:"#7ee8fa"}}>{fmt(val)}</span></div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={on} style={{width:"100%",accentColor:"#7ee8fa",height:3}}/>
    </div>
  );
}

const btn={background:"rgba(126,232,250,0.08)",color:"#9ad8ff",border:"1px solid #1f2a55",borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer"};

const inS={width:"100%",boxSizing:"border-box",background:"#0a0e22",border:"1px solid #1f2a55",borderRadius:8,color:"#dfe7ff",fontSize:11,padding:"6px 8px"};

// ── connection editor (used twice: embeddings + chat) ──
function ConnFields({kind,conn,setConn,models,busy,onList,title,accent,phHost,phModel}){
  const up=(field,val)=>setConn(c=>({...c,[kind+field]:val}));
  const host=conn[kind+"Host"]||"", model=conn[kind+"Model"]||"", key=conn[kind+"Key"]||"", oai=!!conn[kind+"OAI"];
  const listId=kind+"-models";
  return (
    <div style={{marginBottom:12,padding:"10px",borderRadius:10,background:"rgba(126,232,250,0.03)",border:"1px solid #182146"}}>
      <div style={{display:"flex",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:10,letterSpacing:1,color:accent,textTransform:"uppercase"}}>{title}</span>
        <div style={{flex:1}}/>
        <label style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:"#7a86b8",cursor:"pointer"}}><input type="checkbox" checked={oai} onChange={e=>up("OAI",e.target.checked)}/>OpenAI-compat</label>
      </div>
      <input value={host} onChange={e=>up("Host",e.target.value)} placeholder={phHost} style={{...inS,marginBottom:6}}/>
      <div style={{display:"flex",gap:6}}>
        <input list={listId} value={model} onChange={e=>up("Model",e.target.value)} placeholder={phModel} style={{...inS,flex:1}}/>
        <datalist id={listId}>{models.map(m=>(<option key={m} value={m}/>))}</datalist>
        <button onClick={onList} disabled={busy} style={{...btn,whiteSpace:"nowrap",opacity:busy?0.6:1}}>{busy?"…":"↻ models"}</button>
      </div>
      {oai&&<input type="password" value={key} onChange={e=>up("Key",e.target.value)} placeholder="API key" style={{...inS,marginTop:6}}/>}
      {models.length>0&&<div style={{fontSize:9,color:"#5d6796",marginTop:4}}>{models.length} models · type to filter</div>}
    </div>
  );
}

// ── reader lens: linear, navigable html/markdown ──
function ReaderView({nodes,edges,sel,onSel,annos,addAnno,onSpatial,onChat}){
  const [q,setQ]=useState("");
  const [sort,setSort]=useState("az");
  const [menu,setMenu]=useState(null);
  const byId={}; nodes.forEach(n=>byId[n.id]=n);
  const deg={}; edges.forEach(e=>{deg[e.from]=(deg[e.from]||0)+1; deg[e.to]=(deg[e.to]||0)+1;});
  let list=nodes.filter(n=>!q||(n.title||"").toLowerCase().includes(q.toLowerCase())||(n.raw||"").toLowerCase().includes(q.toLowerCase()));
  list=[...list].sort((a,b)=> sort==="links"?((deg[b.id]||0)-(deg[a.id]||0)) : sort==="type"?String(a.onto).localeCompare(String(b.onto)) : String(a.title||"").localeCompare(String(b.title||"")));
  const node=byId[sel]||nodes[0];
  if(!node) return <div style={{position:"absolute",inset:0,zIndex:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#5d6796",fontSize:13,background:"#05060f"}}>no documents — load a graph or ingest a folder in ⊞ data</div>;
  const oc=ONTO[node.onto]||{c:"#7ee8fa",label:"node"};
  const bodyHtml=node.html?scrubHtml(node.html):mdToHtml(node.raw||node.title||"");
  const links=edges.filter(e=>e.from===node.id||e.to===node.id).map(e=>{const oid=e.from===node.id?e.to:e.from;return {oid,node:byId[oid],rel:e.rel};}).filter(x=>x.node);
  const resolve=(href)=>{ if(!href) return null; let h=String(href).trim(); if(/^https?:|^mailto:/i.test(h)) return {ext:h}; h=h.replace(/^#/,""); try{h=decodeURIComponent(h);}catch(e){} const low=h.toLowerCase(); const hit=nodes.find(n=>String(n.id).toLowerCase()===low)||nodes.find(n=>String(n.title||"").toLowerCase()===low)||nodes.find(n=>low.length>2&&String(n.title||"").toLowerCase().includes(low)); return hit?{id:hit.id}:{ext:href}; };
  const onBodyClick=(e)=>{ const a=e.target.closest&&e.target.closest("a"); if(!a) return; e.preventDefault(); const r=resolve(a.getAttribute("href")); if(r&&r.id) onSel(r.id); else if(r&&r.ext) window.open(r.ext,"_blank","noopener"); };
  const onBodyUp=(e)=>{ const s=window.getSelection&&window.getSelection(); const text=s?String(s).trim():""; if(!text){setMenu(null);return;} const host=e.currentTarget.getBoundingClientRect(); let rect=host; try{rect=s.getRangeAt(0).getBoundingClientRect();}catch(err){} setMenu({x:rect.left-host.left+rect.width/2,y:rect.top-host.top,w:host.width,text}); };
  return (
    <div style={{position:"absolute",inset:0,zIndex:8,display:"flex",background:"radial-gradient(ellipse at 50% 0%, #0b1030 0%, #05060f 70%)"}}>
      <div style={{width:230,flexShrink:0,borderRight:"1px solid #161b38",display:"flex",flexDirection:"column",background:"rgba(8,11,28,0.6)"}}>
        <div style={{padding:"10px 10px 8px"}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="filter…" style={{...inS}}/>
          <div style={{display:"flex",gap:4,marginTop:6}}>
            {[["az","A·Z"],["links","links"],["type","type"]].map(([k,lab])=>(
              <button key={k} onClick={()=>setSort(k)} style={{flex:1,border:"none",borderRadius:6,padding:"4px 0",fontSize:9,cursor:"pointer",color:sort===k?"#05060f":"#9ad8ff",background:sort===k?"#7ee8fa":"rgba(126,232,250,0.08)"}}>{lab}</button>
            ))}
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"0 6px 10px"}}>
          {list.map(n=>{const c=(ONTO[n.onto]||{}).c||"#7ee8fa";const on=n.id===node.id;return (
            <div key={n.id} onClick={()=>onSel(n.id)} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 8px",borderRadius:8,cursor:"pointer",marginBottom:2,background:on?"rgba(126,232,250,0.12)":"transparent",border:on?"1px solid #2a4a7a":"1px solid transparent"}}>
              <span style={{width:7,height:7,borderRadius:7,flexShrink:0,background:c,boxShadow:`0 0 6px ${c}`}}/>
              <span style={{flex:1,fontSize:11,color:on?"#fff":"#bcc6ee",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.title}</span>
              <span style={{fontSize:9,color:"#5d6796"}}>{deg[n.id]||0}</span>
            </div>
          );})}
          {list.length===0&&<div style={{fontSize:10,color:"#5d6796",padding:10,textAlign:"center"}}>nothing matches</div>}
        </div>
      </div>
      <div style={{flex:1,position:"relative",overflowY:"auto"}}>
        <div style={{maxWidth:680,margin:"0 auto",padding:"26px 30px 60px"}}>
          <div style={{fontSize:10,letterSpacing:1,color:oc.c,textShadow:`0 0 8px ${oc.c}`,textTransform:"uppercase"}}>{oc.label}</div>
          <h1 style={{fontSize:26,fontWeight:800,margin:"6px 0 14px",color:"#f2f5ff",lineHeight:1.15}}>{node.title}</h1>
          <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
            <button onClick={()=>onSpatial(node.id)} style={{...btn,borderColor:"#2a4a7a"}}>◎ show in space</button>
            <button onClick={()=>onChat(node.title)} style={{...btn,color:"#05060f",background:"#7cffc4",border:"none"}}>✦ ask about this</button>
          </div>
          <div onClick={onBodyClick} onMouseUp={onBodyUp} style={{fontSize:14,lineHeight:1.75,color:"#c9d2f5",wordBreak:"break-word"}} dangerouslySetInnerHTML={{__html:bodyHtml}}/>
          {links.length>0&&(
            <div style={{marginTop:28,paddingTop:16,borderTop:"1px solid #161b38"}}>
              <div style={{fontSize:10,letterSpacing:1,color:"#7a86b8",marginBottom:10}}>LINKS</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {links.map((l,i)=>{const c=(ONTO[l.node.onto]||{}).c||"#7ee8fa";const rl=(REL[l.rel]||{}).label||l.rel;return (
                  <button key={i} onClick={()=>onSel(l.oid)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 11px",borderRadius:20,cursor:"pointer",fontSize:11,color:"#dfe7ff",background:"rgba(14,18,42,0.7)",border:`1px solid ${c}55`}}>
                    <span style={{width:6,height:6,borderRadius:6,background:c,boxShadow:`0 0 5px ${c}`}}/>{l.node.title}<span style={{fontSize:9,color:"#7a86b8"}}>{rl}</span>
                  </button>
                );})}
              </div>
            </div>
          )}
          {annos&&annos.length>0&&(
            <div style={{marginTop:24,fontSize:10,color:"#5d6796"}}>{annos.length} annotation{annos.length>1?"s":""} saved this session</div>
          )}
        </div>
        {menu&&(
          <div style={{position:"absolute",left:Math.max(8,Math.min(menu.x-94,menu.w-196)),top:Math.max(4,menu.y-46),display:"flex",gap:2,padding:4,borderRadius:10,background:"rgba(14,18,42,0.95)",backdropFilter:"blur(12px)",border:"1px solid #2a3a6a",boxShadow:"0 10px 30px #000a",zIndex:9}}>
            {[["✎","annotate"],["▤","highlight"],["⤴","share"],["🎙","voice note"],["✐","scribble"]].map(([ic,lab])=>(
              <button key={lab} title={lab} onClick={()=>{addAnno(lab,menu.text);setMenu(null);if(window.getSelection)window.getSelection().removeAllRanges();}} style={{border:"none",background:"transparent",color:"#9ad8ff",cursor:"pointer",fontSize:14,padding:"4px 7px",borderRadius:7}}>{ic}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── chat-with-knowledge side panel (RAG over the graph) ──
function ChatPanel({chat,setChat,onSend,onSource,onClose,connOk}){
  const scroller=useRef(null);
  useEffect(()=>{ const el=scroller.current; if(el) el.scrollTop=el.scrollHeight; },[chat.msgs,chat.busy]);
  const onKey=(e)=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); onSend(); } };
  return (
    <div style={{position:"absolute",top:0,right:0,height:"100%",width:340,maxWidth:"92%",zIndex:13,display:"flex",flexDirection:"column",background:"rgba(8,11,28,0.92)",backdropFilter:"blur(18px)",borderLeft:"1px solid #1f2a55",boxShadow:"-12px 0 50px #000a"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",borderBottom:"1px solid #161b38"}}>
        <span style={{width:8,height:8,borderRadius:8,background:"#7cffc4",boxShadow:"0 0 10px #7cffc4"}}/>
        <strong style={{fontSize:12,letterSpacing:1}}>CHAT WITH KNOWLEDGE</strong>
        <div style={{flex:1}}/>
        <button onClick={()=>setChat(c=>({...c,msgs:[]}))} title="clear" style={{...btn,padding:"3px 8px"}}>⌫</button>
        <button onClick={onClose} title="close" style={{...btn,padding:"3px 9px"}}>✕</button>
      </div>
      <div ref={scroller} style={{flex:1,overflowY:"auto",padding:"14px"}}>
        {chat.msgs.length===0&&(
          <div style={{fontSize:12,color:"#7a86b8",lineHeight:1.7,padding:"6px 2px"}}>
            Ask anything about the nodes you've loaded — answers cite the baubles they came from, and the citations are clickable.
            {!connOk&&<div style={{marginTop:10,padding:"8px 10px",borderRadius:8,background:"rgba(255,212,121,0.08)",border:"1px solid #4a3a1a",color:"#ffd479",fontSize:11}}>⚠ Set a <b>Chat host</b> in ⊞ data → CHAT first (Ollama ip:port or an OpenAI-compatible URL + key).</div>}
          </div>
        )}
        {chat.msgs.map((m,i)=>{const me=m.role==="user";const busyLast=chat.busy&&i===chat.msgs.length-1&&!m.content;return (
          <div key={i} style={{marginBottom:14}}>
            <div style={{fontSize:9,letterSpacing:1,color:me?"#7ee8fa":"#7cffc4",marginBottom:4}}>{me?"YOU":"KB"}</div>
            <div style={{fontSize:13,lineHeight:1.65,color:me?"#dfe7ff":"#c9d2f5",whiteSpace:"pre-wrap",wordBreak:"break-word",background:me?"rgba(126,232,250,0.06)":"transparent",padding:me?"8px 10px":"0",borderRadius:me?10:0}}>{busyLast?"◌":m.content}</div>
            {m.sources&&m.sources.length>0&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                {m.sources.map((s,j)=>{const c=(ONTO[s.onto]||{}).c||"#7ee8fa";return (
                  <button key={j} onClick={()=>onSource(s.id)} title="show this source" style={{display:"flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:14,cursor:"pointer",fontSize:10,color:"#dfe7ff",background:"rgba(14,18,42,0.8)",border:`1px solid ${c}55`}}>
                    <span style={{width:5,height:5,borderRadius:5,background:c,boxShadow:`0 0 5px ${c}`}}/>{s.title}
                  </button>
                );})}
              </div>
            )}
          </div>
        );})}
      </div>
      <div style={{display:"flex",gap:8,padding:"12px 14px",borderTop:"1px solid #161b38",alignItems:"flex-end"}}>
        <textarea value={chat.q} onChange={e=>setChat(c=>({...c,q:e.target.value}))} onKeyDown={onKey} rows={1} placeholder="ask your knowledge…" style={{...inS,resize:"none",maxHeight:120,fontFamily:"inherit",lineHeight:1.5}}/>
        <button onClick={onSend} disabled={chat.busy||!chat.q.trim()} style={{...btn,color:"#05060f",background:chat.busy||!chat.q.trim()?"#3a4a6a":"#7cffc4",border:"none",padding:"8px 12px",opacity:chat.busy?0.7:1}}>↑</button>
      </div>
    </div>
  );
}
