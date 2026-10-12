import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist'),prefix='/Crosslinks_APPtask';
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
createServer(async(req,res)=>{
 try{let path=new URL(req.url,'http://localhost').pathname;if(!path.startsWith(prefix+'/')){res.writeHead(404);res.end();return;}
 path=path.slice(prefix.length);if(path.endsWith('/'))path+='index.html';
 const file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(8090,'127.0.0.1',()=>console.log('Built app test server ready.'));
