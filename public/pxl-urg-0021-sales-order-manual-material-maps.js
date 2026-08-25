/* PXL-URG-0021 — manual SO material + Google Maps location on ticket info. */
(function(){
  'use strict';

  const MAP_MARKER='[GOOGLE_MAPS]';
  const MANUAL_PREFIX='manual:';

  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function stripMapMarker(notes){
    return String(notes || '').replace(/(?:^|\n)\[GOOGLE_MAPS\]\s*https?:\/\/\S+/gi,'').trim();
  }

  function mapFromNotes(notes){
    const match=String(notes || '').match(/\[GOOGLE_MAPS\]\s*(https?:\/\/\S+)/i);
    return match ? match[1] : '';
  }

  function validMapUrl(value){
    return !value || /^https?:\/\//i.test(value);
  }

  function addMapsField(){
    if(document.getElementById('pxl-google-maps-url')) return;
    const address=document.getElementById('address');
    if(!address) return;
    const holder=address.closest('div');
    if(!holder) return;
    const wrap=document.createElement('div');
    wrap.className='full';
    wrap.id='pxl-google-maps-field';
    wrap.innerHTML='<label>Google Maps / Lokasi Pekerjaan</label>'+
      '<input id="pxl-google-maps-url" type="url" placeholder="Tempel link Google Maps, contoh https://maps.app.goo.gl/...">'+
      '<div class="sub" style="margin-top:4px">Link akan ikut ke Work Order dan tampil pada informasi Daftar Tiket.</div>';
    holder.insertAdjacentElement('afterend',wrap);
  }

  function setManualMode(row, manual){
    if(!row) return;
    row.dataset.manualMaterial=manual?'1':'0';
    row.classList.toggle('pxl-manual-material',manual);
    const source=row.querySelector('.pxl-material-source');
    if(source) source.value=manual?'manual':'inventory';
    const input=row.querySelector('.item-search');
    const label=input?.closest('.item-picker')?.querySelector('label');
    const selected=row.querySelector('.selected-item');
    if(manual){
      row.dataset.inventoryId='';
      row.dataset.sku='';
      if(label) label.textContent='Nama Material Manual';
      if(input) input.placeholder='Ketik nama material secara manual...';
      if(selected){selected.textContent='Material manual — tidak terhubung Inventory / Material Request';selected.style.color='#9b541f';}
      row.querySelector('.item-results')?.classList.remove('open');
    }else{
      if(label) label.textContent='Cari Nama Material / SKU';
      if(input) input.placeholder='Ketik nama atau SKU...';
      if(selected) selected.style.color='';
    }
  }

  function enhanceMaterialRow(row,data){
    if(!row || row.dataset.pxl0021Enhanced==='1') return;
    row.dataset.pxl0021Enhanced='1';
    const picker=row.querySelector('.item-picker');
    if(!picker) return;
    const source=document.createElement('select');
    source.className='pxl-material-source';
    source.style.cssText='margin-bottom:6px;padding:7px 9px;border:1px solid #e4e1d8;border-radius:8px;background:#fff;font:inherit';
    source.innerHTML='<option value="inventory">Pilih dari Inventory</option><option value="manual">Input Manual</option>';
    picker.insertBefore(source,picker.querySelector('.item-search'));
    const manual=Boolean(data?.manual_material)||String(data?.inventory_item_id||'').startsWith(MANUAL_PREFIX);
    setManualMode(row,manual);
    source.addEventListener('change',()=>setManualMode(row,source.value==='manual'));
    row.querySelector('.item-search')?.addEventListener('focus',event=>{
      if(row.dataset.manualMaterial==='1'){
        event.stopImmediatePropagation();
        row.querySelector('.item-results')?.classList.remove('open');
      }
    },true);
    row.querySelector('.item-search')?.addEventListener('input',()=>{
      if(row.dataset.manualMaterial==='1'){
        row.querySelector('.item-results')?.classList.remove('open');
        const selected=row.querySelector('.selected-item');
        if(selected) selected.textContent='Material manual — tidak terhubung Inventory / Material Request';
      }
    });
  }

  function installSalesOrderPatch(){
    addMapsField();
    if(typeof window.addMaterial==='function' && !window.addMaterial.__pxl0021){
      const original=window.addMaterial;
      const wrapped=function(data){
        const before=new Set(document.querySelectorAll('.material-row'));
        const result=original.apply(this,arguments);
        const row=[...document.querySelectorAll('.material-row')].find(r=>!before.has(r)) || [...document.querySelectorAll('.material-row')].pop();
        enhanceMaterialRow(row,data||{});
        return result;
      };
      wrapped.__pxl0021=true;
      window.addMaterial=wrapped;
    }

    document.querySelectorAll('.material-row').forEach(row=>enhanceMaterialRow(row,{}));

    if(typeof window.selectInventory==='function' && !window.selectInventory.__pxl0021){
      const originalSelect=window.selectInventory;
      const wrappedSelect=function(row,id){
        setManualMode(row,false);
        return originalSelect.apply(this,arguments);
      };
      wrappedSelect.__pxl0021=true;
      window.selectInventory=wrappedSelect;
    }

    if(typeof window.collect==='function' && !window.collect.__pxl0021){
      const originalCollect=window.collect;
      const wrappedCollect=function(){
        const manualRows=[...document.querySelectorAll('.material-row')].filter(row=>row.dataset.manualMaterial==='1');
        const fakeItems=[];
        manualRows.forEach((row,index)=>{
          const name=row.querySelector('.item-search')?.value.trim()||'';
          if(!name) throw new Error('Nama material manual wajib diisi.');
          const unit=row.querySelector('.unit')?.value.trim()||'pcs';
          const fakeId=MANUAL_PREFIX+Date.now().toString(36)+'-'+index;
          row.dataset.inventoryId=fakeId;
          const fake={id:fakeId,name,sku:null,unit,stock:0,tracking_mode:'quantity'};
          fakeItems.push(fake);
          try{OPT.inventory_items.push(fake);}catch(_){}
        });
        let payload;
        try{
          payload=originalCollect.apply(this,arguments);
        }finally{
          try{OPT.inventory_items=OPT.inventory_items.filter(item=>!String(item?.id||'').startsWith(MANUAL_PREFIX));}catch(_){}
        }
        const materialItems=(payload.items||[]).filter(item=>!['service','jasa'].includes(String(item.item_type||item.type||'item').toLowerCase()));
        let manualIndex=0;
        [...document.querySelectorAll('.material-row')].forEach((row,index)=>{
          const item=materialItems[index];
          if(!item) return;
          if(row.dataset.manualMaterial==='1'){
            const name=row.querySelector('.item-search')?.value.trim()||item.name||item.item_name||'';
            item.name=name;
            item.item_name=name;
            item.item_type='item';
            item.manual_material=true;
            item.sku=null;
            if(!String(item.inventory_item_id||'').startsWith(MANUAL_PREFIX)) item.inventory_item_id=MANUAL_PREFIX+(manualIndex++);
          }else{
            item.manual_material=false;
          }
        });
        const maps=document.getElementById('pxl-google-maps-url')?.value.trim()||'';
        if(!validMapUrl(maps)) throw new Error('Link Google Maps harus berupa URL http/https yang valid.');
        const cleanNotes=stripMapMarker(payload.notes||'');
        payload.notes=cleanNotes+(maps?(cleanNotes?'\n':'')+MAP_MARKER+' '+maps:'');
        return payload;
      };
      wrappedCollect.__pxl0021=true;
      window.collect=wrappedCollect;
    }

    if(typeof window.editSO==='function' && !window.editSO.__pxl0021){
      const originalEdit=window.editSO;
      const wrappedEdit=function(id){
        const result=originalEdit.apply(this,arguments);
        setTimeout(()=>{
          try{
            const so=(typeof D!=='undefined'&&Array.isArray(D.sales_orders))?D.sales_orders.find(row=>String(row.id)===String(id)):null;
            const maps=document.getElementById('pxl-google-maps-url');
            if(maps) maps.value=mapFromNotes(so?.notes||'');
            const notes=document.getElementById('notes');
            if(notes) notes.value=stripMapMarker(so?.notes||notes.value||'');
            const rows=[...document.querySelectorAll('.material-row')];
            const materials=(so?.items||[]).filter(item=>!['service','jasa'].includes(String(item.item_type||item.type||'item').toLowerCase()));
            rows.forEach((row,index)=>enhanceMaterialRow(row,materials[index]||{}));
          }catch(_){}
        },0);
        return result;
      };
      wrappedEdit.__pxl0021=true;
      window.editSO=wrappedEdit;
    }

    if(typeof window.reset==='function' && !window.reset.__pxl0021){
      const originalReset=window.reset;
      const wrappedReset=function(){
        const result=originalReset.apply(this,arguments);
        const maps=document.getElementById('pxl-google-maps-url');
        if(maps) maps.value='';
        return result;
      };
      wrappedReset.__pxl0021=true;
      window.reset=wrappedReset;
    }
  }

  function mapsFromTicket(ticket){
    const direct=ticket?.google_maps_url||ticket?.integration_meta?.google_maps_url||'';
    if(direct) return direct;
    return mapFromNotes(ticket?.description||'');
  }

  function installTicketMapLinks(){
    function tickets(){try{return typeof allTickets!=='undefined'&&Array.isArray(allTickets)?allTickets:[];}catch(_){return[];}}
    function decorate(){
      const rows=tickets();
      if(!rows.length) return;
      document.querySelectorAll('.ticket-item').forEach(card=>{
        if(card.querySelector('.pxl0021-map-link')) return;
        const wo=card.querySelector('.ticket-wo')?.textContent?.trim();
        if(!wo) return;
        const ticket=rows.find(row=>String(row.wo_number||'').trim()===wo);
        const url=mapsFromTicket(ticket);
        if(!url) return;
        const meta=card.querySelector('.ticket-meta');
        if(!meta) return;
        const link=document.createElement('a');
        link.className='pxl0021-map-link';
        link.href=url;
        link.target='_blank';
        link.rel='noopener noreferrer';
        link.textContent='📍 Google Maps';
        link.style.cssText='color:var(--blue);font-weight:600;text-decoration:none';
        meta.appendChild(link);
      });
    }
    decorate();
    new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});
    setInterval(decorate,1500);
  }

  function boot(){
    if(location.pathname.includes('sales-order')){
      installSalesOrderPatch();
      setTimeout(installSalesOrderPatch,300);
      setTimeout(installSalesOrderPatch,1200);
    }else{
      installTicketMapLinks();
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
