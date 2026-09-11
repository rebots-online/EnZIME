import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {unzipSync} from 'fflate';
import {DOMParser, parseHTML} from 'linkedom';

const MAX_DOCUMENT = 128 * 1024 ** 2;
export function htmlText(html) {
  const {document} = parseHTML(`<html><body>${html}</body></html>`);
  for (const node of document.querySelectorAll('script,style,noscript,template,iframe,object')) node.remove();
  for (const node of document.querySelectorAll('p,div,li,h1,h2,h3,h4,br,tr')) node.appendChild(document.createTextNode('\n'));
  return document.body.textContent.replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n\n').trim();
}
export function articleLinks(html, key) {
  const {document} = parseHTML(`<html><body>${html}</body></html>`);
  const links = [];
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) continue;
    try {
      const resolved = new URL(href, `https://archive.invalid/${key}`);
      const target = decodeURIComponent(resolved.pathname.slice(1));
      if (target && !links.includes(target)) links.push(target);
    } catch {}
    if (links.length >= 100) break;
  }
  return links;
}

export function createDocuments() {
  const pdfs = new Map(), epubs = new Map();
  async function pdf(file) {
    if (pdfs.has(file)) { const p=pdfs.get(file);pdfs.delete(file);pdfs.set(file,p);return p; }
    if ((await stat(file)).size > MAX_DOCUMENT) throw Error('PDF text extraction is limited to 128 MiB; the page reader still opens the original.');
    const {getDocument} = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await getDocument({data:new Uint8Array(await readFile(file)),isEvalSupported:false,enableXfa:false,useSystemFonts:true}).promise;
    pdfs.set(file,doc);
    while(pdfs.size>1){const old=pdfs.keys().next().value;const d=pdfs.get(old);pdfs.delete(old);await d.loadingTask.destroy();}
    return doc;
  }
  async function epub(file) {
    if(epubs.has(file))return epubs.get(file);
    if((await stat(file)).size>64*1024**2)throw Error('EPUB reading limit is 64 MiB compressed.');
    let total=0;
    const files=unzipSync(await readFile(file),{filter(entry){
      total+=entry.originalSize;
      if(entry.originalSize>16*1024**2||total>MAX_DOCUMENT)throw Error('EPUB exceeds the safe decompression budget.');
      if(entry.name.startsWith('/')||entry.name.split('/').includes('..'))throw Error('Invalid EPUB path.');
      return true;
    }});
    const decode = name => files[name] ? new TextDecoder().decode(files[name]) : null;
    if(decode('mimetype')?.trim()!=='application/epub+zip')throw Error('Not a valid EPUB container.');
    const parser=new DOMParser();
    const container=parser.parseFromString(decode('META-INF/container.xml')||'','text/xml');
    const packagePath=container.querySelector('rootfile')?.getAttribute('full-path');
    if(!packagePath||!decode(packagePath))throw Error('EPUB package is missing.');
    const opf=parser.parseFromString(decode(packagePath),'text/xml');
    const base=path.posix.dirname(packagePath);
    const items=new Map([...opf.querySelectorAll('manifest item')].map(item=>[item.getAttribute('id'),{path:path.posix.normalize(path.posix.join(base,decodeURIComponent(item.getAttribute('href')||''))),mime:item.getAttribute('media-type'),properties:item.getAttribute('properties')||''}]));
    const chapters=[...opf.querySelectorAll('spine itemref')].map(item=>items.get(item.getAttribute('idref'))).filter(Boolean).filter(item=>/html/.test(item.mime));
    const result={files,chapters,title:opf.querySelector('title')?.textContent||path.basename(file)};
    epubs.clear();epubs.set(file,result);return result;
  }
  return {
    async pdfInfo(file){const d=await pdf(file);return {pages:d.numPages,outline:await d.getOutline()};},
    async pdfPage(file,page=1){const d=await pdf(file);if(!Number.isInteger(page)||page<1||page>d.numPages)throw Error('Invalid PDF page.');const p=await d.getPage(page);const content=await p.getTextContent();const text=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('').trim();p.cleanup();return {page,pages:d.numPages,text};},
    async epubInfo(file){const d=await epub(file);return {title:d.title,chapters:d.chapters.map((c,i)=>({index:i,key:c.path,title:`Chapter ${i+1}`}))};},
    async epubRead(file,key){const d=await epub(file);const bytes=d.files[key];if(!bytes)throw Error('EPUB resource is missing.');const chapter=d.chapters.find(c=>c.path===key);const ext=path.posix.extname(key).toLowerCase();const mime=chapter?.mime||({'.css':'text/css','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.xhtml':'application/xhtml+xml','.html':'text/html'}[ext]||'application/octet-stream');return {key,mime,bytes:Buffer.from(bytes)};},
    async close(){for(const doc of pdfs.values())await doc.loadingTask.destroy();pdfs.clear();epubs.clear();}
  };
}
