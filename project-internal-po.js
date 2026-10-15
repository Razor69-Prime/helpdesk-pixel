'use strict';

const MANUAL_STATES=['not_ordered','ordered','hold','cancelled'];
const PPN_RATE=0.11;
const ppnPrice=value=>Number((Number(value)*(1+PPN_RATE)).toFixed(6));

function textOrNull(value){
  const s=String(value??'').trim();
  return s||null;
}
function numberRequired(value,label){
  const n=Number(value);
  if(!Number.isFinite(n)) throw new Error(`${label} tidak valid.`);
  return n;
}
function normalizePrice(value){
  if(value===null||value===undefined||String(value).trim()==='') return null;
  const n=Number(value);
  if(!Number.isFinite(n)||n<0) throw new Error('Harga Beli Non-PPN tidak valid.');
  return n;
}
function normalizeBoolean(value){
  if(value===true||value===1) return true;
  return ['true','1','yes','on'].includes(String(value??'').trim().toLowerCase());
}
function normalizeInternalPoItem(item={}){
  const sourceType=String(item.source_type||'').trim().toLowerCase();
  if(!['pr','boq'].includes(sourceType)) throw new Error('Sumber item Internal PO tidak valid.');
  const itemName=String(item.item_name??item.name??'').trim();
  if(!itemName) throw new Error('Nama barang wajib diisi.');
  const qtyPo=numberRequired(item.qty_po,'Qty PO');
  if(qtyPo<=0) throw new Error('Qty PO harus lebih dari 0.');
  const qtyArrived=numberRequired(item.qty_arrived??0,'Qty Arrived');
  if(qtyArrived<0||qtyArrived>qtyPo) throw new Error('Qty Arrived harus antara 0 dan Qty PO.');
  const manualState=String(item.manual_state||'not_ordered').trim().toLowerCase();
  if(!MANUAL_STATES.includes(manualState)) throw new Error('Status pembelian manual tidak valid.');
  const sort=Number(item.sort_order);
  return {
    id:item.id||null,
    source_type:sourceType,
    source_pr_id:item.source_pr_id||null,
    source_pr_number:textOrNull(item.source_pr_number),
    source_pr_item_index:item.source_pr_item_index===null||item.source_pr_item_index===undefined||item.source_pr_item_index===''?null:Number(item.source_pr_item_index),
    source_boq_item_id:item.source_boq_item_id||null,
    item_name:itemName,
    qty_po:qtyPo,
    qty_arrived:qtyArrived,
    unit:textOrNull(item.unit),
    actual_unit_price:normalizePrice(item.actual_unit_price),
    is_ppn:normalizeBoolean(item.is_ppn),
    source_supplier_id:item.source_supplier_id||null,
    supplier_name:textOrNull(item.supplier_name),
    manual_state:manualState,
    issue:textOrNull(item.issue),
    sort_order:Number.isFinite(sort)?sort:0
  };
}
function deriveInternalPoItemStatus(item){
  const row=normalizeInternalPoItem(item);
  if(row.manual_state==='cancelled') return 'Cancelled';
  if(row.qty_po>0&&row.qty_arrived>=row.qty_po) return 'Arrived';
  if(row.qty_arrived>0&&row.qty_arrived<row.qty_po) return 'Partial Arrived';
  if(row.manual_state==='hold') return 'Hold';
  if(row.manual_state==='ordered') return 'Ordered';
  return 'Belum Dipesan';
}
function deriveInternalPoOverallStatus(items=[]){
  const rows=(items||[]).map(normalizeInternalPoItem);
  if(!rows.length) return 'Belum Ada Item';
  const statuses=rows.map(deriveInternalPoItemStatus);
  if(statuses.every(s=>s==='Cancelled')) return 'Cancelled';
  const active=statuses.filter(s=>s!=='Cancelled');
  if(active.length&&active.every(s=>s==='Arrived')) return 'Completed';
  const hasArrived=active.some(s=>s==='Arrived');
  const hasPartial=active.some(s=>s==='Partial Arrived');
  if(hasPartial||(hasArrived&&active.some(s=>s!=='Arrived'))) return 'Partial';
  if(active.some(s=>s==='Ordered'||s==='Hold')) return 'In Progress';
  return 'Belum Dipesan';
}
function calculateInternalPoTotals(items=[]){
  const rows=(items||[]).map(normalizeInternalPoItem);
  const finalUnitPrices=rows.map(row=>row.actual_unit_price===null?null:row.is_ppn?ppnPrice(row.actual_unit_price):row.actual_unit_price);
  const lineTotals=rows.map((row,index)=>finalUnitPrices[index]===null?null:row.qty_po*finalUnitPrices[index]);
  return {
    final_unit_prices:finalUnitPrices,
    line_totals:lineTotals,
    grand_total:lineTotals.reduce((sum,v)=>sum+(v===null?0:v),0),
    priced_item_count:lineTotals.filter(v=>v!==null).length
  };
}
function mapPurchaseRequestItem(item={},index,pr={}){
  const price=Number(item.price);
  return normalizeInternalPoItem({
    source_type:'pr',
    source_pr_id:pr.id||null,
    source_pr_number:pr.pr_number||null,
    source_pr_item_index:Number(index),
    source_boq_item_id:null,
    item_name:item.desc??item.item_name??item.name??'',
    qty_po:item.qty,
    qty_arrived:0,
    unit:item.unit||null,
    actual_unit_price:Number.isFinite(price)&&price>0?price:null,
    is_ppn:false,
    source_supplier_id:item.supplier_id||null,
    supplier_name:item.supplier_name??item.supplier??null,
    manual_state:'not_ordered',
    issue:null,
    sort_order:Number(index)||0
  });
}
function normalizeInternalPoDraft({general_issue=null,items=[]}={}){
  if(!Array.isArray(items)) throw new Error('Daftar item Internal PO tidak valid.');
  const normalized=items.map(normalizeInternalPoItem);
  const seen=new Set();
  for(const row of normalized){
    if(row.source_type!=='pr') continue;
    if(!row.source_pr_id||!Number.isInteger(row.source_pr_item_index)||row.source_pr_item_index<0){
      throw new Error('Provenance Purchase Request tidak valid.');
    }
    const key=`${row.source_pr_id}:${row.source_pr_item_index}`;
    if(seen.has(key)) throw new Error('Duplikat item Purchase Request pada Internal PO.');
    seen.add(key);
  }
  return {general_issue:textOrNull(general_issue),items:normalized};
}

module.exports={
  MANUAL_STATES,PPN_RATE,
  normalizeInternalPoItem,
  deriveInternalPoItemStatus,
  deriveInternalPoOverallStatus,
  calculateInternalPoTotals,
  mapPurchaseRequestItem,
  normalizeInternalPoDraft
};
