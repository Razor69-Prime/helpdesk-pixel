/* PXL-VNEXT-2C — Prefill Sales Order from completed Manual Survey WO. */
(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  const surveyTicketId=params.get('survey_ticket_id')||'';
  const focusSoId=params.get('focus_so_id')||'';
  if(!surveyTicketId&&!focusSoId)return;

  let installed=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const delay=ms=>new Promise(r=>setTimeout(r,ms));

  async function waitReady(){
    if(window.pxlSalesOrderReady&&typeof window.pxlSalesOrderReady.then==='function')await window.pxlSalesOrderReady;
    for(let i=0;i<30;i++){
      const maps=document.getElementById('pxlGoogleMapsUrl');
      if(typeof api==='function'&&typeof addMaterial==='function'&&typeof addService==='function'&&typeof reset==='function'&&typeof collect==='function'&&maps)return true;
      await delay(100);
    }
    throw new Error('Form Sales Order belum siap. Silakan refresh halaman.');
  }

  function ensureNotice(){
    let el=document.getElementById('pxl2c-survey-source-notice');
    if(el)return el;
    const form=document.querySelector('.card.section');
    if(!form)return null;
    el=document.createElement('div');
    el.id='pxl2c-survey-source-notice';
    el.style.cssText='display:none;margin:0 0 12px;padding:11px 13px;border-radius:9px;border:1px solid #b5d4f4;background:#e6f1fb;color:#185fa5;font-size:12px;line-height:1.5';
    form.querySelector('.toolbar')?.insertAdjacentElement('afterend',el);
    return el;
  }

  function setValue(id,value){const el=document.getElementById(id);if(el)el.value=value??'';}
  function applyClassification(data){
    const customer=(OPT.customers||[]).find(c=>String(c.id||'')===String(data.customer_id||''));
    if(customer&&typeof applyCrmCustomer==='function'){
      applyCrmCustomer(customer,{fillContact:false});
      selectedCustomerId=customer.id;
    }else{
      selectedCustomerId=data.customer_id||null;
      setValue('marketSegment',data.market_segment||'');
      if(typeof syncMarketSectorOptions==='function')syncMarketSectorOptions(data.sector||'');
      setValue('sector',data.sector||'');
    }
  }

  function clearItemContainers(){
    const mat=document.getElementById('materialItems'),svc=document.getElementById('serviceItems');
    if(mat)mat.innerHTML='';
    if(svc)svc.innerHTML='';
  }

  function materialForSO(item,index){
    const mapped=!!item.inventory_item_id;
    return {
      inventory_item_id:mapped?item.inventory_item_id:`manual:survey-${surveyTicketId}-${index}`,
      item_name:item.name||'',name:item.name||'',qty:Number(item.qty||0),unit:item.unit||'pcs',unit_price:0,
      manual_material:!mapped,
      source_type:mapped?'inventory':'manual'
    };
  }
  function serviceForSO(item){return {item_name:item.name||'',name:item.name||'',qty:Number(item.qty||0),unit:item.unit||'jasa',unit_price:0,item_type:'service'};}

  function wrapCollect(data){
    if(window.collect.__pxlVnext2c)return;
    const original=window.collect;
    const wrapped=function(){
      const payload=original.apply(this,arguments);
      payload.survey_source_ticket_id=data.source_ticket_id;
      payload.survey_source_wo_number=data.source_wo_number;
      return payload;
    };
    wrapped.__pxlUrg0021c=true;
    wrapped.__pxlVnext2c=true;
    window.collect=wrapped;
  }

  async function prefillSurvey(){
    const data=await api('GET',`/api/tickets/${encodeURIComponent(surveyTicketId)}/survey-sales-order-draft`);
    if(!data||String(data.source_ticket_id||'')!==String(surveyTicketId))throw new Error('Data hasil Survey tidak valid atau belum siap diprefill.');
    if(data.existing_sales_order_id){
      if(typeof editSO==='function'){
        editSO(data.existing_sales_order_id);
        const n=ensureNotice();if(n){n.style.display='block';n.innerHTML=`Survey <b>${esc(data.source_wo_number)}</b> sudah terhubung ke <b>${esc(data.existing_so_number||'Sales Order')}</b>.`}
      }
      return;
    }
    reset();
    setValue('customer',data.customer_name||'');
    setValue('phone',data.customer_phone||'');
    setValue('projectName',data.project_name||'');
    setValue('address',data.address||'');
    setValue('notes',data.notes||'');
    applyClassification(data);
    const maps=document.getElementById('pxlGoogleMapsUrl');if(maps)maps.value=data.google_maps_url||'';
    clearItemContainers();
    (data.materials||[]).forEach((item,index)=>addMaterial(materialForSO(item,index)));
    (data.services||[]).forEach(item=>addService(serviceForSO(item)));
    if(typeof updateEmptyHints==='function')updateEmptyHints();
    if(typeof updateTotals==='function')updateTotals();
    wrapCollect(data);
    const n=ensureNotice();if(n){n.style.display='block';n.innerHTML=`Sumber: hasil Survey <b>${esc(data.source_wo_number)}</b>. Customer, project, lokasi, material, jasa dan qty diprefill dan tetap dapat dikoreksi. <b>Harga tidak berasal dari laporan Survey dan wajib diisi/review oleh Sales.</b>`}
    if(document.getElementById('formTitle'))document.getElementById('formTitle').textContent=`Buat Sales Order dari Survey · ${data.source_wo_number||''}`;
    scrollTo({top:0,behavior:'smooth'});
  }

  async function focusExisting(){
    for(let i=0;i<50;i++){
      const btn=document.querySelector(`[data-id="${CSS.escape(String(focusSoId))}"]`);
      const row=btn?.closest('tr');
      if(row){row.scrollIntoView({behavior:'smooth',block:'center'});row.style.outline='2px solid var(--accent)';row.style.outlineOffset='-2px';setTimeout(()=>{row.style.outline='';row.style.outlineOffset=''},3000);return;}
      await delay(100);
    }
    throw new Error('Sales Order terkait belum ditemukan pada daftar.');
  }

  async function boot(){
    if(installed)return;installed=true;
    try{
      await waitReady();
      if(focusSoId)await focusExisting();else await prefillSurvey();
    }catch(e){
      installed=false;
      if(typeof toast==='function')toast(e.message||'Gagal membuka Sales Order dari Survey.');else alert(e.message||'Gagal membuka Sales Order dari Survey.');
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
