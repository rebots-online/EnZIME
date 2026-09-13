import {cp,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('public/vendor',{recursive:true});
for(const dir of ['build','cmaps','standard_fonts','wasm']) await cp(`node_modules/pdfjs-dist/${dir}`,`public/vendor/pdfjs/${dir}`,{recursive:true});
await cp('node_modules/pdfjs-dist/LICENSE','public/vendor/pdfjs/LICENSE');
await build({entryPoints:['public/app.mjs'],bundle:true,outfile:'public/app.js',minify:true,format:'esm',target:'es2022',external:['/vendor/*']});
await build({entryPoints:['thinkspace-entry.jsx'],bundle:true,outfile:'public/thinkspace.js',minify:true,jsx:'automatic'});
console.log('EnZIME workspace, PDF reader and original Pysanky playground bundled locally.');
