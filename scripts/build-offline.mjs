import {readdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
const root=resolve('dist'),base=(process.env.VITE_BASE_PATH||'/').replace(/\/$/,'');
async function walk(dir){return(await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]))).flat();}
const paths=(await walk(root)).filter(p=>!p.endsWith('.map')&&!p.endsWith('sw.js')).map(p=>base+'/'+relative(root,p));
const cache='nsut-static-'+(process.env.GITHUB_SHA||Date.now());
await writeFile(resolve(root,'sw.js'),`const CACHE=${JSON.stringify(cache)},ROOT=${JSON.stringify(base+'/')},ASSETS=${JSON.stringify(paths)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('nsut-static-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith(ROOT)||u.pathname.includes('/api/')||e.request.headers.has('Authorization'))return;
if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match(ROOT+'index.html')));
else e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));});
`);
await writeFile(resolve(root,'.nojekyll'),'');
const manifest={name:'NSUT Connect',short_name:'NSUT',start_url:base+'/',scope:base+'/',display:'standalone',background_color:'#f6f7fb',theme_color:'#4567eb'};
await writeFile(resolve(root,'manifest.webmanifest'),JSON.stringify(manifest));
const file=resolve(root,'index.html');await writeFile(file,(await readFile(file,'utf8')).replace('</head>','<link rel="manifest" href="'+base+'/manifest.webmanifest"></head>'));
console.log('Prepared offline app shell with '+paths.length+' assets. Protected API data is excluded.');
