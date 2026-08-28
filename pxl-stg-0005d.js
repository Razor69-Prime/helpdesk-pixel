'use strict';

// PXL-STG-0005H — route MR dipasang setelah JWT session dan sebelum static.
// PXL-URG-0023 — WO manual/Input Laporan tetap valid tanpa Sales Order.
// PXL-URG-0028 — shared technician remarks stored at end of ticket description.
const express = require('express');
const originalGet = express.application.get;
const originalPost = express.application.post;
const originalPatch = express.application.patch;
const originalUse = express.application.use;
const ITEMS_ROUTE = '/api/material-requests-form/work-order/:ticketId/items';
const ASSIGNED_ROUTE = '/api/material-requests-form/assigned-work-orders';
const REMARKS_ROUTE = '/api/tickets/:ticketId/technician-remarks';
const REMARKS_LABEL = 'Remarks Teknisi:';

function same(a,b){ return String(a == null ? '' : a) === String(b == null ? '' : b); }
function normalized(value){ return String(value == null ? '' : value).trim().toLowerCase(); }
function validUuid(value){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||'').trim()); }
function assignmentValues(value){
  if(value == null) return [];
  if(typeof value === 'object'){
    return [value.id,value.user_id,value.technician_id,value.name,value.username,value.email]
      .filter(Boolean).map(normalized);
  }
  return [normalized(value)];
}
function assigned(ticket,user){
  if(!ticket || !user) return false;
  const identities = new Set([user.id,user.name,user.username,user.email].filter(Boolean).map(normalized));
  const candidates = [];
  const technicians = Array.isArray(ticket.technicians) ? ticket.technicians : [];
  technicians.forEach(value => candidates.push(...assignmentValues(value)));
  [
    ticket.technician,
    ticket.technician_id,
    ticket.technician_1,
    ticket.technician_1_id,
    ticket.technician_2,
    ticket.technician_2_id,
    ticket.assigned_to,
    ticket.assigned_to_id
  ].forEach(value => candidates.push(...assignmentValues(value)));
  return candidates.some(value => identities.has(value));
}
function activeWO(ticket){
  const status = normalized(ticket?.status);
  return !ticket?.archived && !['done','completed','cancelled','canceled','void','closed'].includes(status);
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

async function routeAssignedWorkOrders(req,res){
  try{
    const user = req.session?.user;
    if(!user) return res.status(401).json({source:'PXL-STG-0005H',error:'Unauthorized'});
    const db = require('./db');
    const tickets = await db.getTickets(null,true);
    const role = normalized(user.role);
    const technicianRole = ['technician','teknisi'].includes(role);
    const workOrders = (tickets || [])
      .filter(activeWO)
      .filter(ticket => !technicianRole || assigned(ticket,user))
      .map(ticket => ({
        id:ticket.id,
        wo_number:ticket.wo_number || null,
        project_name:ticket.project_name || ticket.project || ticket.description || '',
        customer_name:ticket.customer_name || ticket.customer || '',
        status:ticket.status || null
      }))
      .sort((a,b) => String(b.wo_number || '').localeCompare(String(a.wo_number || '')));
    return res.json({source:'PXL-STG-0005H',work_orders:workOrders});
  }catch(error){
    return res.status(500).json({source:'PXL-STG-0005H',error:String(error.message || error)});
  }
}

async function routeItems(req,res){
  try{
    const user = req.session?.user;
    if(!user) return res.status(401).json({source:'PXL-STG-0005H',error:'Unauthorized'});
    const db = require('./db');
    const [tickets, crmWos, salesOrders] = await Promise.all([
      db.getTickets(null,true), db.getCrmWorkOrders(), db.getSalesOrders()
    ]);
    const key = decodeURIComponent(req.params.ticketId || '');
    const ticket = (tickets || []).find(t => same(t.id,key) || same(t.wo_number,key));
    if(!ticket) return res.status(404).json({source:'PXL-STG-0005H',error:'Work Order tidak ditemukan.'});
    if(['technician','teknisi'].includes(normalized(user.role)) && !assigned(ticket,user)){
      return res.status(403).json({source:'PXL-STG-0005H',error:'WO ini tidak ditugaskan kepada akun teknisi Anda.'});
    }
    const {crmWo,so} = findRelation(ticket,crmWos,salesOrders);

    // Hanya material Inventory dengan UUID valid yang boleh masuk MR/pengambilan stok.
    if(!so){
      return res.json({
        source:'PXL-URG-0023',
        ticket_id:ticket.id,
        wo_number:ticket.wo_number || null,
        crm_work_order_id:crmWo?.id || null,
        sales_order_id:null,
        manual_work_order:true,
        items:[]
      });
    }

    const items = (Array.isArray(so.items) ? so.items : []).map(i => {
      const qty = Number(i.qty ?? i.quantity ?? i.qty_out ?? 0);
      const inventoryId = String(i.inventory_item_id || i.item_id || '').trim();
      return {
        inventory_item_id:inventoryId || null,
        manual_material:i.manual_material === true || inventoryId.startsWith('manual:'),
        name:i.name || i.item_name || 'Item',
        sku:i.sku || null,
        unit:i.unit || 'pcs',
        stock:i.stock_at_select ?? i.stock ?? 0,
        qty_out:qty,
        qty_use:0,
        qty_return:qty,
        source_type:'sales_order'
      };
    }).filter(i => !i.manual_material && validUuid(i.inventory_item_id) && i.qty_out > 0);
    return res.json({
      source:'PXL-URG-0023',
      ticket_id:ticket.id,
      wo_number:ticket.wo_number || null,
      crm_work_order_id:crmWo?.id || null,
      sales_order_id:so.id,
      manual_work_order:false,
      items
    });
  }catch(error){
    return res.status(500).json({source:'PXL-STG-0005H',error:String(error.message || error)});
  }
}

async function routeTechnicianRemarks(req,res){
  try{
    const user=req.session?.user;
    if(!user) return res.status(401).json({source:'PXL-URG-0028',error:'Unauthorized'});
    const role=normalized(user.role);
    const extraRoles=Array.isArray(user.extra_roles)?user.extra_roles.map(normalized):[];
    const canRemark=['technician','teknisi','operator','manager','admin','superadmin'].includes(role)||extraRoles.includes('technician')||extraRoles.includes('teknisi');
    if(!canRemark) return res.status(403).json({source:'PXL-URG-0028',error:'Remarks hanya dapat diisi oleh role teknisi/operasional.'});
    const db=require('./db');
    const ticket=(await db.getTickets(null,true)).find(t=>same(t.id,req.params.ticketId));
    if(!ticket) return res.status(404).json({source:'PXL-URG-0028',error:'Work Order tidak ditemukan.'});
    if(['technician','teknisi'].includes(role)&&!assigned(ticket,user)) return res.status(403).json({source:'PXL-URG-0028',error:'WO ini tidak ditugaskan kepada akun teknisi Anda.'});
    const remarks=String(req.body?.remarks||'').trim();
    if(remarks.length>1500) return res.status(400).json({source:'PXL-URG-0028',error:'Remarks maksimal 1500 karakter.'});
    const current=String(ticket.description||'');
    const base=current.replace(/\n*Remarks Teknisi:\s*\n[\s\S]*$/i,'').trimEnd();
    const description=remarks ? `${base}${base?'\n\n':''}${REMARKS_LABEL}\n${remarks}` : base;
    const updated=await db.updateTicket(ticket.id,{description});
    return res.json({source:'PXL-URG-0028',ok:true,remarks,description,updated});
  }catch(error){
    return res.status(500).json({source:'PXL-URG-0028',error:String(error.message||error)});
  }
}

async function validateAssigned(req,res,next){
  try{
    const user = req.session?.user;
    if(!user) return res.status(401).json({error:'Unauthorized'});
    if(!['technician','teknisi'].includes(normalized(user.role))) return next();
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

function registerRoutes(app){
  if(app.__pxl0005hRoutes) return;
  app.__pxl0005hRoutes = true;
  originalGet.call(app,ASSIGNED_ROUTE,routeAssignedWorkOrders);
  originalGet.call(app,ITEMS_ROUTE,routeItems);
  originalPatch.call(app,REMARKS_ROUTE,routeTechnicianRemarks);
}

express.application.use = function pxl0005hUse(...args){
  const result = originalUse.apply(this,args);
  if(!this.__pxl0005hRoutes){
    const source = args
      .filter(value => typeof value === 'function')
      .map(value => Function.prototype.toString.call(value))
      .join('\n');
    if(source.includes('req.session') && source.includes('_setUser')) registerRoutes(this);
  }
  return result;
};

express.application.post = function pxl0005hPost(path,...handlers){
  if(['/api/crm/material-requests/from-so/:salesOrderId','/api/crm/material-requests/from-so/:soId','/api/sales-orders/:id/material-request'].includes(path)){
    handlers[handlers.length-1] = (req,res) => res.status(410).json({error:'Pembuatan MR dari Sales Order dinonaktifkan. Buat MR dari Form Material Request.'});
  }
  if(path === '/api/material-requests-form' && handlers.length){
    handlers.splice(Math.max(0,handlers.length-1),0,validateAssigned);
  }
  return originalPost.call(this,path,...handlers);
};
