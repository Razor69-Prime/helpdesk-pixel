/* PXL-URG-0133 — WO number generator from authenticated read-only endpoint.
 * The endpoint considers active and archived WO numbers; preview and Submit
 * both refresh the latest number. All matching WO inputs are kept in sync.
 * No timer polling, MutationObserver or changes to ticket/WO data.
 */
(()=>{
  'use strict';

  const REV='PXL-URG-0133';
  let pending=null;
  let lastApplied='';

  function token(){
    return localStorage.getItem('pixel_token')||sessionStorage.getItem('pixel_token')||localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('pxl_token')||'';
  }
  function headers(){
    const t=token(),h={Accept:'application/json'};
    if(t){h.Authorization='Bearer '+t;h['X-Auth-Token']=t;}
    return h;
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
    if(!inputs.length)return '';
    if(pending)return pending;
    if(!force&&lastApplied&&inputs.every(input=>input.value===lastApplied))return lastApplied;
    pending=(async()=>{
      const response=await fetch('/api/tickets/next-number',{headers:headers(),cache:'no-store'});
      if(!response.ok)throw new Error('GET /api/tickets/next-number: '+response.status);
      const data=await response.json();
      const value=String(data?.wo_number||'').trim();
      if(!/^WO-\d{4}-\d{6,}$/.test(value))throw new Error('Nomor WO dari server tidak valid.');
      if(value&&decorateAll(value))lastApplied=value;
      return value;
    })();
    try{return await pending;}
    catch(e){console.warn(REV,'gagal membaca nomor WO terakhir',e);return ''}
    finally{pending=null;}
  }

  // No global MutationObserver or burst polling. Regenerate on page opening and Submit.
  const start=()=>{
    apply(true);
    document.addEventListener('click',e=>{
      const tab=e.target?.closest?.('[data-tab-id="report"],[data-page="report"]');
      const text=String(e.target?.textContent||'').toLowerCase();
      if(tab||text.includes('input wo')||text.includes('input laporan')||text.includes('laporan pekerjaan'))setTimeout(()=>apply(true),0);
    },true);
    document.addEventListener('reset',()=>setTimeout(()=>apply(true),0),true);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  window.PXL_URG_0010={revision:REV,refresh:()=>apply(true),ensure:()=>apply(true),getLast:()=>lastApplied};
})();
