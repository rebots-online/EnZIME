import {cp,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('public/vendor',{recursive:true});
for(const dir of ['build','cmaps','standard_fonts','wasm']) await cp(`node_modules/pdfjs-dist/${dir}`,`public/vendor/pdfjs/${dir}`,{recursive:true});
await cp('node_modules/pdfjs-dist/LICENSE','public/vendor/pdfjs/LICENSE');
await build({entryPoints:['thinkspace-entry.jsx'],bundle:true,outfile:'public/thinkspace.js',minify:true,jsx:'automatic'});
console.log('PDF.js and preserved ThinkSpace bundled locally.');
