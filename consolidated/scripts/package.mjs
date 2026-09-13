#!/usr/bin/env node
/** Offline application packaging. Run only after build + verification have passed. */
import {cp,mkdir,mkdtemp,readFile,readdir,rm,stat,writeFile,chmod,access,realpath,lstat,readlink} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';

const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const usage=`Usage: node scripts/package.mjs [options]
  --out DIRECTORY       Release output directory (default: ./dist)
  --node-license FILE   Complete LICENSE from the exact bundled Node release
  --node-binary FILE    Linux Node binary (default: the current process executable)
  --llama-runtime DIR   Include pinned, verified llama.cpp b10809 CPU runtime
  --without-runtime     Package application only; installed Node 24+ is required
  --name NAME           Archive folder name (safe letters, digits, dots and dashes)
  --help                Print this help; does not build or package

Build with npm run build and run npm test first. This script performs no network
requests, does not install dependencies, and does not include user data or models.
Legacy ZIM codecs xz and bzip2 are optional tools supplied by the host OS.`;
function parseArgs(args){const o={};for(let i=0;i<args.length;i++){const a=args[i];if(a==='--help'){o.help=true;continue;}if(a==='--without-runtime'){o.withoutRuntime=true;continue;}const key={'--out':'out','--node-license':'nodeLicense','--node-binary':'nodeBinary','--llama-runtime':'llamaRuntime','--name':'name'}[a];if(!key||!args[i+1]||args[i+1].startsWith('--'))throw Error(`Invalid option ${a}\n${usage}`);o[key]=args[++i];}return o;}
async function exists(file){try{await access(file);return true;}catch{return false;}}
async function sha256(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function walkFiles(root,prefix=''){const result=[];for(const entry of (await readdir(path.join(root,prefix),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const relative=path.join(prefix,entry.name);if(entry.isDirectory())result.push(...await walkFiles(root,relative));else if(entry.isFile())result.push(relative);}return result;}
async function packageInventory(modules,prefix='node_modules'){
 const output=[];
 for(const entry of await readdir(modules,{withFileTypes:true})){
  if(!entry.isDirectory()||entry.name.startsWith('.'))continue;
  if(entry.name.startsWith('@')){output.push(...await packageInventory(path.join(modules,entry.name),`${prefix}/${entry.name}`));continue;}
  const directory=path.join(modules,entry.name),pkgFile=path.join(directory,'package.json');if(!await exists(pkgFile))continue;
  const pkg=JSON.parse(await readFile(pkgFile,'utf8')),names=await readdir(directory);
  output.push({name:pkg.name,version:pkg.version,license:pkg.license||'See package source',source:typeof pkg.repository==='string'?pkg.repository:pkg.repository?.url||pkg.homepage||null,path:`${prefix}/${entry.name}`,notices:names.filter(name=>/^(?:licen[cs]e|copying|notice|copyright)/i.test(name)).map(name=>`${prefix}/${entry.name}/${name}`)});
  if(await exists(path.join(directory,'node_modules')))output.push(...await packageInventory(path.join(directory,'node_modules'),`${prefix}/${entry.name}/node_modules`));
 }
 return output;
}
function command(command,args,cwd){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,stdio:'inherit',shell:false});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(`${command} exited with code ${code}`)));});}
function git(...args){try{return execFileSync('git',args,{cwd:here,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{return null;}}

const opts=parseArgs(process.argv.slice(2));
if(opts.help){console.log(usage);process.exit(0);}
if(Number(process.versions.node.split('.')[0])<24)throw Error('Packaging requires Node 24 or later.');
const pkg=JSON.parse(await readFile(path.join(here,'package.json'),'utf8'));
for(const required of ['server.mjs','storage.mjs','zim.mjs','knowledge.mjs','documents.mjs','dyndon.mjs','runtime-service.mjs','chatbot/index.mjs','public/index.html','public/app.mjs','public/app.js','public/mesh.mjs','public/vendor/pdfjs/build/pdf.mjs','public/vendor/pdfjs/build/pdf.worker.mjs','public/thinkspace.js','node_modules/linkedom/package.json','launch.sh','launch.cmd','docs/RUNNING.md'])if(!await exists(path.join(here,required)))throw Error(`Missing ${required}. Install dependencies and complete npm run build before packaging.`);
const runtime=!opts.withoutRuntime,nodeBinary=path.resolve(opts.nodeBinary||process.execPath);
let nodeVersion=null,nodeLicense=null,runtimeDependencies=null;
if(runtime){
 if(process.platform!=='linux')throw Error('Bundled-runtime packaging currently targets Linux; use --without-runtime for source/application packaging.');
 nodeVersion=execFileSync(nodeBinary,['--version'],{encoding:'utf8'}).trim();if(Number(nodeVersion.replace(/^v/,'').split('.')[0])<24)throw Error('The bundled Node runtime must be version 24 or later.');
 const candidates=[opts.nodeLicense,path.join(path.dirname(path.dirname(await realpath(nodeBinary))),'LICENSE')].filter(Boolean);
 for(const candidate of candidates)if(await exists(candidate)){nodeLicense=path.resolve(candidate);break;}
 if(!nodeLicense)throw Error(`Supply --node-license with the complete https://github.com/nodejs/node/blob/${nodeVersion}/LICENSE before redistributing this runtime.`);
 const license=await readFile(nodeLicense,'utf8');if(!license.includes('Copyright Node.js contributors')||license.length<10000)throw Error('Expected the complete Node.js license and bundled third-party notices.');
 try{runtimeDependencies=execFileSync('ldd',[nodeBinary],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{runtimeDependencies='Unable to inspect shared-library dependencies during packaging.';}
}
let llamaInfo=null,llamaFiles=[],llamaDirectory=null;
if(opts.llamaRuntime){
 if(process.platform!=='linux'||process.arch!=='x64')throw Error('The pinned llama.cpp bundle requires Linux x86-64.');
 llamaDirectory=await realpath(path.resolve(opts.llamaRuntime));
 const release='b10809',commit='5266f24da75dc449bd56cbed7addb9c8e4a6a73e',archiveName='llama-b10809-bin-ubuntu-x64.tar.gz';
 const archiveSha256='5e34434ddc6d03cd1584f403201aff0d4bd1a5793a72ff7e286532dfd1e4b941';
 const sourceArchive=path.join(path.dirname(llamaDirectory),archiveName);
 if(!await exists(sourceArchive)||await sha256(sourceArchive)!==archiveSha256)throw Error(`The verified official ${archiveName} must sit beside the supplied runtime directory. Obtain it from https://github.com/ggml-org/llama.cpp/releases/tag/${release}.`);
 const allowed=/^(?:llama-server|lib(?:ggml|llama|mtmd)[A-Za-z0-9._-]*\.so(?:\.[0-9.]+)?|LICENSE(?:[._-][A-Za-z0-9.-]+)?|NOTICE(?:[._-][A-Za-z0-9.-]+)?)$/;
 const entries=await readdir(llamaDirectory);
 for(const required of ['llama-server','LICENSE','libllama-server-impl.so'])if(!entries.includes(required))throw Error(`Missing llama.cpp runtime component ${required}.`);
 for(const name of entries.filter(name=>allowed.test(name)).sort()){
  const source=path.join(llamaDirectory,name),resolved=await realpath(source),info=await lstat(source);
  if(!resolved.startsWith(llamaDirectory+path.sep)||(!info.isFile()&&!info.isSymbolicLink()))throw Error('Inference runtime contains an invalid file or external symlink.');
  const relative=path.relative(llamaDirectory,resolved);if(relative.includes(path.sep))throw Error('Inference runtime layout differs from the pinned release.');
  const official=execFileSync('tar',['-xOf',sourceArchive,`llama-b10809/${relative}`],{maxBuffer:64*1024**2,stdio:['ignore','pipe','pipe']});
  const expected=createHash('sha256').update(official).digest('hex'),actual=await sha256(source);if(actual!==expected)throw Error(`Inference runtime integrity mismatch: ${name}`);
  const symlink=info.isSymbolicLink()?await readlink(source):null;if(symlink&&(path.isAbsolute(symlink)||symlink.includes('..')))throw Error('Inference runtime symlinks must stay relative and inside the bundle.');
  llamaFiles.push({name,sha256:actual,bytes:official.length,symlink});
 }
 const binary=path.join(llamaDirectory,'llama-server');
 const versionResult=spawnSync(binary,['--version'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});if(versionResult.error||versionResult.status!==0)throw Error('The supplied llama.cpp runtime cannot execute on this packaging host.');
 const version=[versionResult.stdout,versionResult.stderr].filter(Boolean).join('\n').trim();
 if(!version.includes('build 10809')||!version.includes('5266f24da'))throw Error('Unexpected llama.cpp runtime version.');
 let libraries;try{libraries=execFileSync('ldd',[path.join(llamaDirectory,'libllama-server-impl.so')],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).replaceAll(llamaDirectory,'runtime/llama').trim();}catch{libraries='Unable to inspect shared libraries during packaging.';}
 llamaInfo={engine:'llama.cpp',release,commit,profile:'Linux x86-64 CPU reference',version,source:`https://github.com/ggml-org/llama.cpp/tree/${commit}`,releaseUrl:`https://github.com/ggml-org/llama.cpp/releases/tag/${release}`,archiveUrl:`https://github.com/ggml-org/llama.cpp/releases/download/${release}/${archiveName}`,archiveSha256,sharedLibraryDependencies:libraries,files:llamaFiles,modelWeightsIncluded:false,turboQuantIncluded:false};
}
const packageName=opts.name||`enzime-${pkg.version}-${runtime?`linux-${process.arch}`:'application'}`;
if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(packageName))throw Error('Invalid package folder name.');
const output=path.resolve(opts.out||path.join(here,'dist'));await mkdir(output,{recursive:true});
const archive=path.join(output,`${packageName}.tar.gz`);if(await exists(archive))throw Error(`Output already exists: ${archive}. Choose another --name or remove the prior artifact explicitly.`);
const staging=await mkdtemp(path.join(os.tmpdir(),'enzime-package-')),target=path.join(staging,packageName);let complete=false;
try{
 await mkdir(target,{recursive:true});
 // Explicit allowlist: never recurse into data roots, previous releases or the git checkout.
 for(const entry of await readdir(here,{withFileTypes:true})){
  if(!entry.isFile()||(!/\.(?:mjs|jsx|tsx)$/.test(entry.name)&&!['package.json','package-lock.json','README.md','launch.sh','launch.cmd'].includes(entry.name)&&!/^(?:LICENSE|NOTICE|COPYING)/.test(entry.name)))continue;
  await cp(path.join(here,entry.name),path.join(target,entry.name));
 }
 for(const directory of ['public','chatbot','docs','test','scripts','node_modules'])if(await exists(path.join(here,directory)))await cp(path.join(here,directory),path.join(target,directory),{recursive:true,dereference:false,verbatimSymlinks:true});
 if(await exists(path.join(here,'native','fixtures'))){await mkdir(path.join(target,'native'),{recursive:true});await cp(path.join(here,'native','fixtures'),path.join(target,'native','fixtures'),{recursive:true});if(await exists(path.join(here,'native','README.md')))await cp(path.join(here,'native','README.md'),path.join(target,'native','README.md'));}
 await chmod(path.join(target,'launch.sh'),0o755);
 await writeFile(path.join(target,'node_modules','.enzime-platform'),`${process.platform}-${process.arch}\n`);
 if(runtime){await mkdir(path.join(target,'runtime'),{recursive:true});await cp(nodeBinary,path.join(target,'runtime','node'));await chmod(path.join(target,'runtime','node'),0o755);await cp(nodeLicense,path.join(target,'runtime','LICENSE'));}
 if(llamaInfo){const directory=path.join(target,'runtime','llama');await mkdir(directory,{recursive:true});for(const file of llamaFiles)await cp(path.join(llamaDirectory,file.name),path.join(directory,file.name),{dereference:false,verbatimSymlinks:true});await chmod(path.join(directory,'llama-server'),0o755);}
 const dependencies=await packageInventory(path.join(target,'node_modules'));
 await writeFile(path.join(target,'THIRD_PARTY_NOTICES.md'),`# Third-party components\n\nThis bundle retains installed dependency sources, license files and notices. The package inventory below records installed versions, including build tools retained to make the bundle reproducible.\n\n${runtime?`## Node.js ${nodeVersion}\n\nRuntime license and bundled notices: [runtime/LICENSE](runtime/LICENSE). Source: https://github.com/nodejs/node/tree/${nodeVersion}. Official release: https://nodejs.org/dist/${nodeVersion}/.\n\n`:''}${llamaInfo?`## llama.cpp ${llamaInfo.release} — CPU reference runtime\n\nMIT license: [runtime/llama/LICENSE](runtime/llama/LICENSE). Official source: ${llamaInfo.source}. Release: ${llamaInfo.releaseUrl}. The downloaded release archive is SHA-256 pinned, and every bundled runtime file is checked against it. No model weights or TurboQuant implementation are included. System OpenSSL 3, libgomp and standard C/C++ runtime libraries are required and are not redistributed.\n\n`:''}## JavaScript packages\n\n${dependencies.sort((a,b)=>a.name.localeCompare(b.name)).map(d=>`- **${d.name} ${d.version}** — ${typeof d.license==='string'?d.license:JSON.stringify(d.license)}; source: ${d.source||'package.json in bundled package'}; notices: ${d.notices.join(', ')||d.path+'/package.json'}`).join('\n')}\n\n## Optional host codecs\n\nLegacy XZ/LZMA2 ZIM clusters use the host's xz command; legacy bzip2 clusters use bzip2. No xz, bzip2 or operating-system libraries are redistributed by this package. Current Zstandard ZIM support is provided by bundled Node. Source references: https://github.com/tukaani-project/xz and https://sourceware.org/bzip2/.\n\n## EnZIME source\n\nSource repository: https://github.com/rebots-online/EnZIME. The bundle includes the consolidated application sources. Project ownership and licensing remain governed by the source repository and its applicable notices; this package grants no additional license.\n`);
 const buildInfo={format:'enzime-portable',version:pkg.version,created:new Date().toISOString(),platform:process.platform,architecture:process.arch,bundledRuntime:runtime?{version:nodeVersion,sha256:await sha256(nodeBinary),licenseSha256:await sha256(nodeLicense),source:`https://github.com/nodejs/node/tree/${nodeVersion}`,sharedLibraryDependencies:runtimeDependencies}:null,bundledInference:llamaInfo,source:{repository:'https://github.com/rebots-online/EnZIME',commit:git('rev-parse','HEAD'),hasUncommittedChanges:!!git('status','--porcelain')},dependencies,optionalSystemTools:['xz','bzip2'],dataIncluded:false,modelWeightsIncluded:false,nativeTauriBuildIncluded:false};
 await writeFile(path.join(target,'BUILD-INFO.json'),JSON.stringify(buildInfo,null,2)+'\n');
 const files=await walkFiles(target),checksums=[];for(const file of files)checksums.push(`${await sha256(path.join(target,file))}  ${file.split(path.sep).join('/')}`);
 await writeFile(path.join(target,'SHA256SUMS'),checksums.join('\n')+'\n');
 await command('tar',['-czf',archive,'-C',staging,packageName],here);
 const archiveHash=await sha256(archive),bytes=(await stat(archive)).size;
 await writeFile(`${archive}.sha256`,`${archiveHash}  ${path.basename(archive)}\n`);
 await writeFile(`${archive}.json`,JSON.stringify({name:packageName,archive:path.basename(archive),bytes,sha256:archiveHash,build:buildInfo},null,2)+'\n');
 complete=true;console.log(JSON.stringify({archive,bytes,sha256:archiveHash,runtime:nodeVersion,inference:llamaInfo?.release||null,files:files.length},null,2));
}finally{await rm(staging,{recursive:true,force:true});if(!complete)await rm(archive,{force:true});}
