'use strict';
// PXL-WH-0001I: read-only report projection; never writes to Inventory or Warehouse.
(function(root,factory){
 const exportTools=factory();
 if(typeof module==='object'&&module.exports)module.exports=exportTools;
 if(root)root.PXL_WH_EXPORT=exportTools;
})(typeof window!=='undefined'?window:null,function(){
 const str=v=>String(v??'').trim();
 const qty=v=>v==null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
 // Treat user-controlled strings as cell text, not executable formulas on opening a workbook.
 const safe=v=>{const s=str(v);return /^[\s]*[=+@\-\t\r]/.test(s)?"'"+s:s;};
 const workDetails=r=>({
  'Nomor WH':safe(r.wh_number),'Nomor SO':safe(r.so_number),'Nomor WO':safe(r.wo_number),
  'Customer':safe(r.customer),'Pekerjaan':safe(r.job),
  'Teknisi':safe((r.technicians||[]).join(', ')),
  'Form MR (Jumlah)':(r.mr_numbers||[]).length,
  'Status':safe(r.status),'Status SO':safe(r.so_status),'Status WO':safe(r.wo_status)
 });
 function materials(rows){
  const work=rows.map(workDetails),details=[];
  for(const r of rows)for(const i of [...(r.items||[]),...(r.manual_items||[])])
   details.push({...workDetails(r),'Nama Material':safe(i.name),'SKU':safe(i.sku),
    'PROBUS':str(i.sku).startsWith('PX-')?'Ya':'Perlu mapping',
    'Sumber':safe(i.source),'Qty Rencana':qty(i.qty),'Satuan':safe(i.unit),
    'Qty Used (Sumber)':qty(i.qty_used),'Qty Return (Sumber)':qty(i.qty_returned)});
  return [{name:'Pekerjaan',rows:work},{name:'Detail Material',rows:details}];
 }
 const sourceDetails=(doc,allWork)=>{
  const r=allWork.find(x=>x.source_key===doc.source_key)||{};
  return {'Tanggal':str(doc.usage_date),'Dokumen':String(doc.id),
   'Nomor WH':safe(r.wh_number||doc.warehouse_id),
   'SO':safe(r.so_number),'WO':safe(r.wo_number),
   'Customer':safe(r.customer),'Teknisi':safe((r.technicians||[]).join(', ')),
   'Status':safe(doc.status),'Revisi':qty(doc.revision),
   'Jumlah Item':(doc.lines||[]).length,
   'Dibuat Oleh':safe(doc.created_by),'Final Oleh':safe(doc.finalized_by)};
 };
 function usage(documents,used,allWork){
  const drafts=documents.filter(d=>d.status==='DRAFT');
  const finals=documents.filter(d=>d.status==='FINAL');
  const details=[];
  for(const doc of documents)for(const line of doc.lines||[])
   details.push({...sourceDetails(doc,allWork),'Nama Material':safe(line.item_name),
    'SKU PX':safe(line.sku),'Qty Rencana':qty(line.planned_qty),
    'Qty USED':qty(line.qty_used),'Satuan':safe(line.unit),
    'Sumber':safe(line.source),'Keterangan':safe(line.note)});
  const finalized=used.map(r=>{
   const source=allWork.find(x=>x.source_key===r.source_key)||{};
   return {'Tanggal':str(r.usage_date),'Nomor WH':safe(source.wh_number||r.warehouse_id),
    'SO':safe(source.so_number),'WO':safe(source.wo_number),'Customer':safe(source.customer),
    'Teknisi':safe((source.technicians||[]).join(', ')),
    'Nama Material':safe(r.item_name),'SKU PX':safe(r.sku),
    'Qty USED':qty(r.qty_used),'Satuan':safe(r.unit),
    'Petugas':safe(r.actor_name),'Keterangan':safe(r.note)};
  });
  return [{name:'Draft',rows:drafts.map(d=>sourceDetails(d,allWork))},
   {name:'Dokumen Final',rows:finals.map(d=>sourceDetails(d,allWork))},
   {name:'Detail Draft dan Final',rows:details},
   {name:'USED Final',rows:finalized}];
 }
 function daily(data){
  return [{name:'Daily Stock',rows:(data.items||[]).map(i=>({
   'Tanggal':str(data.date),'Nama Material':safe(i.name),'SKU PX':safe(i.sku),
   'Satuan':safe(i.unit),'Beginning':qty(i.opening),'IN':qty(i.incoming),
   'OUT':qty(i.outgoing),'Ending':qty(i.closing),
   'Status':i.quality==='invalid_balance'?'Perlu rekonsiliasi':safe(i.quality),
   'Keterangan':safe(i.warning)
  }))}];
 }
 function monthly(data){
  return [{name:'Monthly OUT',rows:(data.items||[]).map(i=>({
   'Bulan':str(data.month),'Nama Material':safe(i.name),'SKU PX':safe(i.sku),
   'Satuan':safe(i.unit),'IN':qty(i.incoming),'OUT':qty(i.outgoing),'USED Final':qty(i.used)
  }))}];
 }
 function verification(data){
  return [{name:'Stock Verification',rows:(data.rows||[]).map(i=>({
   'Tanggal':safe(i.created_at),'Nama Material':safe(i.item_name),'SKU PX':safe(i.sku),
   'Saldo Sistem':qty(i.system_qty),'Hitung Fisik':qty(i.physical_qty),
   'Selisih':qty(Number(i.physical_qty)-Number(i.system_qty)),
   'Petugas':safe(i.actor_name),'Catatan':safe(i.note)
  }))}];
 }
 function workbook(xlsx,sheets,filename){
  if(!xlsx?.utils?.json_to_sheet||!xlsx?.utils?.book_new||!xlsx?.utils?.book_append_sheet||!xlsx?.writeFile)throw Error('Library Excel belum dimuat. Muat ulang halaman.');
  if(!Array.isArray(sheets)||!sheets.length)throw Error('Tidak ada laporan untuk diekspor.');
  const book=xlsx.utils.book_new();
  for(const sheet of sheets){
   const cols=sheet.rows?.[0]?Object.keys(sheet.rows[0]):['Keterangan'];
   const rows=sheet.rows?.length?sheet.rows:[{'Keterangan':'Belum ada data untuk periode yang dipilih.'}];
   const ws=xlsx.utils.json_to_sheet(rows);
   ws['!cols']=cols.map(k=>({wch:Math.min(55,Math.max(16,k.length+3,...rows.slice(0,100).map(r=>String(r[k]??'').length+2)))}));
   ws['!autofilter']={ref:ws['!ref']};
   xlsx.utils.book_append_sheet(book,ws,sheet.name.slice(0,31));
  }
  xlsx.writeFile(book,filename.endsWith('.xlsx')?filename:filename+'.xlsx');
 }
 return {materials,usage,daily,monthly,verification,workbook};
});
