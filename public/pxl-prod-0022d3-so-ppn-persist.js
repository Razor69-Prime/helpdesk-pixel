/* PXL-PROD-0022D9 — Sinkron subtotal include PPN tanpa kolom ppn_total. */
(function(){
  'use strict';

  const REV='PXL-PROD-0022D9';
  let installed=false;

  const n=v=>{
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  };

  function taxAmount(item){
    if(!item) return 0;
    const applied=
      item.ppn_applied===true ||
      String(item.ppn_applied)==='true' ||
      String(item.ppn_applied)==='1';

    if(!applied) return 0;

    const stored=n(item.ppn_amount);
    if(stored>0) return stored;

    return n(item.qty)*n(item.unit_price)*n(item.ppn_rate)/100;
  }

  function effectiveGrand(so){
    const items=Array.isArray(so?.items)?so.items:[];
    const base=items.reduce((sum,item)=>sum+n(item.qty)*n(item.unit_price),0);
    const ppn=items.reduce((sum,item)=>sum+taxAmount(item),0);
    return {base,ppn,grand:base+ppn};
  }

  function normalizeOrderForDisplay(so){
    if(!so || !Array.isArray(so.items)) return so;
    const totals=effectiveGrand(so);

    const material=so.items
      .filter(x=>!['service','jasa'].includes(String(x.item_type||x.type||'item').toLowerCase()))
      .reduce((sum,x)=>sum+n(x.qty)*n(x.unit_price)+taxAmount(x),0);

    const service=so.items
      .filter(x=>['service','jasa'].includes(String(x.item_type||x.type||'').toLowerCase()))
      .reduce((sum,x)=>sum+n(x.qty)*n(x.unit_price)+taxAmount(x),0);

    so.material_subtotal=material;
    so.service_subtotal=service;
    so.ppn_total=totals.ppn;
    so.quotation_total=totals.grand;
    so.total_amount=totals.grand;
    return so;
  }

  function normalizePayload(payload){
    if(!payload || !Array.isArray(payload.items)) return payload;

    const domRows=[
      ...document.querySelectorAll('.material-row'),
      ...document.querySelectorAll('.service-row')
    ];

    if(!payload.items.some(x=>'ppn_applied' in x) && payload.items.length===domRows.length){
      payload.items.forEach((item,index)=>{
        const row=domRows[index];
        const applied=row?.dataset?.ppnApplied==='1';
        const rate=applied?n(row?.dataset?.ppnRate):0;
        item.ppn_applied=applied;
        item.ppn_rate=rate;
        item.ppn_amount=applied?n(item.qty)*n(item.unit_price)*rate/100:0;
      });
    }

    payload.items.forEach(item=>{
      const applied=
        item.ppn_applied===true ||
        String(item.ppn_applied)==='true' ||
        String(item.ppn_applied)==='1';

      item.ppn_applied=applied;
      item.ppn_rate=applied?n(item.ppn_rate):0;
      item.ppn_amount=applied
        ? (n(item.ppn_amount)>0
            ? n(item.ppn_amount)
            : n(item.qty)*n(item.unit_price)*n(item.ppn_rate)/100)
        : 0;
    });

    const material=payload.items
      .filter(x=>!['service','jasa'].includes(String(x.item_type||x.type||'item').toLowerCase()))
      .reduce((sum,x)=>sum+n(x.qty)*n(x.unit_price)+taxAmount(x),0);

    const service=payload.items
      .filter(x=>['service','jasa'].includes(String(x.item_type||x.type||'').toLowerCase()))
      .reduce((sum,x)=>sum+n(x.qty)*n(x.unit_price)+taxAmount(x),0);

    const ppn=payload.items.reduce((sum,x)=>sum+taxAmount(x),0);
    const grand=material+service;

    payload.material_subtotal=material;
    payload.service_subtotal=service;
    delete payload.ppn_total;
    payload.quotation_total=grand;
    payload.total_amount=grand;

    return payload;
  }

  function install(){
    if(installed) return;

    if(typeof window.collect!=='function' || typeof window.render!=='function'){
      return setTimeout(install,100);
    }

    installed=true;

    const oldCollect=window.collect;
    window.collect=function(){
      return normalizePayload(oldCollect());
    };

    const oldRender=window.render;
    window.render=function(){
      try{
        if(typeof D!=='undefined' && Array.isArray(D?.sales_orders)){
          D.sales_orders.forEach(normalizeOrderForDisplay);
        }
      }catch(_){}
      return oldRender();
    };

    try{
      if(typeof D!=='undefined' && Array.isArray(D?.sales_orders)){
        D.sales_orders.forEach(normalizeOrderForDisplay);
        oldRender();
      }
    }catch(_){}

    window.PXL_PROD_0022D3={
      revision:REV,
      effectiveGrand,
      normalizePayload
    };
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else{
    install();
  }
})();

// PXL-URG-0030C — fallback loader kalkulator harga final include PPN.
(function(){
  'use strict';
  if(window.PXL_URG_0030?.revision==='PXL-URG-0030C' || document.querySelector('script[data-pxl-pricing-loader="0030C"]')) return;
  const script=document.createElement('script');
  script.dataset.pxlPricingLoader='0030C';
  script.src='/pxl-urg-0030-pricing-calculator.js?v=PXL-URG-0030C';
  document.head.appendChild(script);
})();

// PXL-URG-0031 — isolated Purchase Request PDF branding loader.
(function(){
  'use strict';
  if(document.querySelector('script[data-pxl-pr-pdf-branding="0031"]')) return;
  const script=document.createElement('script');
  script.dataset.pxlPrPdfBranding='0031';
  script.src='/pxl-urg-0031-pr-pdf-branding.js?v=PXL-URG-0031';
  document.head.appendChild(script);
})();

// PXL-URG-0034 — CRM customer fast search for Sales Order. UI-only, manual input remains allowed.
(function(){
  'use strict';
  if(document.querySelector('script[data-pxl-so-customer-picker="0034"]')) return;
  const script=document.createElement('script');
  script.dataset.pxlSoCustomerPicker='0034';
  script.src='/pxl-urg-0034-so-customer-picker.js?v=PXL-URG-0034';
  document.head.appendChild(script);
})();
