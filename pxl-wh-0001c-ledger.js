'use strict';
const ledger=require('./pxl-urg-0116c-stock-ledger');
function safeDailyLedger({items=[],transactions=[],date}){
 const mapped=new Map();
 for(const tx of transactions){
  const key=String(tx.item_id||'');
  if(!mapped.has(key))mapped.set(key,[]);
  mapped.get(key).push(tx);
 }
 const result={date,timezone:'Asia/Makassar',items:[],transactions:[],transaction_count:0,quality_warning:false,invalid_count:0};
 for(const item of items){
  try{
   const daily=ledger.buildDailyLedger({items:[item],transactions:mapped.get(String(item.id))||[],date});
   result.items.push(...daily.items);
   result.transactions.push(...daily.transactions);
   if(daily.quality_warning)result.quality_warning=true;
  }catch(e){
   result.invalid_count++;result.quality_warning=true;
   result.items.push({item_id:item.id,sku:item.sku,name:item.name,unit:item.unit||'pcs',opening:null,incoming:null,outgoing:null,closing:null,quality:'invalid_balance',warning:e.message});
  }
 }
 result.transactions.sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))||String(a.id).localeCompare(String(b.id)));
 result.transaction_count=result.transactions.length;
 return result;
}
module.exports={safeDailyLedger};
