/* PXL-URG-0010 — Auto Generate WO Number
 * Scope: Form Laporan Pekerjaan only.
 * Reads existing Daftar Tiket (/api/tickets), finds the highest WO number for
 * the current year, then fills the next number into the WO field as readonly.
 * No existing ticket/WO data is modified.
 */
(()=>{
  'use strict';

  const REV='PXL-URG-0010';
  let busy=false;
  let lastApplied='';

  function token(){
    return localStorage.getItem('pixel_token')||sessionStorage.getItem('pixel_token')||localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('pxl_token')||'';
  }
  function headers(){
    const t=token(),h={Accept:'application/json'};
    if(t){h.Authorization='Bearer '+t;h['X-Auth-Token']=t;}
    return h;
  }
  function rowsOf(data){
    if(Array.isArray(data))return data;
    if(Array.isArray(data?.rows))return data.rows;
    if(Array.isArray(data?.tickets))return data.tickets;
    if(Array.isArray(data?.data))return data.data;
    return [];
  }
  function numberOf(row){
    return String(row?.wo_number||row?.ticket_number||row?.ticket_no||row?.number||row?.no_ticket||row?.nomor_tiket||'').trim();
  }
  function nextWo(rows,year){
    let max=0,width=6;
    const rx=new RegExp('^WO[-\\s]?'+year+'[-\\s]?(\\d+)$','i');
    for(const row of rows){
      const value=numberOf(row);
      const m=value.match(rx);
      if(!m)continue;
      max=Math.max(max,Number(m[1])||0);
      width=Math.max(width,String(m[1]).length);
    }
    return `WO-${year}-${String(max+1).padStart(width,'0')}`;
  }
  function findWoInput(){
    const inputs=[...document.querySelectorAll('input[type="text"],input:not([type])')];
    let hit=inputs.find(el=>/WO-20\d{2}/i.test(el.getAttribute('placeholder')||''));
    if(hit)return hit;
    hit=inputs.find(el=>/^(wo_number|ticket_number|ticket_no|nomor_wo|no_wo)$/i.test(el.name||el.id||''));
    if(hit)return hit;
    for(const label of document.querySelectorAll('label')){
      if(!/NOMOR\s+TIKET.*WO|NOMOR\s+WO/i.test(label.textContent||''))continue;
      if(label.htmlFor){const el=document.getElementById(label.htmlFor);if(el?.tagName==='INPUT')return el;}
      const box=label.parentElement;
      const el=box?.querySelector('input');
      if(el)return el;
    }
    return null;
  }
  function decorate(input,value){
    input.value=value;
    input.readOnly=true;
    input.setAttribute('readonly','readonly');
    input.setAttribute('data-pxl-auto-wo',REV);
    input.title='Nomor WO dibuat otomatis mengikuti nomor terakhir pada Daftar Tiket.';
    input.style.backgroundColor='#f3f2ef';
    input.style.cursor='not-allowed';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  async function apply(force=false){
    const input=findWoInput();
    if(!input||busy)return;
    if(!force&&input.dataset.pxlAutoWo===REV&&input.value)return;
    busy=true;
    try{
      const response=await fetch('/api/tickets',{headers:headers(),cache:'no-store'});
      if(!response.ok)return;
      const data=await response.json().catch(()=>[]);
      const value=nextWo(rowsOf(data),new Date().getFullYear());
      if(value){decorate(input,value);lastApplied=value;}
    }catch(e){console.warn(REV,'gagal membaca nomor WO terakhir',e);}
    finally{busy=false;}
  }

  // Form/tabs PixelApps dirender dinamis. Observer hanya mencari field WO dan
  // tidak mengubah mekanisme navigasi atau submit existing.
  let timer=null;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>apply(false),120);};
  const observer=new MutationObserver(schedule);
  const start=()=>{
    observer.observe(document.documentElement,{childList:true,subtree:true});
    schedule();
    document.addEventListener('click',e=>{
      const text=String(e.target?.textContent||'').toLowerCase();
      if(text.includes('input laporan')||text.includes('laporan pekerjaan'))setTimeout(()=>apply(true),180);
    },true);
    document.addEventListener('reset',()=>setTimeout(()=>apply(true),80),true);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  window.PXL_URG_0010={revision:REV,refresh:()=>apply(true),getLast:()=>lastApplied};
})();
