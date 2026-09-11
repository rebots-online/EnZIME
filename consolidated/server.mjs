import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {openStore} from './storage.mjs';
import {purchaseLink} from './billing.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export async function createApp({root,checkout=null}={}){
 const store=await openStore(root||process.env.MBA_ROBIN_HOME||path.join(process.env.XDG_DATA_HOME||process.env.LOCALAPPDATA||path.join(os.homedir(),'.local','share'),'mba.robin'));
 const server=http.createServer(async(req,res)=>{
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
 const host=req.headers.host;if(!/^127\.0\.0\.1:\d+$/.test(host||''))return json(403,{error:'Local broker requires 127.0.0.1'});
 const url=new URL(req.url,`http://${host}`);
 if(req.headers.origin&&req.headers.origin!==`http://${host}`)return json(403,{error:'Cross-origin access denied'});
 if(req.headers['sec-fetch-site']==='cross-site')return json(403,{error:'Cross-site access denied'});
 if(req.method==='POST'&&req.headers['x-mba-client']!=='enzime')return json(403,{error:'Missing application header'});
 try{
 if(req.method==='GET'&&url.pathname==='/api/config')return json(200,{storage:'mba.robin',checkoutReady:!!checkout,checkoutPath:checkout?'/checkout':null,release:'preview',capabilities:{pdf:true,finalText:true,media:true,zimReader:false,modelRuntime:false,liveEntitlements:false}});
 if(req.method==='GET'&&url.pathname==='/checkout'){if(!checkout)return json(503,{error:'Checkout is not configured. No payment has been taken.'});res.writeHead(303,{Location:checkout});return res.end();}
 if(req.method==='GET'&&url.pathname==='/api/assets')return json(200,store.list());
 if(req.method==='POST'&&url.pathname==='/api/assets'){
 const kind=url.searchParams.get('kind');const mime={pdf:'application/pdf',audio:'audio/mpeg',video:'video/mp4',final:'text/plain; charset=utf-8',zim:'application/octet-stream',model:'application/octet-stream'}[kind];
 return json(201,await store.put(req,{name:url.searchParams.get('name'),kind,mime}));}
 const state=url.pathname.match(/^\/api\/state\/([a-f0-9]{64})$/);
 if(state){if(req.method==='GET')return json(200,store.readState(state[1]));if(req.method==='POST'){let body='';for await(const c of req){body+=c;if(body.length>65536)return json(413,{error:'State too large'});}const value=JSON.parse(body);store.saveState(state[1],value);return json(200,value);}}
 const asset=url.pathname.match(/^\/api\/assets\/([a-f0-9]{64})\/bytes$/);
 if(req.method==='GET'&&asset){const item=store.get(asset[1]);if(!item)return json(404,{error:'Unknown asset'});const range=req.headers.range;let start=0,end=item.size-1;
 if(range){const m=range.match(/^bytes=(\d+)-(\d*)$/);if(!m)return json(416,{error:'Unsupported range'});start=Number(m[1]);end=m[2]?Number(m[2]):end;if(start>end||end>=item.size){res.setHeader('Content-Range',`bytes */${item.size}`);return json(416,{error:'Invalid range'});}res.setHeader('Content-Range',`bytes ${start}-${end}/${item.size}`);}
 res.writeHead(range?206:200,{'Content-Type':item.mime,'Content-Length':Math.max(0,end-start+1),'Accept-Ranges':'bytes','Content-Security-Policy':"default-src 'none'; sandbox"});if(!item.size)return res.end();createReadStream(store.file(item.id),{start,end}).pipe(res);return;}
 if(req.method!=='GET')return json(405,{error:'Method not allowed'});
 const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));const target=path.resolve(here,'public',rel);if(!target.startsWith(path.join(here,'public')+path.sep))return json(403,{error:'Invalid path'});
 const ext=path.extname(target);const types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.wasm':'application/wasm'};
 const body=await readFile(target);res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"});res.end(body);
 }catch(e){json(e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'Resource unavailable':e.message});}
 });server.on('close',()=>store.close());return {server,store};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {server}=await createApp({checkout:purchaseLink()});server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('EnZIME preview: http://127.0.0.1:'+server.address().port));}
