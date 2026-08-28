/* PXL-URG-0027 — Input Laporan: Teknisi 1 & 2 opsional. */
(function(){
  'use strict';
  const SENTINEL='__PXL_UNASSIGNED__';

  function canAssign(){
    try{
      const role=String(window.currentUser?.role||'').toLowerCase();
      return ['admin','superadmin','manager','operator'].includes(role);
    }catch(_){return false;}
  }

  function updateLabels(){
    const tech1=document.getElementById('f-assign-tech');
    const tech2=document.getElementById('f-assign-tech2');
    if(tech1?.options?.[0]) tech1.options[0].textContent='Teknisi 1 (opsional)...';
    if(tech2?.options?.[0]) tech2.options[0].textContent='Teknisi 2 (opsional)...';

    const group=document.getElementById('f-assign-group');
    if(group){
      const label=group.querySelector('label');
      if(label) label.innerHTML='Assign Teknisi <span style="font-weight:400;color:var(--muted);text-transform:none">(opsional, maks. 2)</span>';
    }
  }

  function installSaveOverride(){
    if(window.__pxlUrg0027SaveInstalled) return;
    if(typeof window.saveReport!=='function') return;
    window.__pxlUrg0027SaveInstalled=true;
    const original=window.saveReport;

    window.saveReport=async function saveReport0027(){
      const tech1=document.getElementById('f-assign-tech');
      const tech2=document.getElementById('f-assign-tech2');
      const noTechnician=canAssign() && !String(tech1?.value||'').trim() && !String(tech2?.value||'').trim();
      let sentinelOption=null;

      if(noTechnician && tech1){
        sentinelOption=document.createElement('option');
        sentinelOption.value=SENTINEL;
        sentinelOption.textContent='Tanpa teknisi';
        sentinelOption.hidden=true;
        tech1.appendChild(sentinelOption);
        tech1.value=SENTINEL;
      }

      try{
        return await original.apply(this,arguments);
      }finally{
        if(sentinelOption){
          if(tech1) tech1.value='';
          sentinelOption.remove();
          updateLabels();
        }
      }
    };
  }

  function refresh(){
    updateLabels();
    installSaveOverride();
  }

  document.addEventListener('DOMContentLoaded',refresh);
  document.addEventListener('click',function(event){
    if(event.target?.closest?.('[data-page="report"], [onclick*="showPage"], #btn-save')) setTimeout(refresh,0);
  },true);
  const observer=new MutationObserver(()=>setTimeout(refresh,0));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(refresh,0);
  setTimeout(refresh,300);
})();
