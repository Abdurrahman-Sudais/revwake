import fs from 'node:fs';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {insertBefore,scriptElement} from './embedding.mjs';
await build({configFile:false,plugins:[react(),tailwindcss()],build:{outDir:'.preview',copyPublicDir:false,rollupOptions:{input:'src/review.jsx',output:{entryFileNames:'review.js',assetFileNames:'[name][extname]'}}}});
const mapping={};for(const name of fs.readdirSync('public/brand')){const ext=name.split('.').pop();mapping['/brand/'+name]=`data:${ext==='svg'?'image/svg+xml':'image/png'};base64,${fs.readFileSync('public/brand/'+name).toString('base64')}`;}
let html=fs.readFileSync('dist/index.html','utf8');html=html.replace(/<link rel="stylesheet"[^>]*>/g,'').replace(/<script type="module"[^>]*><\/script>/g,'');html=insertBefore(html,'</head>',`<style>${fs.readFileSync('.preview/review.css','utf8')}</style>`);for(const [url,data] of Object.entries(mapping))html=html.split('"'+url+'"').join('"'+data+'"');
const assetBridge=`const map=${JSON.stringify(mapping)};function localize(){for(const el of document.querySelectorAll('img[src],a[download]')){for(const attr of ['src','href']){const val=el.getAttribute(attr);if(map[val])el.setAttribute(attr,map[val]);}}}new MutationObserver(localize).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','href']});localize();`;
html=insertBefore(html,'</body>',scriptElement(assetBridge+'\n'+fs.readFileSync('.preview/review.js','utf8')));
fs.writeFileSync('Revwake-review.html',html);
