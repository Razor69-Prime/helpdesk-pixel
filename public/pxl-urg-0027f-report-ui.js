/* PXL-URG-0027I — Input Laporan: optional technician + sync visible form to native ids. */
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
    ['f-wo','f-time','f-project','f-customer','f-customer-phone','f-desc','f-status','f-assign-tech','f-assign-tech2']
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
    };
  }

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
