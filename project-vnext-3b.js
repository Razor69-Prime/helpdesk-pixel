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
    if(!['boq','manual'].includes(source))throw new Error(`Sumber item baris ${index+1} harus BOQ Project atau Manual.`);
    const qty=Number(raw?.qty_requested);
    if(!Number.isFinite(qty)||qty<=0)throw new Error(`Qty/jumlah baris ${index+1} harus lebih dari 0.`);
    const itemName=String(raw?.item_name||raw?.name||'').trim();
    const unit=raw?.unit?String(raw.unit).trim():null;
    if(source==='manual'){
      if(!itemName)throw new Error(`Nama material manual baris ${index+1} wajib diisi.`);
      return {source_type:'manual',project_boq_item_id:null,item_name:itemName,unit,qty_requested:qty,sort_order:index};
    }
    const boqId=raw?.project_boq_item_id?String(raw.project_boq_item_id).trim():null;
    if(!boqId)throw new Error(`Item BOQ baris ${index+1} tidak valid.`);
    return {source_type:'boq',project_boq_item_id:boqId,item_name:itemName||null,unit,qty_requested:qty,sort_order:index};
  });
}

module.exports={normalizeProjectMrItems,calculateProjectMrOutstanding};
