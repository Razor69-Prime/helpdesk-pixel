/* PXL-URG-0027L — Input Laporan: optional technician + clearer submitted/unassigned UI. */
(function(){
  'use strict';
  const SENTINEL='__PXL_REPORT_UNASSIGNED__';

  function visibleElement(id){
    const nodes=[...document.querySelectorAll('#'+CSS.escape(id))];
    return nodes.find(function(el){
      const style=getComputedStyle(el);
      return style.display!=='none' && style.visibility!=='hidden' && el.getClientRects().length>0;
    }) || nodes[0] || null;
  }

  function nativeElement(id){ return document.getElementById(id); }

  function copyVisibleToNative(id){
    const visible=visibleElement(id);
    const native=nativeElement(id);
    if(!visible||!native||visible===native) return;
    if('value' in visible && 'value' in native) native.value=visible.value;
  }

  function syncVisibleReportForm(){
    // f-wo dikelola eksklusif oleh modul autonumber.
    ['f-time','f-project','f-customer','f-customer-phone','f-desc','f-status','f-assign-tech','f-assign-tech2']
      .forEach(copyVisibleToNative);
  }

  function assignmentFormVisible(){
    const groups=[...document.querySelectorAll('#f-assign-group')];
    return groups.some(function(group){
      const style=getComputedStyle(group);
      return style.display!=='none' && style.visibility!=='hidden' && group.getClientRects().length>0;
    });
  }

  function updateLabels(){
    document.querySelectorAll('#f-assign-tech').forEach(function(tech1){
      if(tech1.options?.[0]) tech1.options[0].textContent='Teknisi 1 (opsional)...';
    });
    document.querySelectorAll('#f-assign-tech2').forEach(function(tech2){
      if(tech2.options?.[0]) tech2.options[0].textContent='Teknisi 2 (opsional)...';
    });
    document.querySelectorAll('#f-assign-group label').forEach(function(label){
      label.innerHTML='Assign Teknisi <span style="font-weight:400;color:var(--muted);text-transform:none">(opsional, maks. 2)</span>';
    });
  }

  function normalizeUiText(){
    document.querySelectorAll('.alert.success').forEach(function(alert){
      const text=String(alert.textContent||'').trim();
      if(/Laporan berhasil disimpan/i.test(text)) alert.textContent='Work order sudah disubmit.';
    });

    document.querySelectorAll('.ticket-item .ticket-tech').forEach(function(el){
      const text=String(el.textContent||'').replace(/\s+/g,' ').trim();
      if(text==='👷 -' || text==='-' || text==='👷') el.textContent='👷 Belum ditugaskan';
    });
  }

  function prepareNativeSubmit(){
    syncVisibleReportForm();
    if(!assignmentFormVisible()) return null;

    const tech1=nativeElement('f-assign-tech');
    const tech2=nativeElement('f-assign-tech2');
    if(!tech1) return null;

    const first=String(tech1.value||'').trim();
    const second=String(tech2?.value||'').trim();
    let temporaryOption=null;
    let mode='none';

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
      setTimeout(normalizeUiText,0);
    };
  }

  document.addEventListener('click',function(event){
    const button=event.target?.closest?.('#btn-save,[onclick*="saveReport"]');
    if(!button) return;
    try{window.PXL_URG_0010?.refresh?.();}catch(_){ }
    const restore=prepareNativeSubmit();
    if(restore) setTimeout(restore,0);
  },true);

  function refresh(){ updateLabels(); normalizeUiText(); }
  document.addEventListener('DOMContentLoaded',refresh);
  document.addEventListener('click',function(event){
    if(event.target?.closest?.('[data-page="report"],[data-page="tickets"],[onclick*="showPage"]')) setTimeout(refresh,0);
  },true);

  const observer=new MutationObserver(function(){ normalizeUiText(); });
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});

  setTimeout(refresh,0);
  setTimeout(refresh,300);
  setTimeout(refresh,1000);
})();
