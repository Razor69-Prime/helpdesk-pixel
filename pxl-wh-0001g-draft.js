'use strict';
// Pure validation and reporting: DRAFT lines never contribute to USED.
function normalizeLines(lines,catalog,{final=false}={}){
 if(!Array.isArray(lines)||lines.length<1||lines.length>100)throw Error('Isi 1 sampai 100 material');
 const bySku=new Map(catalog.map(x=>[x.sku,x]));
 const seen=new Set(),out=[];
 for(const entry of lines){
  const sku=String(entry?.sku||'').trim(),item=bySku.get(sku);
  if(!/^PX-[A-Z0-9-]{3,80}$/.test(sku)||!item)throw Error('SKU PX harus berasal dari katalog PROBUS resmi');
  if(seen.has(sku))throw Error('SKU material duplikat; gabungkan Qty pada satu baris');
  seen.add(sku);
  const raw=entry?.qty_used;
  const qty=raw==null||raw===''?null:Number(raw);
  if(qty!==null&&(!Number.isFinite(qty)||qty<0||qty>1000000))throw Error('Qty USED tidak valid');
  if(final&&!(qty>0))throw Error('Semua material perlu Qty USED > 0 atau hapus baris yang tidak digunakan');
  const note=String(entry?.note||'').trim();
  if(note.length>1000)throw Error('Keterangan maksimal 1000 karakter');
  const plan=Number(entry?.planned_qty);
  out.push({sku,item_name:item.name,inventory_item_id:item.id?String(item.id):null,
   unit:item.unit||'pcs',qty_used:qty,planned_qty:Number.isFinite(plan)&&plan>=0?plan:0,
   note,source:String(entry?.source||'MANUAL').slice(0,60)});
 }
 return out;
}
function asUsedRows(documents){
 return documents.filter(x=>x.status==='FINAL').flatMap(doc=>doc.lines.map((line,index)=>({
  id:'WH-DOC-'+doc.id+'-'+index,warehouse_id:doc.warehouse_id,source_key:doc.source_key,
  usage_date:doc.usage_date,sku:line.sku,item_name:line.item_name,unit:line.unit,
  qty_used:line.qty_used,actor_name:doc.finalized_by||doc.created_by,note:line.note,
  created_at:doc.finalized_at||doc.created_at
 })));
}
module.exports={normalizeLines,asUsedRows};
