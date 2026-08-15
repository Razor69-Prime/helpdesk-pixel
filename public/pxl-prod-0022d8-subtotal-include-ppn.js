/* PXL-PROD-0022D8 — Subtotal Material/Jasa mengikuti TOTAL item include PPN. */
(function(){
  'use strict';

  const REV='PXL-PROD-0022D8';
  let installed=false;
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
  const rp=v=>'Rp '+Math.round(n(v)).toLocaleString('id-ID');
  const $=id=>document.getElementById(id);

  function isProjectMode(){
    return $('pxlSoMode')?.value==='project';
  }

  function isService(item){
    return ['service','jasa'].includes(String(item?.item_type||item?.type||'').toLowerCase());
  }

  function isTaxed(item){
    return item?.ppn_applied===true ||
      String(item?.ppn_applied)==='true' ||
      String(item?.ppn_applied)==='1';
  }

  function baseLine(item){
    return n(item?.qty)*n(item?.unit_price);
  }

  function taxLine(item){
    if(!isTaxed(item)) return 0;
    const stored=n(item?.ppn_amount);
    if(stored>0) return stored;
    return baseLine(item)*n(item?.ppn_rate)/100;
  }

  function inclusiveLine(item){
    return baseLine(item)+taxLine(item);
  }

  function itemsFromDom(){
    const out=[];
    document.querySelectorAll('.material-row').forEach(row=>{
      const qty=n(row.querySelector('.qty')?.value);
      const unitPrice=n(row.querySelector('.price')?.value);
      const applied=row.dataset.ppnApplied==='1';
      const rate=applied?n(row.dataset.ppnRate):0;
      out.push({
        item_type:'item',
        qty,
        unit_price:unitPrice,
        ppn_applied:applied,
        ppn_rate:rate,
        ppn_amount:applied?qty*unitPrice*rate/100:0
      });
    });
    document.querySelectorAll('.service-row').forEach(row=>{
      const qty=n(row.querySelector('.qty')?.value);
      const unitPrice=n(row.querySelector('.price')?.value);
      const applied=row.dataset.ppnApplied==='1';
      const rate=applied?n(row.dataset.ppnRate):0;
      out.push({
        item_type:'service',
        qty,
        unit_price:unitPrice,
        ppn_applied:applied,
        ppn_rate:rate,
        ppn_amount:applied?qty*unitPrice*rate/100:0
      });
    });
    return out;
  }

  function projectItems(){
    // collect() milik modul Site sudah menggabungkan semua Site.
    // Catch diperlukan saat user masih mengisi Site yang belum valid.
    try{
      const payload=window.collect?.();
      if(payload && Array.isArray(payload.items)) return payload.items;
    }catch(_){}
    return itemsFromDom();
  }

  function calculate(items){
    let material=0;
    let service=0;
    let ppn=0;

    (Array.isArray(items)?items:[]).forEach(item=>{
      const inclusive=inclusiveLine(item);
      const tax=taxLine(item);
      ppn+=tax;
      if(isService(item)) service+=inclusive;
      else material+=inclusive;
    });

    return {
      materialSubtotal:material,
      serviceSubtotal:service,
      ppnTotal:ppn,
      grandTotal:material+service
    };
  }

  function install(){
    if(installed) return;
    if(typeof window.updateTotals!=='function'){
      return setTimeout(install,100);
    }
    installed=true;

    const oldTotals=window.updateTotals;

    window.updateTotals=function(){
      // Pertahankan semua kalkulasi/event dari D6/Site module terlebih dahulu,
      // termasuk TOTAL per row yang sudah include PPN.
      let previous={};
      try{previous=oldTotals?.()||{};}catch(_){}

      const items=isProjectMode()?projectItems():itemsFromDom();
      const totals=calculate(items);

      if($('materialSubtotal')) $('materialSubtotal').textContent=rp(totals.materialSubtotal);
      if($('serviceSubtotal')) $('serviceSubtotal').textContent=rp(totals.serviceSubtotal);
      if($('ppnTotal')) $('ppnTotal').textContent=rp(totals.ppnTotal);
      if($('grandTotal')) $('grandTotal').textContent=rp(totals.grandTotal);

      return {...previous,...totals};
    };

    // Refresh tampilan awal setelah patch terpasang.
    try{window.updateTotals();}catch(_){}

    window.PXL_PROD_0022D8={
      revision:REV,
      calculate
    };
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else{
    install();
  }
})();
