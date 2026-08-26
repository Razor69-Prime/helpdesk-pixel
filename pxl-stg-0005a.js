'use strict';

// PXL-STG-0005C — MR dibuat teknisi dari WO yang ditugaskan.
// PXL-URG-0022 — material manual SO tidak boleh masuk flow Inventory/MR UUID.
// Route didaftarkan saat server.js mulai mendaftarkan route, bukan melalui app.listen,
// agar tetap aktif pada Vercel serverless.
const express=require('express');
const originalGet=express.application.get;
const originalPost=express.application.post;

function same(a,b){return String(a==null?'':a)===String(b==null?'':b);}
function assigned(ticket,user){
  if(!ticket||!user)return false;
  const name=String(user.name||'').trim().toLowerCase();
  const id=String(user.id||'');
  const techs=Array.isArray(ticket.technicians)?ticket.technicians:[];
  return techs.some(v=>String(v||'').trim().toLowerCase()===name||String(v||'')===id)
    ||String(ticket.technician||'').trim().toLowerCase()===name
    ||String(ticket.technician_id||'')===id;
}

function validUuid(value){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||'').trim());
}
function isInventorySOItem(item){
  const type=String(item?.item_type||item?.type||'item').toLowerCase();
  const inventoryId=String(item?.inventory_item_id||item?.item_id||'').trim();
  return !['service','jasa'].includes(type)
    && item?.manual_material!==true
    && !inventoryId.startsWith('manual:')
    && validUuid(inventoryId);
}

async function validateAssignedWO(req,res,next){
  try{
    const user=req.session?.user;
    if(!user)return res.status(401).json({error:'Unauthorized'});
    if(String(user.role||'').toLowerCase()!=='technician')return next();
    const ticketId=req.body?.ticket_id;
    if(!ticketId)return res.status(400).json({error:'Nomor WO wajib dipilih.'});
    const db=require('./db');
    const ticket=(await db.getTickets(null,true)).find(t=>same(t.id,ticketId));
    if(!assigned(ticket,user))return res.status(403).json({error:'WO ini tidak ditugaskan kepada akun teknisi Anda.'});
    next();
  }catch(error){res.status(400).json({error:String(error.message||error)});}
}

function findLinkedSalesOrder(ticket,crmWos,salesOrders){
  const crmWo=(crmWos||[]).find(w=>
    same(w.id,ticket?.linked_crm_work_order_id)||
    same(w.ticket_id,ticket?.id)||
    (ticket?.wo_number&&same(w.wo_number,ticket.wo_number))
  )||null;

  const so=(salesOrders||[]).find(s=>
    (crmWo&&same(s.id,crmWo.sales_order_id))||
    (crmWo&&same(s.linked_crm_work_order_id,crmWo.id))||
    same(s.linked_work_order_id,ticket?.id)||
    same(s.ticket_id,ticket?.id)||
    (ticket?.wo_number&&same(s.linked_wo_number,ticket.wo_number))||
    (crmWo?.wo_number&&same(s.linked_wo_number,crmWo.wo_number))
  )||null;

  return {crmWo,so};
}

async function workOrderItems(req,res){
  try{
    const user=req.session?.user;
    if(!user)return res.status(401).json({error:'Unauthorized'});
    const db=require('./db');
    const [tickets,crmWos,salesOrders]=await Promise.all([
      db.getTickets(null,true),
      db.getCrmWorkOrders(),
      db.getSalesOrders()
    ]);
    const ticket=(tickets||[]).find(t=>same(t.id,req.params.ticketId)||same(t.wo_number,req.params.ticketId));
    if(!ticket)return res.status(404).json({error:'Work Order tidak ditemukan.'});
    if(String(user.role||'').toLowerCase()==='technician'&&!assigned(ticket,user)){
      return res.status(403).json({error:'WO ini tidak ditugaskan kepada akun teknisi Anda.'});
    }

    const {crmWo,so}=findLinkedSalesOrder(ticket,crmWos,salesOrders);
    if(!so){
      return res.status(404).json({error:'Sales Order yang terhubung dengan '+String(ticket.wo_number||'WO ini')+' tidak ditemukan. Pastikan WO dibuat dari Sales Order.'});
    }

    // PXL-URG-0022: hanya material Inventory dengan UUID valid yang boleh
    // masuk Form Material Request / pengambilan stok. Material manual tetap
    // menjadi informasi SO/WO, tetapi tidak pernah dikirim ke operasi Inventory.
    const sourceItems=(Array.isArray(so.items)?so.items:[]).filter(isInventorySOItem);
    const items=sourceItems.map(i=>{
      const qty=Number(i.qty??i.quantity??i.qty_out??0);
      return {
        inventory_item_id:i.inventory_item_id||i.item_id||null,
        name:i.name||i.item_name||'Item',
        sku:i.sku||null,
        unit:i.unit||'pcs',
        stock:i.stock_at_select??i.stock??0,
        qty_out:qty,
        qty_use:0,
        qty_return:qty,
        source_type:'sales_order'
      };
    }).filter(i=>i.name&&i.qty_out>0&&validUuid(i.inventory_item_id));

    return res.json({
      ticket_id:ticket.id,
      wo_number:ticket.wo_number||crmWo?.wo_number||null,
      crm_work_order_id:crmWo?.id||null,
      sales_order_id:so.id,
      items
    });
  }catch(error){
    return res.status(500).json({error:String(error.message||error)});
  }
}

express.application.get=function pxl0005cGet(path,...handlers){
  const result=originalGet.call(this,path,...handlers);
  if(!this.__pxl0005cRoute){
    this.__pxl0005cRoute=true;
    originalGet.call(this,'/api/material-requests-form/work-order/:ticketId/items',workOrderItems);
  }
  return result;
};

express.application.post=function pxl0005cPost(path,...handlers){
  if(path==='/api/crm/material-requests/from-so/:salesOrderId'||path==='/api/crm/material-requests/from-so/:soId'||path==='/api/sales-orders/:id/material-request'){
    handlers[handlers.length-1]=(req,res)=>res.status(410).json({error:'Pembuatan MR dari Sales Order sudah dinonaktifkan. Buat MR melalui Form Material Request setelah teknisi ditugaskan ke WO.'});
  }
  if(path==='/api/material-requests-form'&&handlers.length){
    handlers.splice(Math.max(0,handlers.length-1),0,validateAssignedWO);
  }
  return originalPost.call(this,path,...handlers);
};
