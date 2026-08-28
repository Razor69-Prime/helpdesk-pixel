/* PXL-URG-0027D — Input Laporan tanpa teknisi, isolated client flow. */
(function(){
  'use strict';

  const SENTINEL='__PXL_REPORT_UNASSIGNED__';

  function role(){
    try{return String(window.currentUser?.role||'').trim().toLowerCase();}catch(_){return '';}
  }
  function canAssign(){return ['admin','superadmin','manager','operator'].includes(role());}
  function token(){return localStorage.getItem('pixel_token')||'';}

  function updateLabels(){
    const tech1=document.getElementById('f-assign-tech');
    const tech2=document.getElementById('f-assign-tech2');
    if(tech1?.options?.[0]) tech1.options[0].textContent='Teknisi 1 (opsional)...';
    if(tech2?.options?.[0]) tech2.options[0].textContent='Teknisi 2 (opsional)...';
    const group=document.getElementById('f-assign-group');
    const label=group?.querySelector('label');
    if(label) label.innerHTML='Assign Teknisi <span style="font-weight:400;color:var(--muted);text-transform:none">(opsional, maks. 2)</span>';
  }

  async function clearSentinel(ticketId){
    const response=await fetch('/api/report-ticket-unassigned',{
      method:'POST',
      headers:{'Content-Type':'application/json',...(token()?{Authorization:'Bearer '+token()}:{})},
      body:JSON.stringify({ticket_id:ticketId}),
      cache:'no-store'
    });
    let data={};
    try{data=await response.json();}catch(_){data={};}
    if(!response.ok) throw new Error(data.error||'Gagal menyimpan laporan tanpa teknisi.');
    return data.ticket||null;
  }

  function installApiWrapper(){
    if(window.__pxlUrg0027DApiInstalled||typeof window.api!=='function') return;
    window.__pxlUrg0027DApiInstalled=true;
    const originalApi=window.api;
    window.api=async function(method,path,body){
      const methodKey=String(method||'').toUpperCase();
      const pathKey=String(path||'');
      const sentinelRequest=methodKey==='POST' && (pathKey==='/tickets'||pathKey==='/api/tickets') &&
        (String(body?.assigned_to||'').trim()===SENTINEL || (Array.isArray(body?.assigned_to)&&body.assigned_to.some(v=>String(v||'').trim()===SENTINEL)));

      const result=await originalApi.apply(this,arguments);
      if(!sentinelRequest||!result?.id) return result;

      const updated=await clearSentinel(result.id);
      return {
        ...result,
        ...(updated||{}),
        technicians:[],
        technician:null,
        assigned_to:null,
        assigned_to2:null
      };
    };
  }

  function installSaveWrapper(){
    if(window.__pxlUrg0027DSaveInstalled||typeof window.saveReport!=='function') return;
    window.__pxlUrg0027DSaveInstalled=true;
    const originalSave=window.saveReport;

    window.saveReport=async function pxlUrg0027DSaveReport(){
      if(!canAssign()) return originalSave.apply(this,arguments);

      const tech1=document.getElementById('f-assign-tech');
      const tech2=document.getElementById('f-assign-tech2');
      if(!tech1) return originalSave.apply(this,arguments);

      const initial1=String(tech1.value||'').trim();
      const initial2=String(tech2?.value||'').trim();
      let temporaryOption=null;
      let movedSecond=false;

      // Hanya Teknisi 2 dipilih: jadikan sebagai teknisi utama saat payload dibuat.
      if(!initial1&&initial2){
        tech1.value=initial2;
        if(tech2) tech2.value='';
        movedSecond=true;
      }

      // Keduanya kosong: pakai marker internal agar validasi native lewat.
      if(!initial1&&!initial2){
        temporaryOption=document.createElement('option');
        temporaryOption.value=SENTINEL;
        temporaryOption.textContent='Tanpa teknisi';
        temporaryOption.hidden=true;
        tech1.appendChild(temporaryOption);
        tech1.value=SENTINEL;
      }

      try{
        return await originalSave.apply(this,arguments);
      }finally{
        if(temporaryOption){
          tech1.value='';
          temporaryOption.remove();
        }
        if(movedSecond){
          tech1.value='';
          if(tech2) tech2.value=initial2;
        }
        updateLabels();
      }
    };
  }

  function refresh(){
    updateLabels();
    installApiWrapper();
    installSaveWrapper();
  }

  document.addEventListener('DOMContentLoaded',refresh);
  document.addEventListener('click',function(event){
    if(event.target?.closest?.('[data-page="report"], [onclick*="showPage"], #btn-save')) setTimeout(refresh,0);
  },true);
  const observer=new MutationObserver(()=>setTimeout(refresh,0));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(refresh,0);
  setTimeout(refresh,250);
  setTimeout(refresh,1000);
})();
