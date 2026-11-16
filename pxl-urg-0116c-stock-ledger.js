'use strict';
// PXL-URG-0116C — read-only daily inventory ledger; NO stock / MR / WO writes.
const ZONE='Asia/Makassar';
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const localDate=timestamp=>new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));
const n=v=>{const a=Number(v);return Number.isFinite(a)?a:null;};
const round=v=>Math.round((v+Number.EPSILON)*1e6)/1e6;
function buildDailyLedger({items=[],transactions=[],date}){
  if(!validDate(date))throw Error('Tanggal tidak valid');
  // Id ascending ties keep ordering deterministic for transactions recorded within one timestamp.
  const all=[...transactions].sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id||'').localeCompare(String(b.id||'')));
  const byItem=new Map();
  for(const tx of all){
    if(!tx.item_id||!tx.created_at||Number.isNaN(Date.parse(tx.created_at))||n(tx.qty)===null||n(tx.balance_after)===null)throw Error('Ada transaksi Inventory dengan data tanggal/quantity/saldo tidak valid');
    const key=String(tx.item_id);if(!byItem.has(key))byItem.set(key,[]);byItem.get(key).push(tx);
  }
  const lines=[];const rows=[];
  for(const item of items){
    const txs=byItem.get(String(item.id))||[];
    const previous=txs.filter(t=>localDate(t.created_at)<date);
    const today=txs.filter(t=>localDate(t.created_at)===date);
    const future=txs.filter(t=>localDate(t.created_at)>date);
    let opening,closing,quality='verified';
    if(today.length){opening=n(today[0].balance_after)-n(today[0].qty);closing=n(today.at(-1).balance_after);}
    else if(previous.length){opening=n(previous.at(-1).balance_after);closing=opening;}
    else if(future.length){opening=n(future[0].balance_after)-n(future[0].qty);closing=opening;}
    else {opening=n(item.stock);closing=opening;quality='no_transaction_history';}
    if(opening===null||closing===null||opening<0||closing<0)throw Error('Saldo Inventory tidak valid untuk '+String(item.name||item.id));
    const incoming=round(today.reduce((a,t)=>a+Math.max(0,n(t.qty)),0));
    const outgoing=round(today.reduce((a,t)=>a+Math.max(0,-n(t.qty)),0));
    if(Math.abs(round(opening+incoming-outgoing-closing))>0.000001)quality='balance_mismatch';
    lines.push({item_id:item.id,name:item.name||'-',sku:item.sku||'',unit:item.unit||'pcs',opening:round(opening),incoming,outgoing,closing:round(closing),quality});
    for(const t of today)rows.push({id:t.id,item_id:item.id,item_name:item.name||'-',unit:item.unit||'pcs',created_at:t.created_at,transaction_type:t.transaction_type,reference:t.reference||'',created_by:t.created_by||'',qty:n(t.qty),balance_after:n(t.balance_after)});
  }
  rows.sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))||String(a.id).localeCompare(String(b.id)));
  return {date,timezone:ZONE,items:lines,transactions:rows,transaction_count:rows.length,quality_warning:lines.some(x=>x.quality!=='verified')};
}
module.exports={validDate,localDate,buildDailyLedger};
