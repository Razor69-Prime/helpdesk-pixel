'use strict';
// PXL-URG-0116A — read-only warehouse follow-up; never blocks technician WO closing.
const norm=v=>String(v??'').trim().toLowerCase();
const canView=user=>{
  const role=norm(user?.role).replace(/[\s_-]/g,'');
  if(['technician','technisi'].includes(role))return false;
  return ['superadmin','manager','admin','warehouseadmin','warehouse'].includes(role)
    || (Array.isArray(user?.custom_menus)&&user.custom_menus.includes('material_return_verify'));
};
const resolved=row=>{
  const warehouse=norm(row?.warehouse_status);
  if(warehouse)return warehouse==='verified';
  return ['returned','dikembalikan','return_complete','returned_complete'].includes(norm(row?.status));
};
function pendingForTickets({tickets=[],mrs=[],crmRequests=[],crmWorkOrders=[]},options={}){
  const closed=new Map(tickets.filter(t=>options.all||['done','selesai','completed','closed','finished'].includes(norm(t.status))).map(t=>[String(t.id),t]));
  const byCrmWo=new Map(crmWorkOrders.map(w=>[String(w.id),String(w.ticket_id||'')]));
  const all=[...mrs.map(m=>({...m,source:'mr_form',ticket_id:m.ticket_id})),...crmRequests.map(m=>({...m,source:'crm_mr',ticket_id:byCrmWo.get(String(m.work_order_id))}))];
  return all.filter(m=>closed.has(String(m.ticket_id))&&!resolved(m)).map(m=>({mr_id:m.id,source:m.source,ticket_id:m.ticket_id,wo_number:closed.get(String(m.ticket_id))?.wo_number||null,wo_status:closed.get(String(m.ticket_id))?.status||null,items:Array.isArray(m.items)?m.items:[],status:m.status||'pending',warehouse_status:m.warehouse_status||'pending'}));
}
module.exports={canView,resolved,pendingForTickets};
