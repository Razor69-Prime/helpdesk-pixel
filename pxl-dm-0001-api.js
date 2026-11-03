/* PXL-DM-0001 — Digital Marketing local snapshots. Marketing Apps source is STRICT READ ONLY. */
const express=require('express'),jwt=require('jsonwebtoken'),crypto=require('crypto'),{spawnSync}=require('child_process');
const originalStatic=express.static;
const BASE=String(process.env.POSTGREST_URL||process.env.SUPABASE_URL||'http://127.0.0.1:3003').replace(/\/$/,'')+'/rest/v1';
const KEY=process.env.POSTGREST_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_KEY||'local-compat-key';
const SOURCE_ROOT=process.env.PXL_MARKETING_APP_ROOT||'/var/www/marketing.pixelsolusindo.com';
const SOURCE_READER=require('path').join(__dirname,'pxl-dm-marketing-reader.php');
const validPeriod=p=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(p||''));
const currentPeriod=()=>{const d=new Date(Date.now()+8*3600e3);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`};
const isPast=p=>p<currentPeriod();
const DM_LOADER='<script src="/pxl-dm-0001.js?v=PXL-DM-0001B"></script>';
const SCHEDULER_KEY=Symbol.for('pxl.dm.0001.scheduler');
function injectLoader(html){const src=String(html||'');if(src.includes('/pxl-dm-0001.js'))return src;return src.includes('</body>')?src.replace('</body>',DM_LOADER+'\n</body>'):src+DM_LOADER;}
function user(req){const a=String(req.headers.authorization||''),t=a.startsWith('Bearer ')?a.slice(7):String(req.headers['x-auth-token']||'');if(!t)return null;try{return jwt.verify(t,process.env.SESSION_SECRET||'pixel-helpdesk-2026-secret')?.user||null}catch(_){return null}}
function guard(req,res){const u=user(req);if(!u)return res.status(401).json({error:'Unauthorized'});if(String(u.role||'').toLowerCase()!=='superadmin')return res.status(403).json({error:'Digital Marketing Phase 1 hanya untuk Superadmin.'});return u}
async function rest(path,opt={}){const r=await fetch(BASE+path,{...opt,headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json',...(opt.headers||{})}});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch(_){data=text}if(!r.ok)throw new Error(`PostgREST ${r.status}: ${typeof data==='string'?data:JSON.stringify(data)}`);return data}
function readSource(period){if(!validPeriod(period))throw new Error('Periode tidak valid.');const p=spawnSync('/usr/bin/php',[SOURCE_READER,period],{encoding:'utf8',timeout:20000,env:{...process.env,PXL_MARKETING_APP_ROOT:SOURCE_ROOT}});if(p.status!==0)throw new Error(String(p.stderr||'Marketing Apps read failed').trim());const d=JSON.parse(p.stdout||'{}');if(d.read_only!==true)throw new Error('Source reader tidak mengonfirmasi READ ONLY.');return d}
async function existing(period){const rows=await rest(`/digital_marketing_snapshots?period=eq.${encodeURIComponent(period)}&limit=1`);return Array.isArray(rows)?rows[0]||null:null}
async function history(period,mode,status,message,hash){return rest('/digital_marketing_pull_history',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({period,pull_mode:mode,status,message:message||null,source_hash:hash||null,pulled_at:new Date().toISOString()})})}
async function pullPeriod(period,mode='manual'){
  if(!validPeriod(period))throw new Error('Periode tidak valid.');const old=await existing(period);
  if(old?.status==='closed'){await history(period,mode,'skipped_closed','Snapshot historical CLOSED dipertahankan.',old.source_hash);return {ok:true,skipped:true,snapshot:old}}
  const src=readSource(period),raw=JSON.stringify(src),hash=crypto.createHash('sha256').update(raw).digest('hex');
  const row={period,status:isPast(period)?'closed':'open',source_name:'Marketing Apps',source_read_only:true,source_payload:src.payload,summary:src.summary,source_hash:hash,pull_mode:mode,pulled_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const rows=await rest('/digital_marketing_snapshots?on_conflict=period',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});await history(period,mode,'success','Marketing Apps READ ONLY → snapshot PixelApps.',hash);return {ok:true,skipped:false,snapshot:Array.isArray(rows)?rows[0]:row};
}
async function failHistory(period,mode,e){try{await history(period,mode,'failed',String(e.message||e).slice(0,500),null)}catch(_){}}
function monthsFromMay(){const out=[],now=currentPeriod();let y=2026,m=5;while(`${y}-${String(m).padStart(2,'0')}`<=now){out.push(`${y}-${String(m).padStart(2,'0')}`);m++;if(m===13){m=1;y++}}return out}
function msToNextWita4(now=new Date()){const next=new Date(now);next.setUTCHours(20,0,0,0);if(next<=now)next.setUTCDate(next.getUTCDate()+1);return next-now}
function schedule(){const arm=()=>setTimeout(async()=>{const p=currentPeriod();try{await pullPeriod(p,'auto')}catch(e){await failHistory(p,'auto',e)}finally{arm()}},msToNextWita4());arm()}
express.static=function(root,opt){const mw=originalStatic(root,opt);return async function(req,res,next){
  const path=req.path||'',pathname=String(path).split('?')[0];
  if(req.method==='GET'&&(pathname==='/'||pathname==='/index.html')){const nativeSend=res.send.bind(res);res.send=function(body){return nativeSend(typeof body==='string'?injectLoader(body):body)}}
  if(path.startsWith('/api/digital-marketing/')){if(!guard(req,res))return;
    try{
      if(req.method==='GET'&&path==='/api/digital-marketing/snapshots'){const period=String(req.query.period||'');const q=period&&validPeriod(period)?`?period=eq.${period}&order=period.desc`:'?order=period.desc';return res.json(await rest('/digital_marketing_snapshots'+q));}
      if(req.method==='GET'&&path==='/api/digital-marketing/history')return res.json(await rest('/digital_marketing_pull_history?order=pulled_at.desc&limit=100'));
      if(req.method==='GET'&&path==='/api/digital-marketing/status'){const rows=await rest('/digital_marketing_snapshots?order=pulled_at.desc&limit=1');return res.json({ok:true,source:'Marketing Apps',source_mode:'READ ONLY',schedule:'04:00 WITA',current_period:currentPeriod(),last_snapshot:rows?.[0]||null});}
      if(req.method==='POST'&&path==='/api/digital-marketing/pull'){const period=String(req.body?.period||currentPeriod());try{return res.json(await pullPeriod(period,'manual'))}catch(e){await failHistory(period,'manual',e);throw e}}
      if(req.method==='POST'&&path==='/api/digital-marketing/backfill'){const results=[];for(const period of monthsFromMay()){try{results.push({period,...await pullPeriod(period,'backfill')})}catch(e){await failHistory(period,'backfill',e);results.push({period,ok:false,error:String(e.message||e)})}}return res.json({ok:results.every(x=>x.ok!==false),results});}
      return res.status(404).json({error:'Digital Marketing route tidak ditemukan.'});
    }catch(e){return res.status(500).json({error:String(e.message||e)})}
  }
  if(!global[SCHEDULER_KEY]){global[SCHEDULER_KEY]=true;schedule();console.log('[PXL-DM-0001] scheduler armed: 04:00 WITA / Asia/Makassar');}
  return mw(req,res,next);
}}
module.exports={pullPeriod,currentPeriod,msToNextWita4,readSource,injectLoader};
