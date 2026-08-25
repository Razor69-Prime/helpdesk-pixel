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

/* PXL-URG-0021C — Manual Material + Google Maps.
   Tambahan ini berada SETELAH blok PXL-URG-0020; logika Tanggal Pekerjaan di atas tidak diubah. */
(function(){
  'use strict';
  const MAP_MARKER='[GOOGLE_MAPS]';
  const MANUAL_PREFIX='manual:';

  function stripMap(notes){return String(notes||'').replace(/(?:^|\n)\[GOOGLE_MAPS\]\s*https?:\/\/\S+/gi,'').trim();}
  function mapFrom(notes){const m=String(notes||'').match(/\[GOOGLE_MAPS\]\s*(https?:\/\/\S+)/i);return m?m[1]:'';}

  function ensureMaps(){
    let input=document.getElementById('pxlGoogleMapsUrl');
    if(input)return input;
    const address=document.getElementById('address');
    if(!address?.parentElement)return null;
    const wrap=document.createElement('div');
    wrap.className='full';
    wrap.id='pxlGoogleMapsWrap';
    wrap.innerHTML='<label>Google Maps / Lokasi Pekerjaan</label><input id="pxlGoogleMapsUrl" type="url" placeholder="Tempel link Google Maps, contoh https://maps.app.goo.gl/..."><div class="sub" style="margin-top:4px">Link lokasi akan ikut ke Work Order / informasi tiket.</div>';
    address.parentElement.insertAdjacentElement('afterend',wrap);
    return wrap.querySelector('#pxlGoogleMapsUrl');
  }

  function setMode(row,manual){
    if(!row)return;
    row.dataset.manualMaterial=manual?'1':'0';
    const source=row.querySelector('.pxl-material-source');
    if(source)source.value=manual?'manual':'inventory';
    const input=row.querySelector('.item-search');
    const label=input?.closest('.item-picker')?.querySelector('label');
    const selected=row.querySelector('.selected-item');
    if(manual){
      row.dataset.inventoryId='';row.dataset.sku='';
      if(label)label.textContent='Nama Material Manual';
      if(input)input.placeholder='Ketik nama material secara manual...';
      if(selected){selected.textContent='Material manual — tidak terhubung Inventory / Material Request';selected.style.color='#9b541f';}
      row.querySelector('.item-results')?.classList.remove('open');
    }else{
      if(label)label.textContent='Cari Nama Material / SKU';
      if(input)input.placeholder='Ketik nama atau SKU...';
      if(selected)selected.style.color='';
    }
  }

  function enhance(row,data={}){
    if(!row||row.dataset.pxl0021c==='1')return;
    const picker=row.querySelector('.item-picker');
    if(!picker)return;
    row.dataset.pxl0021c='1';
    const source=document.createElement('select');
    source.className='pxl-material-source';
    source.style.cssText='margin-bottom:6px;width:100%;padding:7px 9px;border:1px solid #e4e1d8;border-radius:8px;background:#fff';
    source.innerHTML='<option value="inventory">Pilih dari Inventory</option><option value="manual">Input Manual</option>';
    const input=picker.querySelector('.item-search');
    picker.insertBefore(source,input);
    setMode(row,data?.manual_material===true||String(data?.inventory_item_id||'').startsWith(MANUAL_PREFIX));
    source.addEventListener('change',()=>setMode(row,source.value==='manual'));
    input?.addEventListener('focus',e=>{if(row.dataset.manualMaterial==='1'){e.stopImmediatePropagation();row.querySelector('.item-results')?.classList.remove('open');}},true);
    input?.addEventListener('input',e=>{if(row.dataset.manualMaterial==='1'){e.stopImmediatePropagation();row.querySelector('.item-results')?.classList.remove('open');}},true);
  }

  function install(){
    ensureMaps();
    if(typeof window.addMaterial!=='function'||typeof window.collect!=='function')return setTimeout(install,100);
    if(window.collect.__pxlUrg0021c)return;

    const oldAdd=window.addMaterial;
    window.addMaterial=function(data={}){
      const before=new Set(document.querySelectorAll('.material-row'));
      const result=oldAdd.apply(this,arguments);
      const row=[...document.querySelectorAll('.material-row')].find(x=>!before.has(x))||[...document.querySelectorAll('.material-row')].pop();
      enhance(row,data||{});
      return result;
    };
    document.querySelectorAll('.material-row').forEach(row=>enhance(row,{}));

    if(typeof window.selectInventory==='function'){
      const oldSelect=window.selectInventory;
      window.selectInventory=function(row,id){setMode(row,false);return oldSelect.apply(this,arguments);};
    }

    const oldCollect=window.collect;
    const wrappedCollect=function(){
      const manualRows=[...document.querySelectorAll('.material-row')].filter(r=>r.dataset.manualMaterial==='1');
      const fake=[];
      manualRows.forEach((row,i)=>{
        const name=row.querySelector('.item-search')?.value.trim()||'';
        if(!name)throw new Error('Nama material manual wajib diisi.');
        const qty=Number(row.querySelector('.qty')?.value||0);
        if(!(qty>0))throw new Error(`Qty material ${name} harus lebih dari 0.`);
        const id=MANUAL_PREFIX+Date.now().toString(36)+'-'+i;
        fake.push(id);row.dataset.inventoryId=id;row.dataset.sku='';
        OPT.inventory_items.push({id,name,sku:null,unit:row.querySelector('.unit')?.value||'pcs',stock:0});
      });
      let payload;
      try{payload=oldCollect.apply(this,arguments);}finally{OPT.inventory_items=OPT.inventory_items.filter(x=>!fake.includes(String(x?.id||'')));}
      const materials=(payload.items||[]).filter(x=>!['service','jasa'].includes(String(x.item_type||x.type||'item').toLowerCase()));
      [...document.querySelectorAll('.material-row')].forEach((row,i)=>{
        const item=materials[i];if(!item)return;
        if(row.dataset.manualMaterial==='1'){
          const name=row.querySelector('.item-search')?.value.trim()||item.name||'';
          item.name=name;item.item_name=name;item.manual_material=true;item.sku=null;item.stock_at_select=null;
          if(!String(item.inventory_item_id||'').startsWith(MANUAL_PREFIX))item.inventory_item_id=MANUAL_PREFIX+i;
        }else item.manual_material=false;
      });
      const maps=ensureMaps()?.value.trim()||'';
      if(maps&&!/^https?:\/\//i.test(maps))throw new Error('Link Google Maps harus diawali http:// atau https://');
      const notes=stripMap(payload.notes||'');
      payload.notes=notes+(maps?(notes?'\n':'')+MAP_MARKER+' '+maps:'');
      return payload;
    };
    wrappedCollect.__pxlUrg0021c=true;
    window.collect=wrappedCollect;

    if(typeof window.editSO==='function'){
      const oldEdit=window.editSO;
      window.editSO=function(id){
        const result=oldEdit.apply(this,arguments);
        setTimeout(()=>{
          try{
            const so=Array.isArray(D?.sales_orders)?D.sales_orders.find(x=>String(x.id)===String(id)):null;
            const maps=ensureMaps();if(maps)maps.value=mapFrom(so?.notes||'');
            const notes=document.getElementById('notes');if(notes)notes.value=stripMap(so?.notes||'');
            const material=(so?.items||[]).filter(x=>!['service','jasa'].includes(String(x.item_type||x.type||'item').toLowerCase()));
            [...document.querySelectorAll('.material-row')].forEach((row,i)=>enhance(row,material[i]||{}));
          }catch(_){}
        },0);
        return result;
      };
    }

    document.getElementById('resetBtn')?.addEventListener('click',()=>setTimeout(()=>{const m=ensureMaps();if(m)m.value='';},0));
    const hint=document.querySelector('#materialItems')?.closest('.line-section')?.querySelector('.toolbar .sub');
    if(hint)hint.textContent='Pilih dari Inventory atau gunakan Input Manual. Hanya material Inventory yang masuk Material Request.';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
