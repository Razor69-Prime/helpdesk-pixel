/* PXL-URG-0027G — Input Laporan: Teknisi 1 & 2 opsional, capture-path fix. */
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

  function prepareNativeSubmit(){
    if(!canAssign()) return null;
    const tech1=document.getElementById('f-assign-tech');
    const tech2=document.getElementById('f-assign-tech2');
    if(!tech1) return null;

    const first=String(tech1.value||'').trim();
    const second=String(tech2?.value||'').trim();
    let temporaryOption=null;
    let mode='none';

    // Native saveReport mewajibkan tech1. Siapkan nilai sementara SEBELUM inline onclick berjalan.
    if(!first && second){
      tech1.value=second;
      if(tech2) tech2.value='';
      mode='second-only';
    }else if(!first && !second){
      temporaryOption=document.createElement('option');
      temporaryOption.value=SENTINEL;
      temporaryOption.textContent='Tanpa teknisi';
      temporaryOption.hidden=true;
      tech1.appendChild(temporaryOption);
      tech1.value=SENTINEL;
      mode='unassigned';
    }

    if(mode==='none') return null;
    return function restore(){
      if(mode==='unassigned'){
        tech1.value='';
        if(temporaryOption?.isConnected) temporaryOption.remove();
      }else if(mode==='second-only'){
        tech1.value='';
        if(tech2) tech2.value=second;
      }
      updateLabels();
    };
  }

  // Capture listener berjalan sebelum inline onclick="saveReport()".
  // Dengan begitu validasi native membaca nilai sementara yang valid, tanpa mengganti fungsi saveReport global.
  document.addEventListener('click',function(event){
    const button=event.target?.closest?.('#btn-save,[onclick*="saveReport"]');
    if(!button) return;
    const restore=prepareNativeSubmit();
    if(restore) setTimeout(restore,0);
  },true);

  function refresh(){ updateLabels(); }
  document.addEventListener('DOMContentLoaded',refresh);
  document.addEventListener('click',function(event){
    if(event.target?.closest?.('[data-page="report"],[onclick*="showPage"]')) setTimeout(refresh,0);
  },true);
  setTimeout(refresh,0);
  setTimeout(refresh,300);
  setTimeout(refresh,1000);
})();
