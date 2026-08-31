'use strict';
/* PXL-URG-0035 — isolated WO work-date editor backend guard.
 * Only manager/superadmin may change worked_at. Existing ticket PATCH behavior is untouched.
 */
const express=require('express');
const originalPatch=express.application.patch;
const TARGET='/api/tickets/:id';
function role(v){return String(v||'').trim().toLowerCase();}
function validDateTime(v){const d=new Date(v);return v&&Number.isFinite(d.getTime());}
async function dateEdit(req,res,next){
  if(!Object.prototype.hasOwnProperty.call(req.body||{},'worked_at')) return next();
  const r=role(req.session?.user?.role);
  if(!['manager','superadmin'].includes(r)) return res.status(403).json({error:'Hanya Manager dan Superadmin yang dapat mengubah tanggal Work Order.'});
  const value=String(req.body.worked_at||'').trim();
  if(!validDateTime(value)) return res.status(400).json({error:'Tanggal Work Order tidak valid.'});
  try{
    const db=require('./db');
    const existing=(await db.getTickets(null,true)).find(t=>String(t.id)===String(req.params.id));
    if(!existing) return res.status(404).json({error:'Work Order tidak ditemukan.'});
    const updated=await db.updateTicket(req.params.id,{worked_at:value});
    // UI editor sends worked_at only. Return here so the legacy PATCH route cannot alter other fields.
    if(Object.keys(req.body||{}).every(k=>k==='worked_at')) return res.json(updated);
    req.body={...req.body}; delete req.body.worked_at;
    return next();
  }catch(e){return res.status(500).json({error:String(e.message||e)});}
}
express.application.patch=function pxl0035Patch(path,...handlers){
  if(path===TARGET) handlers.unshift(dateEdit);
  return originalPatch.call(this,path,...handlers);
};
