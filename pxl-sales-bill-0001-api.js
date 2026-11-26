'use strict';
// PXL-SALES-BILL-0001 — separate billing reminder. Does NOT update WO or invoice.
const cfg=require('./config');
const {buildRows,validateUpdate,canView,canManage}=require('./pxl-sales-bill-0001-core');
const base=String(cfg.POSTGREST_URL||'').replace(/\/$/,'')+'/rest/v1';
const token=cfg.POSTGREST_KEY;
async function rest(method,path,body,prefer){
  const res=await fetch(base+path,{method,cache:'no-store',headers:{apikey:token,Authorization:'Bearer '+token,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  if(!res.ok){const error=await res.text();console.error('[PXL-SALES-BILL-0001] database failure',res.status,error.slice(0,240));throw Error('Pencatatan reminder belum tersedia (database '+res.status+').')}
  const raw=await res.text();return raw?JSON.parse(raw):[];
}
module.exports=function install(app,{db,requireAuth}){
  async function available(req){
    const [tickets,salesOrders,confirmations]=await Promise.all([db.getTickets(null,true),db.getSalesOrders(),rest('GET','/sales_wo_billing?select=*&limit=10000')]);
    return buildRows(tickets,salesOrders,confirmations,req.session.user);
  }
  app.get('/api/sales-wo-reminder',requireAuth,async(req,res)=>{
    if(!canView(req.session?.user))return res.status(403).json({error:'Akses Sales WO Reminder ditolak'});
    try{res.set('Cache-Control','no-store');res.json({rows:await available(req),read_only:!canManage(req.session.user)})}
    catch(e){res.status(503).json({error:e.message})}
  });
  app.get('/api/sales-wo-reminder/:id/history',requireAuth,async(req,res)=>{
    if(!canView(req.session?.user))return res.status(403).json({error:'Akses ditolak'});
    try{
      const rows=await available(req);
      if(!rows.some(x=>String(x.wo_id)===String(req.params.id)))return res.status(404).json({error:'WO tidak ditemukan atau tidak diizinkan'});
      res.set('Cache-Control','no-store');res.json(await rest('GET','/sales_wo_billing_history?wo_id=eq.'+encodeURIComponent(req.params.id)+'&order=created_at.desc&limit=200'));
    }catch(e){res.status(503).json({error:e.message})}
  });
  app.post('/api/sales-wo-reminder/:id',requireAuth,async(req,res)=>{
    if(!canManage(req.session?.user))return res.status(403).json({error:'Hanya Sales dan Manager/Admin yang dapat mengonfirmasi'});
    try{
      const rows=await available(req);
      const current=rows.find(x=>String(x.wo_id)===String(req.params.id));
      if(!current)return res.status(404).json({error:'WO tidak ditemukan, belum Done, atau tidak menjadi tanggung jawab Anda'});
      const next=validateUpdate(req.body,current);
      const payload={wo_id:current.wo_id,...next,updated_by:String(req.session.user.name||req.session.user.id||'').slice(0,160),updated_at:new Date().toISOString()};
      const saved=await rest('POST','/sales_wo_billing?on_conflict=wo_id',payload,'resolution=merge-duplicates,return=representation');
      res.set('Cache-Control','no-store');res.json(saved?.[0]||payload);
    }catch(e){res.status(/tidak valid|wajib|Masukkan/.test(e.message)?400:503).json({error:e.message})}
  });
};
