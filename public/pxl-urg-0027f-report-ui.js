/* PXL-URG-0028E — Optional technician + stable remarks + force native fast WO PDF export. */
(function(){
  'use strict';
  const SENTINEL='__PXL_REPORT_UNASSIGNED__';
  const REMARKS_LABEL='Remarks Teknisi:';

  function restoreNativePdfExport(){
    try{
      const current=window.exportTicketPDF;
      if(current&&current.__pxl0028c&&typeof current.__pxlOriginal==='function'){
        window.exportTicketPDF=current.__pxlOriginal;
        return true;
      }
    }catch(_){ }
    return false;
  }

  function visibleElement(id){
    const nodes=[...document.querySelectorAll('#'+CSS.escape(id))];
    return nodes.find(function(el){
      const style=getComputedStyle(el);
      return style.display!=='none' && style.visibility!=='hidden' && el.getClientRects().length>0;
    }) || nodes[0] || null;
  }
  function nativeElement(id){ return document.getElementById(id); }
  function copyVisibleToNative(id){
    const visible=visibleElement(id), native=nativeElement(id);
    if(!visible||!native||visible===native) return;
    if('value' in visible && 'value' in native) native.value=visible.value;
  }
  function syncVisibleReportForm(){
    ['f-time','f-project','f-customer','f-customer-phone','f-desc','f-status','f-assign-tech','f-assign-tech2'].forEach(copyVisibleToNative);
  }
  function assignmentFormVisible(){
    return [...document.querySelectorAll('#f-assign-group')].some(function(group){
      const style=getComputedStyle(group);
      return style.display!=='none' && style.visibility!=='hidden' && group.getClientRects().length>0;
    });
  }
  function updateLabels(){
    document.querySelectorAll('#f-assign-tech').forEach(function(tech1){if(tech1.options?.[0]) tech1.options[0].textContent='Teknisi 1 (opsional)...';});
    document.querySelectorAll('#f-assign-tech2').forEach(function(tech2){if(tech2.options?.[0]) tech2.options[0].textContent='Teknisi 2 (opsional)...';});
    document.querySelectorAll('#f-assign-group label').forEach(function(label){label.innerHTML='Assign Teknisi <span style="font-weight:400;color:var(--muted);text-transform:none">(opsional, maks. 2)</span>';});
  }
  function normalizeUiText(){
    document.querySelectorAll('.alert.success').forEach(function(alert){
      if(/Laporan berhasil disimpan/i.test(String(alert.textContent||'').trim())) alert.textContent='Work order sudah disubmit.';
    });
    document.querySelectorAll('.ticket-item .ticket-tech').forEach(function(el){
      const text=String(el.textContent||'').replace(/\s+/g,' ').trim();
      if(text==='👷 -'||text==='-'||text==='👷') el.textContent='👷 Belum ditugaskan';
    });
  }
  function prepareNativeSubmit(){
    syncVisibleReportForm();
    if(!assignmentFormVisible()) return null;
    const tech1=nativeElement('f-assign-tech'),tech2=nativeElement('f-assign-tech2');
    if(!tech1) return null;
    const first=String(tech1.value||'').trim(), second=String(tech2?.value||'').trim();
    let temporaryOption=null,mode='none';
    if(!first&&second){tech1.value=second;if(tech2)tech2.value='';mode='second-only';}
    else if(!first&&!second){
      temporaryOption=document.createElement('option');temporaryOption.value=SENTINEL;temporaryOption.textContent='Tanpa teknisi';temporaryOption.hidden=true;
      tech1.appendChild(temporaryOption);tech1.value=SENTINEL;mode='unassigned';
    }
    if(mode==='none') return null;
    return function restore(){
      if(mode==='unassigned'){tech1.value='';if(temporaryOption?.isConnected)temporaryOption.remove();}
      else if(mode==='second-only'){tech1.value='';if(tech2)tech2.value=second;}
      updateLabels();setTimeout(normalizeUiText,0);
    };
  }

  function currentRoleFromUi(){
    const pill=document.querySelector('.user-pill');
    return ['superadmin','admin','manager','operator','technician'].find(r=>pill?.classList.contains(r))||'';
  }
  function canUseRemarks(){return ['superadmin','admin','manager','operator','technician'].includes(currentRoleFromUi());}
  function ticketIdFromCard(card){
    for(const el of card.querySelectorAll('[onclick]')){
      const code=String(el.getAttribute('onclick')||'');
      const m=code.match(/(?:openAssignModal|exportTicketPDF)\('([^']+)'/);
      if(m) return m[1];
    }
    return '';
  }
  function remarksFromDescription(value){
    const m=String(value||'').match(/\n*Remarks Teknisi:\s*\n([\s\S]*)$/i);
    return m?String(m[1]||'').trim():'';
  }
  function installRemarksButtons(){
    if(!canUseRemarks()) return;
    document.querySelectorAll('.ticket-item').forEach(function(card){
      const actions=card.querySelector('.ticket-actions');
      if(!actions||actions.querySelector('.pxl-remarks-btn')) return;
      if([...actions.querySelectorAll('[onclick]')].some(el=>String(el.getAttribute('onclick')||'').includes("'archive'"))) return;
      const ticketId=ticketIdFromCard(card);if(!ticketId)return;
      const hasRemarks=/Remarks Teknisi:/i.test(String(card.querySelector('.ticket-desc')?.textContent||''));
      const btn=document.createElement('button');
      btn.type='button';btn.className='btn sm pxl-remarks-btn';btn.dataset.ticketId=ticketId;
      btn.style.cssText='padding:4px 9px;font-size:11px;background:var(--amber-bg);color:var(--amber);border-color:#FAC775';
      btn.textContent=hasRemarks?'📝 Edit Remarks':'📝 Add Remarks';
      const assign=[...actions.querySelectorAll('button')].find(el=>/Assign/i.test(el.textContent||''));
      if(assign) assign.insertAdjacentElement('afterend',btn); else actions.insertBefore(btn,actions.firstChild);
    });
  }
  function ensureRemarksModal(){
    let modal=document.getElementById('pxl-remarks-modal');if(modal)return modal;
    modal=document.createElement('div');modal.id='pxl-remarks-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.38);z-index:99999;align-items:center;justify-content:center;padding:18px';
    modal.innerHTML='<div style="width:min(520px,100%);background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:12px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.18)"><div id="pxl-remarks-title" style="font-weight:700;font-size:15px;margin-bottom:12px">Add Remarks</div><textarea id="pxl-remarks-text" maxlength="1500" placeholder="Masukkan remarks pekerjaan..." style="width:100%;min-height:120px"></textarea><div id="pxl-remarks-error" style="display:none;color:var(--red,#a32d2d);font-size:12px;margin-top:8px"></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button type="button" class="btn" id="pxl-remarks-cancel">Batal</button><button type="button" class="btn primary" id="pxl-remarks-save">Simpan</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#pxl-remarks-cancel').addEventListener('click',()=>{modal.style.display='none';});
    modal.addEventListener('click',e=>{if(e.target===modal)modal.style.display='none';});
    modal.querySelector('#pxl-remarks-save').addEventListener('click',saveRemarks);
    return modal;
  }
  async function authFetch(url,options={}){
    const token=localStorage.getItem('pixel_token')||'';
    const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(options.headers||{})},cache:'no-store'});
    let data={};try{data=await response.json();}catch(_){data={};}
    if(!response.ok) throw new Error(data.error||'Gagal memproses remarks.');
    return data;
  }
  async function openRemarks(ticketId){
    const modal=ensureRemarksModal(),text=modal.querySelector('#pxl-remarks-text'),error=modal.querySelector('#pxl-remarks-error'),title=modal.querySelector('#pxl-remarks-title');
    modal.dataset.ticketId=ticketId;error.style.display='none';error.textContent='';text.value='';if(title)title.textContent='Add Remarks';modal.style.display='flex';
    try{
      const tickets=await authFetch('/api/tickets');
      const ticket=(Array.isArray(tickets)?tickets:[]).find(t=>String(t.id)===String(ticketId));
      if(!ticket) throw new Error('Work Order tidak ditemukan pada daftar tiket.');
      text.value=remarksFromDescription(ticket.description||'');
      if(title) title.textContent=text.value?'Edit Remarks':'Add Remarks';
      text.focus();
    }catch(err){error.textContent=err.message||String(err);error.style.display='block';}
  }
  function syncSavedDescription(ticketId,data){
    const description=String(data?.description ?? data?.updated?.description ?? '');
    if(!description && data?.remarks) return false;
    try{
      const ticket=allTickets.find(t=>String(t.id)===String(ticketId));
      if(ticket){ticket.description=description;return true;}
    }catch(_){ }
    return false;
  }
  async function saveRemarks(){
    const modal=ensureRemarksModal(),ticketId=modal.dataset.ticketId,text=modal.querySelector('#pxl-remarks-text'),error=modal.querySelector('#pxl-remarks-error'),save=modal.querySelector('#pxl-remarks-save');
    if(!ticketId)return;
    error.style.display='none';save.disabled=true;save.textContent='Menyimpan...';
    try{
      const data=await authFetch('/api/tickets/'+encodeURIComponent(ticketId)+'/technician-remarks',{method:'PATCH',body:JSON.stringify({remarks:String(text.value||'').trim()})});
      syncSavedDescription(ticketId,data);
      try{if(typeof apiShortCache!=='undefined'&&apiShortCache?.clear)apiShortCache.clear();}catch(_){ }
      modal.style.display='none';
      try{if(typeof renderTickets==='function')renderTickets();}catch(_){ }
      setTimeout(function(){normalizeUiText();installRemarksButtons();},30);
      try{if(typeof loadTickets==='function')await loadTickets(true);}catch(_){ }
      setTimeout(function(){normalizeUiText();installRemarksButtons();},80);
    }catch(err){error.textContent=err.message||String(err);error.style.display='block';}
    finally{save.disabled=false;save.textContent='Simpan';}
  }

  document.addEventListener('click',function(event){
    const pdfButton=event.target?.closest?.('[onclick*="exportTicketPDF"]');
    if(pdfButton){restoreNativePdfExport();return;}
    const reportButton=event.target?.closest?.('#btn-save,[onclick*="saveReport"]');
    if(reportButton){try{window.PXL_URG_0010?.refresh?.();}catch(_){ }const restore=prepareNativeSubmit();if(restore)setTimeout(restore,0);return;}
    const remarksButton=event.target?.closest?.('.pxl-remarks-btn');
    if(remarksButton){event.preventDefault();event.stopPropagation();void openRemarks(remarksButton.dataset.ticketId);}
  },true);

  function refresh(){restoreNativePdfExport();updateLabels();normalizeUiText();installRemarksButtons();}
  document.addEventListener('DOMContentLoaded',refresh);
  document.addEventListener('click',function(event){if(event.target?.closest?.('[data-page="report"],[data-page="tickets"],[onclick*="showPage"]'))setTimeout(refresh,0);},true);
  const observer=new MutationObserver(function(){restoreNativePdfExport();normalizeUiText();installRemarksButtons();});
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  setTimeout(refresh,0);setTimeout(refresh,300);setTimeout(refresh,1000);
})();
