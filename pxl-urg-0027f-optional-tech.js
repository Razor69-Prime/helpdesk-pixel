'use strict';

// PXL-URG-0027K — optional technician for Input Laporan, DB NOT NULL compatible.
// Keep tickets.technician as empty string (not NULL) when unassigned because
// production schema still enforces NOT NULL on that column. technicians stays [].
const express = require('express');
const previousPost = express.application.post;
const SENTINEL = '__PXL_REPORT_UNASSIGNED__';
const ALLOWED_ROLES = new Set(['admin','superadmin','manager','operator']);

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
    console.error('[PXL-URG-0027K] optional technician middleware failed',error);
    return next(error);
  }
}

express.application.post = function pxlUrg0027FPost(path,...handlers){
  if(path === '/api/tickets' && handlers.length){
    handlers.splice(Math.max(0,handlers.length-1),0,optionalTechnicianMiddleware);
  }
  return previousPost.call(this,path,...handlers);
};
