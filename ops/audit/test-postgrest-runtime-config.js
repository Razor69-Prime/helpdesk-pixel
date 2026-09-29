const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'../..');
const cfg=fs.readFileSync(path.join(root,'config.js'),'utf8');
const core=fs.readFileSync(path.join(root,'db-core.js'),'utf8');
const db=fs.readFileSync(path.join(root,'db.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');

function need(src,token,msg){ if(!src.includes(token)) throw new Error(msg+': '+token); }

need(cfg,'POSTGREST_URL','config belum punya POSTGREST_URL');
need(cfg,'POSTGREST_KEY','config belum punya POSTGREST_KEY');
need(cfg,'process.env.POSTGREST_URL','config belum membaca env POSTGREST_URL');
need(cfg,'process.env.POSTGREST_KEY','config belum membaca env POSTGREST_KEY');
need(cfg,'SUPABASE_URL: POSTGREST_URL','compat alias SUPABASE_URL hilang');
need(cfg,'SUPABASE_KEY: POSTGREST_KEY','compat alias SUPABASE_KEY hilang');

need(core,'const USE_POSTGREST','db-core belum memakai USE_POSTGREST');
need(core,'async function restFetch','db-core belum memakai restFetch');
need(core,'USE_SUPABASE: USE_POSTGREST','compat export USE_SUPABASE hilang');

need(db,'const USE_POSTGREST','db.js belum memakai USE_POSTGREST');
need(db,'cfg.POSTGREST_URL','db.js belum memakai POSTGREST_URL');
need(db,'cfg.POSTGREST_KEY','db.js belum memakai POSTGREST_KEY');

need(server,'assertVpsOnlyDatabase(cfg.POSTGREST_URL, APP_ENV)','VPS guard belum memakai POSTGREST_URL');
need(server,'db.USE_POSTGREST','server belum memakai USE_POSTGREST');

console.log('PASS PXL-URG-0107E');
