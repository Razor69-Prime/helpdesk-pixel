/* PXL-URG-0027J — Auto Generate WO Number: fill visible Input Laporan immediately.
 * Scope: Form Laporan Pekerjaan only.
 * Reads existing Daftar Tiket (/api/tickets), finds the highest WO number for
 * the current year, then fills ALL matching WO fields (including the visible
 * duplicate form) as readonly. No existing ticket/WO data is modified.
 */
(()=>{
  'use strict';

  const REV='PXL-URG-0027J';
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
  function isVisible(el){
    if(!el) return false;
    const style=getComputedStyle(el);
    return style.display!=='none'&&style.visibility!=='hidden'&&el.getClientRects().length>0;
  }
  function findWoInputs(){
    const found=[];
    const add=el=>{if(el?.tagName==='INPUT'&&!found.includes(el))found.push(el);};

    // Exact native id first. querySelectorAll is intentional because current UI can contain duplicate ids.
    document.querySelectorAll('#f-wo').forEach(add);

    // Known field names/ids.
    document.querySelectorAll('input[type="text"],input:not([type])').forEach(el=>{
      if(/^(f-wo|wo_number|ticket_number|ticket_no|nomor_wo|no_wo)$/i.test(el.name||el.id||''))add(el);
    });

    // Label-based fallback for dynamically rendered copies.
    document.querySelectorAll('label').forEach(label=>{
      if(!/NOMOR\s+TIKET.*WO|NOMOR\s+WO/i.test(label.textContent||''))return;
      if(label.htmlFor)add(document.getElementById(label.htmlFor));
      add(label.parentElement?.querySelector('input'));
    });

    // Visible form first, while still updating hidden/native duplicates too.
    return found.sort((a,b)=>Number(isVisible(b))-Number(isVisible(a)));
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
  function decorateAll(value){
    const inputs=findWoInputs();
    if(!inputs.length)return false;
    inputs.forEach(input=>decorate(input,value));
    return true;
  }
  async function apply(force=false){
    const inputs=findWoInputs();
    if(!inputs.length||busy)return;
    if(!force&&lastApplied&&inputs.every(input=>input.value===lastApplied))return;
    busy=true;
    try{
      const response=await fetch('/api/tickets',{headers:headers(),cache:'no-store'});
      if(!response.ok)return;
      const data=await response.json().catch(()=>[]);
      const value=nextWo(rowsOf(data),new Date().getFullYear());
      if(value&&decorateAll(value))lastApplied=value;
    }catch(e){console.warn(REV,'gagal membaca nomor WO terakhir',e);}
    finally{busy=false;}
  }

  let timer=null;
  const schedule=(delay=80,force=false)=>{clearTimeout(timer);timer=setTimeout(()=>apply(force),delay);};
  const refreshBurst=()=>{
    apply(true);
    setTimeout(()=>apply(true),150);
    setTimeout(()=>apply(true),500);
    setTimeout(()=>apply(true),1200);
  };
  const observer=new MutationObserver(()=>schedule(80,false));
  const start=()=>{
    observer.observe(document.documentElement,{childList:true,subtree:true});
    refreshBurst();
    document.addEventListener('click',e=>{
      const text=String(e.target?.textContent||'').toLowerCase();
      if(text.includes('input laporan')||text.includes('laporan pekerjaan'))refreshBurst();
    },true);
    document.addEventListener('reset',()=>setTimeout(refreshBurst,50),true);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  window.PXL_URG_0010={revision:REV,refresh:refreshBurst,getLast:()=>lastApplied};
})();
