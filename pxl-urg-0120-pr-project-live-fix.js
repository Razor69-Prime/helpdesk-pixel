'use strict';

// PXL-URG-0120 — utilities only. No routes, no DB/schema mutation.
function compactPrForLegacyRenderer(rows){
  return (Array.isArray(rows)?rows:[]).map(row=>{
    const source=Array.isArray(row.items)?row.items:[];
    const count=source.length;
    const total=source.reduce((sum,item)=>sum+(Number(item?.qty||0)*Number(item?.price||0)),0);
    const pending=source.filter(item=>item?.inventory_status==='pending_registration').length;
    const descriptions=source.map(item=>String(item?.desc||'').trim()).filter(Boolean).join(' · ');
    const items=Array.from({length:count},(_,index)=>{
      const out={};
      if(index===0){out.desc=descriptions;out.qty=1;out.price=total;}
      if(index<pending)out.inventory_status='pending_registration';
      return out;
    });
    return {...row,items};
  });
}

module.exports={compactPrForLegacyRenderer};