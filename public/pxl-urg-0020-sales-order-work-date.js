/* PXL-URG-0020 — Sales Order work date becomes Work Order worked_at. */
(function(){
  'use strict';

  const FIELD_ID='pxlSoWorkDate';
  const today=()=>{
    const d=new Date();
    const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
    return local.toISOString().slice(0,10);
  };

  function getOrders(){
    try{return typeof D!=='undefined'&&Array.isArray(D?.sales_orders)?D.sales_orders:[];}catch(_){return [];}
  }

  function dateFromSO(so){
    const items=Array.isArray(so?.items)?so.items:[];
    const found=items.find(x=>String(x?.work_order_date||'').trim());
    return String(found?.work_order_date||'').slice(0,10);
  }

  function ensureField(){
    if(document.getElementById(FIELD_ID)) return document.getElementById(FIELD_ID);
    const project=document.getElementById('projectName');
    if(!project?.parentElement) return null;
    const wrap=document.createElement('div');
    wrap.id='pxlSoWorkDateWrap';
    wrap.innerHTML='<label>Tanggal Pekerjaan</label><input id="'+FIELD_ID+'" type="date"><div class="sub" style="margin-top:4px">Tanggal ini otomatis menjadi tanggal Work Order.</div>';
    project.parentElement.insertAdjacentElement('afterend',wrap);
    const input=wrap.querySelector('#'+FIELD_ID);
    input.value=today();
    return input;
  }

  function setDate(value){
    const input=ensureField();
    if(input) input.value=(String(value||'').slice(0,10)||today());
  }

  function selectedDate(){
    return ensureField()?.value||today();
  }

  function annotateItems(body){
    if(!body||!Array.isArray(body.items)) return body;
    const workDate=selectedDate();
    body.items=body.items.map(item=>({...item,work_order_date:workDate}));
    return body;
  }

  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function pxlUrg0020Fetch(input,init={}){
    const url=typeof input==='string'?input:(input?.url||'');
    const method=String(init?.method||'GET').toUpperCase();

    if((method==='POST'||method==='PATCH') && /\/api\/sales-orders(?:\/[^/]+)?(?:\?.*)?$/.test(url)){
      try{
        const body=init.body?JSON.parse(init.body):{};
        annotateItems(body);
        init={...init,body:JSON.stringify(body)};
      }catch(_){ }
    }

    const woMatch=url.match(/\/api\/sales-orders\/([^/?]+)\/work-order(?:\?.*)?$/);
    if(method==='POST'&&woMatch){
      try{
        const id=decodeURIComponent(woMatch[1]);
        const so=getOrders().find(row=>String(row.id)===String(id));
        const workDate=dateFromSO(so)||today();
        let body={};
        try{body=init.body?JSON.parse(init.body):{};}catch(_){body={};}
        body.worked_at=workDate;
        init={...init,body:JSON.stringify(body)};
      }catch(_){ }
    }

    return nativeFetch(input,init);
  };

  function patchEdit(){
    if(typeof window.editSO!=='function'||window.editSO.__pxlUrg0020) return;
    const original=window.editSO;
    const wrapped=function(id){
      const result=original.apply(this,arguments);
      setTimeout(()=>{
        const so=getOrders().find(row=>String(row.id)===String(id));
        setDate(dateFromSO(so)||today());
      },0);
      return result;
    };
    wrapped.__pxlUrg0020=true;
    window.editSO=wrapped;
  }

  function patchReset(){
    if(typeof window.reset!=='function'||window.reset.__pxlUrg0020) return;
    const original=window.reset;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      setTimeout(()=>setDate(today()),0);
      return result;
    };
    wrapped.__pxlUrg0020=true;
    window.reset=wrapped;
  }

  ensureField();
  patchEdit();
  patchReset();
  document.getElementById('resetBtn')?.addEventListener('click',()=>setTimeout(()=>setDate(today()),0));
  document.addEventListener('click',event=>{
    const btn=event.target?.closest?.('[data-act="edit"]');
    if(!btn) return;
    const id=btn.dataset.id;
    setTimeout(()=>{
      const so=getOrders().find(row=>String(row.id)===String(id));
      setDate(dateFromSO(so)||today());
    },0);
  });
})();
