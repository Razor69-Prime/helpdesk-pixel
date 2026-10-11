'use strict';

function finiteQty(value,label='qty'){
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)throw new Error(`${label} harus angka valid dan tidak negatif.`);
  return n;
}

function calculateProjectMrOutstanding(item={}){
  const taken=finiteQty(item.qty_taken??item.taken??0,'qty_taken');
  const returned=finiteQty(item.qty_returned??item.returned??0,'qty_returned');
  const used=finiteQty(item.qty_used??item.used??0,'qty_used');
  const outstanding=taken-returned-used;
  if(outstanding<0)throw new Error('Outstanding material tidak boleh negatif.');
  return outstanding;
}

function normalizeProjectMrItems(rawItems,{requireItems=false}={}){
  if(!Array.isArray(rawItems))throw new Error('Daftar item MR Project tidak valid.');
  if(requireItems&&rawItems.length===0)throw new Error('Minimal satu item MR Project wajib diisi.');
  return rawItems.map((raw,index)=>{
    const source=String(raw?.source_type||'').trim().toLowerCase();
    if(!['boq','inventory_extra'].includes(source))throw new Error(`Sumber item baris ${index+1} tidak valid.`);
    const qty=Number(raw?.qty_requested);
    if(!Number.isFinite(qty)||qty<=0)throw new Error(`Qty/jumlah baris ${index+1} harus lebih dari 0.`);
    const inventoryId=raw?.inventory_item_id?String(raw.inventory_item_id).trim():null;
    const boqId=raw?.project_boq_item_id?String(raw.project_boq_item_id).trim():null;
    const reason=raw?.additional_reason?String(raw.additional_reason).trim():null;
    if(source==='boq'&&!boqId)throw new Error(`Item BOQ baris ${index+1} tidak valid.`);
    if(source==='inventory_extra'&&!inventoryId)throw new Error(`Item Inventory baris ${index+1} wajib dipilih.`);
    if(source==='inventory_extra'&&!reason)throw new Error(`Alasan material tambahan baris ${index+1} wajib diisi.`);
    return {
      source_type:source,
      project_boq_item_id:boqId,
      inventory_item_id:inventoryId,
      item_name:String(raw?.item_name||raw?.name||'').trim()||null,
      sku:raw?.sku?String(raw.sku).trim():null,
      unit:raw?.unit?String(raw.unit).trim():null,
      qty_requested:qty,
      additional_reason:reason,
      sort_order:index
    };
  });
}

module.exports={normalizeProjectMrItems,calculateProjectMrOutstanding};
