'use strict';
// Read-only WO classification and ownership. Billing confirmation is stored separately.
const norm=v=>String(v||'').trim().toLowerCase();
const canView=u=>['sales','manager','admin','accounting','superadmin'].includes(norm(u?.role));
const canManage=u=>['sales','manager','admin','superadmin'].includes(norm(u?.role));
const isManager=u=>['manager','admin','superadmin','accounting'].includes(norm(u?.role));
const positive=v=>Number.isFinite(Number(v))&&Number(v)>0;
function buildRows(tickets=[],salesOrders=[],confirmations=[],user={}){
  if(!canView(user))return [];
  const byId=new Map(),byWo=new Map(),byNumber=new Map();
  for(const s of salesOrders){if(s.is_deleted||norm(s.status)==='void')continue;byId.set(String(s.id),s);if(s.linked_work_order_id)byWo.set(String(s.linked_work_order_id),s);if(s.linked_wo_number)byNumber.set(String(s.linked_wo_number),s)}
  const saved=new Map(confirmations.map(x=>[String(x.wo_id),x]));
  return tickets.filter(t=>['done','closed'].includes(norm(t.status))).filter(t=>{
    const so=byId.get(String(t.sales_order_id))||byWo.get(String(t.id))||byNumber.get(String(t.wo_number));
    if(isManager(user))return true;
    return (so&&(String(so.sales_pic_user_id||'')===String(user.id||'')&&!!user.id||norm(so.sales_pic)===norm(user.name)))||(!so&&norm(t.created_by)===norm(user.name));
  }).map(t=>{
    const so=byId.get(String(t.sales_order_id))||byWo.get(String(t.id))||byNumber.get(String(t.wo_number));
    const c=saved.get(String(t.id));
    const soAmount=positive(so?.total_amount)?Number(so.total_amount):null;
    const inferredStatus=soAmount!==null?'pending_note':'needs_review';
    return {wo_id:t.id,wo_number:t.wo_number||'',customer_name:t.customer_name||so?.customer_name||'',project_name:t.project_name||'',work_date:t.worked_at||t.created_at||null,
      sales_pic:so?.sales_pic||(!so?t.created_by:'')||'',sales_order_id:so?.id||null,so_number:so?.so_number||'',source:t.source_type||'manual',
      so_amount:soAmount,status:c?.status||inferredStatus,revenue_amount:c?.revenue_amount!=null?Number(c.revenue_amount):soAmount,
      note_number:c?.note_number||'',note_date:c?.note_date||null,reason:c?.reason||'',updated_at:c?.updated_at||null,updated_by:c?.updated_by||null};
  }).sort((a,b)=>String(b.work_date||'').localeCompare(String(a.work_date||''))||String(a.wo_number).localeCompare(String(b.wo_number)));
}
function validateUpdate(input,existing){
  if(!input||!['needs_review','pending_note','noted','no_revenue'].includes(input.status))throw Error('Status reminder tidak valid');
  let amount=input.revenue_amount===null||input.revenue_amount===''||input.revenue_amount===undefined?null:Number(input.revenue_amount);
  if(amount!==null&&(!Number.isFinite(amount)||amount<0||amount>1e15))throw Error('Nominal omzet tidak valid');
  let noteNumber=String(input.note_number||'').trim().slice(0,120),noteDate=input.note_date||null,reason=String(input.reason||'').trim().slice(0,500);
  if(['pending_note','noted'].includes(input.status)&&!positive(amount))throw Error('Masukkan omzet lebih dari Rp0');
  if(input.status==='noted'){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(noteDate))||Number.isNaN(Date.parse(noteDate+'T00:00:00Z'))||new Date(noteDate+'T00:00:00Z').toISOString().slice(0,10)!==noteDate)throw Error('Tanggal nota wajib valid');
  }else {noteDate=null;noteNumber='';}
  if(input.status==='no_revenue'&&!reason)throw Error('Alasan tidak beromzet wajib diisi');
  if(input.status==='no_revenue')amount=null;
  if(input.status==='needs_review')amount=null;
  if(['pending_note','noted'].includes(input.status))reason='';
  return {status:input.status,revenue_amount:amount,note_number:noteNumber||null,note_date:noteDate,reason:reason||null};
}
module.exports={buildRows,validateUpdate,canView,canManage};
