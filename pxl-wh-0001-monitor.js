'use strict';
// PXL-WH-0001: aggregate read-only source records; excludes no SO/WO status.
const arr=x=>Array.isArray(x)?x:[];
const s=x=>String(x??'').trim();
const itemKey=i=>s(i.inventory_item_id||i.item_id||i.sku||i.code||i.name||i.item_name);
function normalizeItems(items,source){
 return arr(items).filter(i=>i&&typeof i==='object'&&s(i.item_type||'').toLowerCase()!=='service')
 .map(i=>({inventory_item_id:i.inventory_item_id||i.item_id||null,sku:i.sku||i.item_code||'',name:i.name||i.item_name||i.material_name||i.product_name||i.description||'',unit:i.unit||i.satuan||'pcs',qty:Number(i.qty_out??i.quantity??i.qty??i.qty_request??0)||0,qty_used:Number(i.qty_use??i.qty_used??0)||0,qty_returned:Number(i.qty_return??i.qty_returned??0)||0,source}))
 .filter(i=>itemKey(i));
}
function build({salesOrders=[],tickets=[],workOrders=[],mrForms=[],crmRequests=[],projectRequests=[]}={}){
 const map=new Map();
 const key=(kind,id)=>kind+':'+s(id);
 const ensure=(kind,id)=>{const k=key(kind,id);if(!map.has(k))map.set(k,{source_key:k,so_number:'',wo_number:'',customer:'',job:'',technicians:[],status:'',so_status:'',wo_status:'',created_at:'',items:[],mr_numbers:[],sources:[]});return map.get(k);};
 const addTech=(r,...values)=>{for(const v of values.flatMap(x=>Array.isArray(x)?x:[x])){const name=v&&typeof v==='object'?s(v.name||v.technician_name):s(v);if(name&&!r.technicians.includes(name))r.technicians.push(name);}};
 const soById=new Map(),soByNumber=new Map(),ticketById=new Map(),ticketByNo=new Map(),woById=new Map(),woByNumber=new Map();
 for(const so of arr(salesOrders)){const id=s(so.id||so.so_number);if(!id)continue;const r=ensure('so',id);r.so_number=s(so.so_number);r.status=s(so.status);r.so_status=s(so.status);r.customer=s(so.customer_name);r.job=s(so.project_name||so.description||so.notes);r.created_at=s(so.created_at);r.items=normalizeItems(so.items,'SO');r.sources.push('SO');soById.set(s(so.id),r);if(r.so_number)soByNumber.set(r.so_number,r);}
 const link=(obj,source)=>{const so=soById.get(s(obj.sales_order_id))||soByNumber.get(s(obj.so_number));const r=so||ensure('wo',s(obj.id||obj.wo_number));r.wo_number=s(obj.wo_number||r.wo_number);r.status=s(obj.status||r.status);r.wo_status=s(obj.status||r.wo_status);r.customer=s(obj.customer_name||r.customer);r.job=s(obj.project_name||obj.title||obj.description||r.job);r.created_at=s(r.created_at||obj.created_at||obj.worked_at);addTech(r,obj.technicians,obj.technician,obj.technician_name);if(!r.items.length)r.items=normalizeItems(obj.items,source);if(!r.sources.includes(source))r.sources.push(source);return r;};
 // Resolve ticket-side SO relationships before building CRM Work Order records.
 const ticketForWoId=new Map(),ticketForWoNumber=new Map();
 for(const ticket of arr(tickets)){
  if(s(ticket.id))ticketForWoId.set(s(ticket.id),ticket);
  if(s(ticket.wo_number))ticketForWoNumber.set(s(ticket.wo_number),ticket);
 }
 // Work Orders first: a linked SO and WO always share one Warehouse number.
 for(const wo of arr(workOrders)){
  if(!s(wo.id||wo.wo_number))continue;
  const ticket=ticketForWoId.get(s(wo.ticket_id))||ticketForWoNumber.get(s(wo.wo_number));
  const r=link({...wo,sales_order_id:wo.sales_order_id||ticket?.sales_order_id,so_number:wo.so_number||ticket?.so_number},'WO');woById.set(s(wo.id),r);
  if(s(wo.wo_number))woByNumber.set(s(wo.wo_number),r);
 }
 for(const t of arr(tickets)){
  if(!s(t.id||t.wo_number))continue;
  const r=woByNumber.get(s(t.wo_number))||link(t,'WO');
  r.wo_number=s(t.wo_number||r.wo_number);
  r.status=s(t.status||r.status);r.wo_status=s(t.status||r.wo_status);
  r.customer=s(t.customer_name||r.customer);
  r.job=s(t.project_name||t.title||r.job);
  addTech(r,t.technicians,t.technician,t.technician_name);
  if(!r.items.length)r.items=normalizeItems(t.items,'WO');
  ticketById.set(s(t.id),r);
  if(s(t.wo_number))ticketByNo.set(s(t.wo_number),r);
 }
 const addMr=(mr,source)=>{const r=woById.get(s(mr.work_order_id))||ticketById.get(s(mr.ticket_id))||ticketByNo.get(s(mr.wo_number))||soById.get(s(mr.sales_order_id))||soByNumber.get(s(mr.so_number));if(!r)return;const id=s(mr.mr_number||mr.id);if(id&&!r.mr_numbers.includes(id))r.mr_numbers.push(id);const parts=normalizeItems(mr.items,source);if(parts.length){r.items=parts;r.item_source=source;}addTech(r,mr.technician);};
 for(const mr of arr(crmRequests))addMr(mr,'MR');
 for(const mr of arr(mrForms))addMr(mr,'MR');
 for(const mr of arr(projectRequests))addMr(mr,'PROJECT_MR');
 return [...map.values()].sort((a,b)=>a.source_key.localeCompare(b.source_key));
}
module.exports={build,normalizeItems};
