import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
async function walk(dir){let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch{return;}for(const entry of entries){const path=resolve(dir,entry.name);if(entry.isDirectory())await walk(path);else if(entry.name==='error-context.md'){console.log('Test page evidence: '+path);console.log((await readFile(path,'utf8')).slice(0,15000));}}}
await walk('test-results');
