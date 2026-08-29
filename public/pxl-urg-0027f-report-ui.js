/* PXL-URG-0032 — Native WO remarks near WO number + isolated PDF remarks appendix. */
(function(){
  'use strict';
  const REV='PXL-URG-0032';
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

  function ticketById(id,source){
    try{
      const list=source==='archive'
        ? (typeof archivedTickets!=='undefined'&&Array.isArray(archivedTickets)?archivedTickets:[])
        : (typeof allTickets!=='undefined'&&Array.isArray(allTickets)?allTickets:[]);
      return list.find(t=>String(t.id)===String(id))||null;
    }catch(_){return null;}
  }

  function ticketIdFromCard(card){
    for(const el of card.querySelectorAll('[onclick]')){
      const code=String(el.getAttribute('onclick')||'');
      const m=code.match(/(?:openAssignModal|exportTicketPDF)\(\s*['"]([^'"]+)['"]/);
      if(m) return m[1];
    }
    return '';
  }

  function renderRemarksOnCard(card,ticket){
    if(!card||!ticket) return;
    const wo=card.querySelector('.ticket-wo');
    if(!wo) return;
    let el=card.querySelector('.pxl-native-remarks-inline');
    const remarks=String(ticket.technician_remarks||'').trim();
    if(!remarks){
      if(el) el.remove();
      return;
    }
    if(!el){
      el=document.createElement('div');
      el.className='pxl-native-remarks-inline';
      el.style.cssText='margin-top:4px;padding:5px 8px;border-left:3px solid #D97706;background:var(--amber-bg,#FAEEDA);color:var(--amber,#854F0B);font-size:11px;line-height:1.4;border-radius:0 5px 5px 0;white-space:pre-wrap;word-break:break-word';
      wo.insertAdjacentElement('afterend',el);
    }
    el.textContent='Remarks: '+remarks;
  }

  function installRemarksButtons(){
    document.querySelectorAll('.ticket-item').forEach(function(card){
      const actions=card.querySelector('.ticket-actions');
      const ticketId=ticketIdFromCard(card);
      if(!ticketId) return;
      const ticket=ticketById(ticketId,'')||ticketById(ticketId,'archive');
      if(!ticket) return;
      renderRemarksOnCard(card,ticket);
      if(!actions||actions.querySelector('.pxl-native-remarks-btn')) return;
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='btn sm pxl-native-remarks-btn';
      btn.dataset.ticketId=ticketId;
      btn.style.cssText='padding:4px 9px;font-size:11px;background:var(--amber-bg);color:var(--amber);border-color:#FAC775';
      btn.textContent=String(ticket.technician_remarks||'').trim()?'📝 Edit Remarks':'📝 Add Remarks';
      const assign=[...actions.querySelectorAll('button')].find(el=>/Assign/i.test(el.textContent||''));
      if(assign) assign.insertAdjacentElement('afterend',btn);
      else actions.insertBefore(btn,actions.firstChild);
    });
  }

  function refreshTicketRemarks(ticketId){
    document.querySelectorAll('.ticket-item').forEach(function(card){
      if(String(ticketIdFromCard(card))!==String(ticketId)) return;
      const ticket=ticketById(ticketId,'')||ticketById(ticketId,'archive');
      if(ticket) renderRemarksOnCard(card,ticket);
    });
  }

  function ensureRemarksModal(){
    let modal=document.getElementById('pxl-native-remarks-modal');
    if(modal) return modal;
    modal=document.createElement('div');
    modal.id='pxl-native-remarks-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.38);z-index:99999;align-items:center;justify-content:center;padding:18px';
    modal.innerHTML='<div style="width:min(520px,100%);background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:12px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.18)"><div id="pxl-native-remarks-title" style="font-weight:700;font-size:15px;margin-bottom:12px">Add Remarks</div><textarea id="pxl-native-remarks-text" maxlength="1500" placeholder="Masukkan remarks pekerjaan..." style="width:100%;min-height:120px"></textarea><div id="pxl-native-remarks-error" style="display:none;color:var(--red,#a32d2d);font-size:12px;margin-top:8px"></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button type="button" class="btn" id="pxl-native-remarks-cancel">Batal</button><button type="button" class="btn primary" id="pxl-native-remarks-save">Simpan</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#pxl-native-remarks-cancel').addEventListener('click',function(){modal.style.display='none';});
    modal.addEventListener('click',function(e){if(e.target===modal)modal.style.display='none';});
    modal.querySelector('#pxl-native-remarks-save').addEventListener('click',saveRemarks);
    return modal;
  }

  function openRemarks(ticketId){
    const ticket=ticketById(ticketId,'')||ticketById(ticketId,'archive');
    if(!ticket){alert('Work Order tidak ditemukan.');return;}
    const modal=ensureRemarksModal();
    const text=modal.querySelector('#pxl-native-remarks-text');
    const title=modal.querySelector('#pxl-native-remarks-title');
    const error=modal.querySelector('#pxl-native-remarks-error');
    modal.dataset.ticketId=ticketId;
    error.style.display='none';error.textContent='';
    text.value=String(ticket.technician_remarks||'');
    title.textContent=text.value.trim()?'Edit Remarks':'Add Remarks';
    modal.style.display='flex';
    setTimeout(()=>text.focus(),0);
  }

  async function saveRemarks(){
    const modal=ensureRemarksModal();
    const ticketId=modal.dataset.ticketId;
    const text=modal.querySelector('#pxl-native-remarks-text');
    const error=modal.querySelector('#pxl-native-remarks-error');
    const save=modal.querySelector('#pxl-native-remarks-save');
    if(!ticketId) return;
    const remarks=String(text.value||'').trim();
    if(remarks.length>1500){error.textContent='Remarks maksimal 1500 karakter.';error.style.display='block';return;}
    save.disabled=true;save.textContent='Menyimpan...';error.style.display='none';
    try{
      const token=localStorage.getItem('pixel_token')||'';
      const response=await fetch('/api/tickets/'+encodeURIComponent(ticketId)+'/remarks',{
        method:'PATCH',
        headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
        body:JSON.stringify({remarks})
      });
      let data={};try{data=await response.json();}catch(_){data={};}
      if(!response.ok) throw new Error(data.error||'Gagal menyimpan remarks teknisi.');
      const ticket=ticketById(ticketId,'')||ticketById(ticketId,'archive');
      if(ticket) ticket.technician_remarks=(data.technician_remarks??remarks)||null;
      document.querySelectorAll('.pxl-native-remarks-btn').forEach(function(btn){
        if(String(btn.dataset.ticketId)===String(ticketId)) btn.textContent=remarks?'📝 Edit Remarks':'📝 Add Remarks';
      });
      refreshTicketRemarks(ticketId);
      modal.style.display='none';
    }catch(e){error.textContent=e.message||String(e);error.style.display='block';}
    finally{save.disabled=false;save.textContent='Simpan';}
  }

  function installPdfRemarksWrapper(){
    const original=window.exportTicketPDF;
    if(typeof original!=='function'||original.__pxl0032Remarks) return;

    const wrapped=async function(id,source='active'){
      const ticket=ticketById(id,source);
      const remarks=String(ticket?.technician_remarks||'').trim();
      if(!remarks) return original.apply(this,arguments);

      const ns=window.jspdf;
      const NativeJsPDF=ns?.jsPDF;
      if(typeof NativeJsPDF!=='function') return original.apply(this,arguments);

      function RemarksJsPDF(){
        const doc=new NativeJsPDF(...arguments);
        const nativeSave=typeof doc.save==='function'?doc.save.bind(doc):null;
        if(nativeSave){
          doc.save=function(filename,options){
            try{
              doc.addPage();
              const pageWidth=doc.internal?.pageSize?.getWidth?.()||210;
              doc.setTextColor(0);
              doc.setDrawColor(0);
              doc.setLineWidth(.4);
              doc.setFont('helvetica','bold');
              doc.setFontSize(13);
              doc.text('REMARKS TEKNISI',15,20);
              doc.setFontSize(8);
              doc.text('No. WO: '+String(ticket?.wo_number||ticket?.wo_no||ticket?.number||'-'),15,28);
              doc.line(15,32,pageWidth-15,32);
              doc.setFont('helvetica','normal');
              doc.setFontSize(9);
              const lines=doc.splitTextToSize(remarks,pageWidth-30);
              doc.text(lines,15,41);
              doc.setFontSize(6.5);
              doc.setTextColor(110);
              doc.text('Remarks tersimpan pada Work Order dan dicetak sebagai bagian report.',15,285);
            }catch(e){console.warn('['+REV+'] render PDF remarks failed',e);}
            return nativeSave(filename,options);
          };
        }
        return doc;
      }

      try{
        Object.keys(NativeJsPDF).forEach(function(k){try{RemarksJsPDF[k]=NativeJsPDF[k];}catch(_){}});
        if(NativeJsPDF.API) RemarksJsPDF.API=NativeJsPDF.API;
        ns.jsPDF=RemarksJsPDF;
        return await original.apply(this,arguments);
      }finally{
        ns.jsPDF=NativeJsPDF;
      }
    };

    wrapped.__pxl0032Remarks=true;
    wrapped.__pxlOriginal=original;
    window.exportTicketPDF=wrapped;
  }

  document.addEventListener('click',function(event){
    const reportButton=event.target?.closest?.('#btn-save,[onclick*="saveReport"]');
    if(reportButton){
      try{window.PXL_URG_0010?.refresh?.();}catch(_){ }
      const restore=prepareNativeSubmit();
      if(restore) setTimeout(restore,0);
      return;
    }

    const remarksButton=event.target?.closest?.('.pxl-native-remarks-btn');
    if(remarksButton){
      event.preventDefault();
      event.stopPropagation();
      openRemarks(remarksButton.dataset.ticketId);
    }
  },true);

  function refresh(){
    updateLabels();
    normalizeUiText();
    installRemarksButtons();
    installPdfRemarksWrapper();
  }

  document.addEventListener('DOMContentLoaded',refresh);
  document.addEventListener('click',function(event){
    if(event.target?.closest?.('[data-page="report"],[data-page="tickets"],[onclick*="showPage"]')){
      setTimeout(refresh,0);
      setTimeout(installRemarksButtons,120);
      setTimeout(installRemarksButtons,500);
      setTimeout(installPdfRemarksWrapper,500);
    }
  },true);

  // Existing lightweight observer only normalizes text; no loader/login hooks are added.
  const observer=new MutationObserver(function(){ normalizeUiText(); });
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});

  setTimeout(refresh,0);
  setTimeout(refresh,300);
  setTimeout(refresh,1000);
  setTimeout(installRemarksButtons,2000);
  setTimeout(installPdfRemarksWrapper,2000);

  window.PXL_URG_0032={revision:REV,refresh,installPdfRemarksWrapper};
})();