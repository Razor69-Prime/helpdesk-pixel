'use strict';

// PXL-URG-0029 — optional technician + dedicated technician_remarks endpoint.
// Remarks are stored in tickets.technician_remarks (separate from description).
const express = require('express');
const previousPost = express.application.post;
const previousPatch = express.application.patch;
const SENTINEL = '__PXL_REPORT_UNASSIGNED__';
const ALLOWED_ROLES = new Set(['admin','superadmin','manager','operator']);
const REMARKS_ROLES = new Set(['admin','superadmin','manager','operator','technician']);

function normalize(value){ return String(value == null ? '' : value).trim(); }

function ensureTicketInsertCleaner(){
  const db = require('./db');
  if(db.__pxlUrg0027FInsertCleaner || typeof db.insertTicket !== 'function') return;
  db.__pxlUrg0027FInsertCleaner = true;
  const originalInsertTicket = db.insertTicket;
  db.insertTicket = async function pxlUrg0027FInsertTicket(data){
    const source = Array.isArray(data?.technicians) ? data.technicians : [];
    const hasSentinel = source.some(value => normalize(value) === SENTINEL) || normalize(data?.technician) === SENTINEL;
    if(!hasSentinel) return originalInsertTicket.call(db,data);
    const technicians = source.filter(value => normalize(value) && normalize(value) !== SENTINEL);
    return originalInsertTicket.call(db,{
      ...data,
      technicians,
      technician: technicians[0] || ''
    });
  };
}

function optionalTechnicianMiddleware(req,res,next){
  try{
    const role = normalize(req.session?.user?.role).toLowerCase();
    if(!ALLOWED_ROLES.has(role)) return next();

    const body = req.body || {};
    const tech1 = normalize(body.assigned_to);
    const tech2 = normalize(body.assigned_to2);
    const wantsUnassigned = tech1 === SENTINEL || (!tech1 && !tech2);
    if(!wantsUnassigned) return next();

    ensureTicketInsertCleaner();
    body.assigned_to = SENTINEL;
    delete body.assigned_to2;
    req.body = body;
    return next();
  }catch(error){
    console.error('[PXL-URG-0029] optional technician middleware failed',error);
    return next(error);
  }
}

async function technicianRemarksHandler(req,res){
  try{
    const sessionUser=req.session?.user||{};
    const role=normalize(sessionUser.role).toLowerCase();
    const extraRoles=Array.isArray(sessionUser.extra_roles)?sessionUser.extra_roles.map(x=>normalize(x).toLowerCase()):[];
    const canWrite=REMARKS_ROLES.has(role)||extraRoles.includes('technician');
    if(!canWrite) return res.status(403).json({error:'Anda tidak memiliki akses untuk mengubah remarks teknisi.'});

    const remarks=normalize(req.body?.remarks);
    if(remarks.length>1500) return res.status(400).json({error:'Remarks maksimal 1500 karakter.'});

    const db=require('./db');
    const tickets=await db.getTickets(null,true);
    const ticket=(tickets||[]).find(row=>String(row.id)===String(req.params.id));
    if(!ticket) return res.status(404).json({error:'Work Order tidak ditemukan.'});

    const saved=await db.updateTicket(req.params.id,{technician_remarks:remarks||null});
    return res.json(saved||{id:req.params.id,technician_remarks:remarks||null});
  }catch(error){
    console.error('[PXL-URG-0029] save technician remarks failed',error);
    return res.status(500).json({error:error.message||'Gagal menyimpan remarks teknisi.'});
  }
}

express.application.post = function pxlUrg0027FPost(path,...handlers){
  if(path === '/api/tickets' && handlers.length){
    handlers.splice(Math.max(0,handlers.length-1),0,optionalTechnicianMiddleware);
  }
  return previousPost.call(this,path,...handlers);
};

express.application.patch = function pxlUrg0029Patch(path,...handlers){
  if(path === '/api/tickets/:id' && !this.__pxlUrg0029RemarksRoute){
    this.__pxlUrg0029RemarksRoute=true;
    previousPatch.call(this,'/api/tickets/:id/remarks',technicianRemarksHandler);
  }
  return previousPatch.call(this,path,...handlers);
};
