/* PXL-URG-0032A — Keep Add/Edit Remarks available after Daftar Tiket auto refresh. */
(function(){
  'use strict';
  const REV='PXL-URG-0032A';
  let installTimer=null;

  function activeTickets(){
    try{return typeof allTickets!=='undefined'&&Array.isArray(allTickets)?allTickets:[];}catch(_){return [];}
  }
  function archiveTickets(){
    try{return typeof archivedTickets!=='undefined'&&Array.isArray(archivedTickets)?archivedTickets:[];}catch(_){return [];}
  }
  function allKnownTickets(){return activeTickets().concat(archiveTickets());}
  function ticketById(id){return allKnownTickets().find(t=>String(t?.id)===String(id))||null;}

  function woValue(ticket){
    return String(ticket?.wo_number||ticket?.wo_no||ticket?.work_order_number||ticket?.work_order_no||ticket?.wo||ticket?.number||ticket?.ticket_no||'').trim().toUpperCase();
  }

  function resolveTicket(card){
    if(!card) return null;
    const ids=[];
    ['ticketId','id','ticket'].forEach(k=>{if(card.dataset?.[k])ids.push(card.dataset[k]);});
    card.querySelectorAll('[data-ticket-id],[data-id],[data-ticket]').forEach(el=>{
      const v=el.dataset?.ticketId||el.dataset?.id||el.dataset?.ticket;
      if(v) ids.push(v);
    });
    for(const id of ids){const t=ticketById(id);if(t)return t;}

    for(const el of card.querySelectorAll('[onclick]')){
      const code=String(el.getAttribute('onclick')||'');
      let m=code.match(/(?:openAssignModal|exportTicketPDF|deleteTicket|openPhotoModal|showTicket|openTicket)\(\s*['\"]([^'\"]+)['\"]/i);
      if(!m) m=code.match(/\(\s*['\"]([0-9a-f-]{8,})['\"]/i);
      if(m){const t=ticketById(m[1]);if(t)return t;}
    }

    const text=String(card.textContent||'').toUpperCase();
    const woMatch=text.match(/WO-\d{4}-\d{4,}/);
    if(woMatch){
      const wanted=woMatch[0];
      const t=allKnownTickets().find(row=>woValue(row)===wanted);
      if(t)return t;
    }
    return null;
  }

  function findWoAnchor(card){
    const native=card.querySelector('.ticket-wo,.wo-number,.ticket-number,[data-wo]');
    if(native)return native;
    const nodes=[...card.querySelectorAll('div,span,p')];
    return nodes.find(el=>/^\s*WO-\d{4}-\d{4,}\s*$/i.test(String(el.textContent||'').trim()))||null;
  }

  function renderInline(card,ticket){
    if(!card||!ticket)return;
    const remarks=String(ticket.technician_remarks||'').trim();
    let el=card.querySelector('.pxl-native-remarks-inline');
    if(!remarks){if(el)el.remove();return;}
    if(!el){
      const anchor=findWoAnchor(card);
      if(!anchor)return;
      el=document.createElement('div');
      el.className='pxl-native-remarks-inline';
      el.style.cssText='margin-top:4px;padding:5px 8px;border-left:3px solid #D97706;background:var(--amber-bg,#FAEEDA);color:var(--amber,#854F0B);font-size:11px;line-height:1.4;border-radius:0 5px 5px 0;white-space:pre-wrap;word-break:break-word';
      anchor.insertAdjacentElement('afterend',el);
    }
    el.textContent='Remarks: '+remarks;
  }

  function ensureModal(){
    let modal=document.getElementById('pxl-0032a-remarks-modal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='pxl-0032a-remarks-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100000;align-items:center;justify-content:center;padding:18px';
    modal.innerHTML='<div style="width:min(520px,100%);background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:12px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.2)"><div id="pxl-0032a-title" style="font-weight:700;font-size:15px;margin-bottom:12px">Add Remarks</div><textarea id="pxl-0032a-text" maxlength="1500" placeholder="Masukkan remarks pekerjaan..." style="width:100%;min-height:120px"></textarea><div id="pxl-0032a-error" style="display:none;color:var(--red,#a32d2d);font-size:12px;margin-top:8px"></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button type="button" class="btn" id="pxl-0032a-cancel">Batal</button><button type="button" class="btn primary" id="pxl-0032a-save">Simpan</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#pxl-0032a-cancel').addEventListener('click',()=>modal.style.display='none');
    modal.addEventListener('click',e=>{if(e.target===modal)modal.style.display='none';});
    modal.querySelector('#pxl-0032a-save').addEventListener('click',saveRemarks);
    return modal;
  }

  function openRemarks(ticket){
    if(!ticket)return;
    const modal=ensureModal();
    modal.dataset.ticketId=String(ticket.id);
    const text=modal.querySelector('#pxl-0032a-text');
    const title=modal.querySelector('#pxl-0032a-title');
    const error=modal.querySelector('#pxl-0032a-error');
    text.value=String(ticket.technician_remarks||'');
    title.textContent=text.value.trim()?'Edit Remarks':'Add Remarks';
    error.style.display='none';error.textContent='';
    modal.style.display='flex';
    setTimeout(()=>text.focus(),0);
  }

  async function saveRemarks(){
    const modal=ensureModal();
    const id=modal.dataset.ticketId;
    const text=modal.querySelector('#pxl-0032a-text');
    const error=modal.querySelector('#pxl-0032a-error');
    const save=modal.querySelector('#pxl-0032a-save');
    const remarks=String(text.value||'').trim();
    if(!id)return;
    save.disabled=true;save.textContent='Menyimpan...';error.style.display='none';
    try{
      const token=localStorage.getItem('pixel_token')||'';
      const response=await fetch('/api/tickets/'+encodeURIComponent(id)+'/remarks',{
        method:'PATCH',
        headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
        body:JSON.stringify({remarks})
      });
      let data={};try{data=await response.json();}catch(_){ }
      if(!response.ok)throw new Error(data.error||'Gagal menyimpan remarks teknisi.');
      const ticket=ticketById(id);
      if(ticket)ticket.technician_remarks=(data.technician_remarks??remarks)||null;
      modal.style.display='none';
      install();
    }catch(e){error.textContent=e.message||String(e);error.style.display='block';}
    finally{save.disabled=false;save.textContent='Simpan';}
  }

  function install(){
    document.querySelectorAll('.ticket-item').forEach(card=>{
      const ticket=resolveTicket(card);
      if(!ticket)return;
      renderInline(card,ticket);
      const actions=card.querySelector('.ticket-actions');
      if(!actions)return;
      let btn=actions.querySelector('.pxl-native-remarks-btn');
      if(btn){
        btn.dataset.ticketId=String(ticket.id);
        btn.textContent=String(ticket.technician_remarks||'').trim()?'📝 Edit Remarks':'📝 Add Remarks';
        return;
      }
      btn=document.createElement('button');
      btn.type='button';
      btn.className='btn sm pxl-native-remarks-btn pxl-0032a-remarks-btn';
      btn.dataset.ticketId=String(ticket.id);
      btn.style.cssText='padding:4px 9px;font-size:11px;background:var(--amber-bg,#FAEEDA);color:var(--amber,#854F0B);border-color:#FAC775';
      btn.textContent=String(ticket.technician_remarks||'').trim()?'📝 Edit Remarks':'📝 Add Remarks';
      const assign=[...actions.querySelectorAll('button')].find(el=>/Assign/i.test(el.textContent||''));
      if(assign)assign.insertAdjacentElement('afterend',btn);else actions.insertBefore(btn,actions.firstChild);
    });
  }

  function scheduleInstall(){clearTimeout(installTimer);installTimer=setTimeout(install,80);}

  document.addEventListener('click',function(e){
    const btn=e.target?.closest?.('.pxl-native-remarks-btn');
    if(!btn)return;
    const ticket=ticketById(btn.dataset.ticketId)||resolveTicket(btn.closest('.ticket-item'));
    if(!ticket)return;
    e.preventDefault();e.stopImmediatePropagation();
    openRemarks(ticket);
  },true);

  const observer=new MutationObserver(scheduleInstall);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',install);
  setTimeout(install,0);setTimeout(install,300);setTimeout(install,1000);setInterval(install,5000);
  window.PXL_URG_0032A={revision:REV,refresh:install};
})();