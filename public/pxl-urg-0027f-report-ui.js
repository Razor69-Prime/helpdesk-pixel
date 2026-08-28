/* PXL-URG-0027F — Input Laporan: Teknisi 1 & 2 optional. */
(function(){
  'use strict';
  const SENTINEL='__PXL_REPORT_UNASSIGNED__';

  function canAssign(){
    const role=String(window.currentUser?.role||'').trim().toLowerCase();
    return ['admin','superadmin','manager','operator'].includes(role);
  }

  function updateLabels(){
    const tech1=document.getElementById('f-assign-tech');
    const tech2=document.getElementById('f-assign-tech2');
    if(tech1?.options?.[0]) tech1.options[0].textContent='Teknisi 1 (opsional)...';
    if(tech2?.options?.[0]) tech2.options[0].textContent='Teknisi 2 (opsional)...';
    const label=document.getElementById('f-assign-group')?.querySelector('label');
    if(label) label.innerHTML='Assign Teknisi <span style="font-weight:400;color:var(--muted);text-transform:none">(opsional, maks. 2)</span>';
  }

  function installSaveWrapper(){
    if(window.__pxlUrg0027FSaveInstalled || typeof window.saveReport!=='function') return;
    window.__pxlUrg0027FSaveInstalled=true;
    const originalSave=window.saveReport;

    window.saveReport=async function pxlUrg0027FSaveReport(){
      if(!canAssign()) return originalSave.apply(this,arguments);

      const tech1=document.getElementById('f-assign-tech');
      const tech2=document.getElementById('f-assign-tech2');
      if(!tech1) return originalSave.apply(this,arguments);

      const first=String(tech1.value||'').trim();
      const second=String(tech2?.value||'').trim();
      let temporaryOption=null;
      let movedSecond=false;

      // If only Teknisi 2 is selected, make it the primary technician for the native flow.
      if(!first && second){
        tech1.value=second;
        if(tech2) tech2.value='';
        movedSecond=true;
      }

      // If both are empty, use an internal marker only for native validation/payload.
      if(!first && !second){
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
          if(tech2) tech2.value=second;
        }
        updateLabels();
      }
    };
  }

  function refresh(){ updateLabels(); installSaveWrapper(); }
  document.addEventListener('DOMContentLoaded',refresh);
  document.addEventListener('click',function(event){
    if(event.target?.closest?.('[data-page="report"],[onclick*="showPage"],#btn-save')) setTimeout(refresh,0);
  },true);
  setTimeout(refresh,0);
  setTimeout(refresh,300);
  setTimeout(refresh,1000);
})();
