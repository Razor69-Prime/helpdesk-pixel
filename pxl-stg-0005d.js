'use strict';

// PXL-STG-0005F — konsolidasi route WO -> item SO dan validasi MR teknisi.
const express = require('express');
const originalGet = express.application.get;
const originalPost = express.application.post;
const ITEMS_ROUTE = '/api/material-requests-form/work-order/:ticketId/items';

function same(a,b){ return String(a == null ? '' : a) === String(b == null ? '' : b); }
function assigned(ticket,user){
  if(!ticket || !user) return false;
  const name = String(user.name || '').trim().toLowerCase();
  const id = String(user.id || '');
  const technicians = Array.isArray(ticket.technicians) ? ticket.technicians : [];
  return technicians.some(v => String(v || '').trim().toLowerCase() === name || String(v || '') === id)
    || String(ticket.technician || '').trim().toLowerCase() === name
    || String(ticket.technician_id || '') === id;
}

function findRelation(ticket, crmWos, salesOrders){
  const crmWo = (crmWos || []).find(w =>
    same(w.ticket_id, ticket.id) ||
    same(w.wo_number, ticket.wo_number) ||
    same(w.id, ticket.linked_crm_work_order_id)
  ) || null;
  const so = (salesOrders || []).find(s =>
    (crmWo && same(s.id, crmWo.sales_order_id)) ||
    (crmWo && same(s.linked_crm_work_order_id, crmWo.id)) ||
    same(s.linked_work_order_id, ticket.id) ||
    same(s.ticket_id, ticket.id) ||
    same(s.linked_wo_number, ticket.wo_number) ||
    (crmWo && same(s.linked_wo_number, crmWo.wo_number))
  ) || null;
  return { crmWo, so };
}

async function routeItems(req,res){
  try{
    const user = req.session?.user;
    if(!user) return res.status(401).json({source:'PXL-STG-0005F',error:'Unauthorized'});
    const db = require('./db');
    const [tickets, crmWos, salesOrders] = await Promise.all([
      db.getTickets(null,true), db.getCrmWorkOrders(), db.getSalesOrders()
    ]);
    const key = decodeURIComponent(req.params.ticketId || '');
    const ticket = (tickets || []).find(t => same(t.id,key) || same(t.wo_number,key));
    if(!ticket) return res.status(404).json({source:'PXL-STG-0005F',error:'Work Order tidak ditemukan.'});
    if(String(user.role || '').toLowerCase() === 'technician' && !assigned(ticket,user)){
      return res.status(403).json({source:'PXL-STG-0005F',error:'WO ini tidak ditugaskan kepada akun teknisi Anda.'});
    }
    const {crmWo,so} = findRelation(ticket,crmWos,salesOrders);
    if(!so){
      return res.status(404).json({
        source:'PXL-STG-0005F',
        error:'Sales Order yang terhubung dengan '+(ticket.wo_number || 'WO ini')+' tidak ditemukan.'
      });
    }
    const items = (Array.isArray(so.items) ? so.items : []).map(i => {
      const qty = Number(i.qty ?? i.quantity ?? i.qty_out ?? 0);
      return {
        inventory_item_id:i.inventory_item_id || i.item_id || null,
        name:i.name || i.item_name || 'Item',
        sku:i.sku || null,
        unit:i.unit || 'pcs',
        stock:i.stock_at_select ?? i.stock ?? 0,
        qty_out:qty,
        qty_use:0,
        qty_return:qty,
        source_type:'sales_order'
      };
    }).filter(i => i.inventory_item_id && i.qty_out > 0);
    return res.json({
      source:'PXL-STG-0005F',
      ticket_id:ticket.id,
      wo_number:ticket.wo_number || null,
      crm_work_order_id:crmWo?.id || null,
      sales_order_id:so.id,
      items
    });
  }catch(error){
    return res.status(500).json({source:'PXL-STG-0005F',error:String(error.message || error)});
  }
}

async function validateAssigned(req,res,next){
  try{
    const user = req.session?.user;
    if(!user) return res.status(401).json({error:'Unauthorized'});
    if(String(user.role || '').toLowerCase() !== 'technician') return next();
    const ticketId = req.body?.ticket_id;
    if(!ticketId) return res.status(400).json({error:'Nomor WO wajib dipilih.'});
    const db = require('./db');
    const ticket = (await db.getTickets(null,true)).find(t => same(t.id,ticketId));
    if(!assigned(ticket,user)) return res.status(403).json({error:'WO ini tidak ditugaskan kepada akun teknisi Anda.'});
    return next();
  }catch(error){
    return res.status(400).json({error:String(error.message || error)});
  }
}

function ensureItemsRoute(app){
  if(app.__pxl0005fItemsRoute) return;
  app.__pxl0005fItemsRoute = true;
  originalGet.call(app,ITEMS_ROUTE,routeItems);
}

express.application.get = function pxl0005fGet(path,...handlers){
  ensureItemsRoute(this);
  // Abaikan registrasi lama untuk URL yang sama supaya hanya handler 0005F yang aktif.
  if(path === ITEMS_ROUTE) return this;
  return originalGet.call(this,path,...handlers);
};

express.application.post = function pxl0005fPost(path,...handlers){
  if(['/api/crm/material-requests/from-so/:salesOrderId','/api/crm/material-requests/from-so/:soId','/api/sales-orders/:id/material-request'].includes(path)){
    handlers[handlers.length-1] = (req,res) => res.status(410).json({error:'Pembuatan MR dari Sales Order dinonaktifkan. Buat MR dari Form Material Request.'});
  }
  if(path === '/api/material-requests-form' && handlers.length){
    handlers.splice(Math.max(0,handlers.length-1),0,validateAssigned);
  }
  return originalPost.call(this,path,...handlers);
};
