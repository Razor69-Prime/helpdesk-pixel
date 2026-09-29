const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8')}
const inv=read('public/inventory.html');
const core=read('db-core.js');
const db=read('db.js');
const server=read('server.js');
const systemTools=read('public/pxl-urg-0076-system-tools.js');

function has(src,token,msg){if(!src.includes(token))throw new Error(msg+': '+token)}
function lacks(src,token,msg){if(src.includes(token))throw new Error(msg+': '+token)}

has(inv,'PostgREST VPS terhubung','inventory status belum dibersihkan');
has(inv,'tersimpan di PostgreSQL VPS','inventory toast belum dibersihkan');
lacks(inv,'Supabase terhubung','inventory masih menampilkan status Supabase');
lacks(inv,'tersimpan di Supabase','inventory masih menampilkan penyimpanan Supabase');

has(core,"Storage: ${USE_POSTGREST ? 'PostgREST VPS'",'startup storage log belum dibersihkan');
has(server,"Mode: ${db.USE_POSTGREST ? 'PostgREST VPS'",'startup mode log belum dibersihkan');
has(db,'PostgREST HTTP','database error masih menyebut Supabase');
has(db,'POSTGREST_READ_TIMEOUT','timeout code belum dibersihkan');
has(systemTools,'Legacy Supabase Storage','system tools belum memperjelas label legacy');

console.log('PASS PXL-URG-0107F');
