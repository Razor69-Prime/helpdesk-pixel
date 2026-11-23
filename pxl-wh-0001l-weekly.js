'use strict';
// Read-only weekly aggregation using the identical audited Daily Stock ledger.
const {safeDailyLedger}=require('./pxl-wh-0001c-ledger');
const {validDate,localDate}=require('./pxl-urg-0116c-stock-ledger');
const shift=(day,n)=>{const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const monday=day=>{if(!validDate(day))throw Error('Tanggal minggu tidak valid');const dow=new Date(day+'T00:00:00Z').getUTCDay();return shift(day,-((dow+6)%7));};
const round=x=>Math.round((x+Number.EPSILON)*1e6)/1e6;
function buildWeeklyLedger({items=[],transactions=[],weekStart,today=localDate(new Date().toISOString())}){
 if(!validDate(weekStart)||monday(weekStart)!==weekStart||!validDate(today))throw Error('Pilih tanggal Senin sebagai awal minggu');
 if(weekStart>today)throw Error('Minggu mendatang belum memiliki data stok');
 const weekEnd=shift(weekStart,6),end=weekEnd<today?weekEnd:today;
 const first=safeDailyLedger({items,transactions,date:weekStart});
 const last=safeDailyLedger({items,transactions,date:end});
 const lastMap=new Map(last.items.map(row=>[String(row.item_id),row]));
 const movements=new Map();
 for(const tx of transactions){
  if(!tx.created_at)continue;
  const day=localDate(tx.created_at);
  if(day<weekStart||day>end)continue;
  const id=String(tx.item_id||'');
  const v=Number(tx.qty);
  const m=movements.get(id)||{incoming:0,outgoing:0,count:0,invalid:false};
  if(!Number.isFinite(v))m.invalid=true;
  else if(v>=0)m.incoming+=v;else m.outgoing-=v;
  m.count++;movements.set(id,m);
 }
 let invalid_count=0;
 const rows=first.items.map(start=>{
  const finish=lastMap.get(String(start.item_id));
  const movement=movements.get(String(start.item_id))||{incoming:0,outgoing:0,count:0,invalid:false};
  const incoming=round(movement.incoming),outgoing=round(movement.outgoing);
  let quality=start.quality==='invalid_balance'||finish?.quality==='invalid_balance'||movement.invalid?'invalid_balance':
    start.quality==='balance_mismatch'||finish?.quality==='balance_mismatch'?'balance_mismatch':
    start.quality==='no_transaction_history'?'no_transaction_history':'verified';
  const opening=start.opening,closing=finish?.closing;
  if(opening==null||closing==null)quality='invalid_balance';
  else if(Math.abs(round(opening+incoming-outgoing-closing))>0.000001)quality='balance_mismatch';
  if(quality==='invalid_balance')invalid_count++;
  return {item_id:start.item_id,sku:start.sku,name:start.name,unit:start.unit,
   opening:quality==='invalid_balance'?null:opening,
   incoming:quality==='invalid_balance'?null:incoming,
   outgoing:quality==='invalid_balance'?null:outgoing,
   closing:quality==='invalid_balance'?null:closing,
   transaction_count:movement.count,moved:movement.count>0,quality,
   warning:quality==='invalid_balance'?'Saldo perlu rekonsiliasi':quality==='balance_mismatch'?'Beginning + IN - OUT tidak sama dengan Ending':''};
 });
 return {week_start:weekStart,week_end:weekEnd,through_date:end,timezone:'Asia/Makassar',
  partial:end!==weekEnd,items:rows,invalid_count,quality_warning:rows.some(r=>r.quality==='invalid_balance'||r.quality==='balance_mismatch'),
  movement_count:rows.filter(r=>r.moved).length};
}
module.exports={monday,shift,buildWeeklyLedger};
