/* PXL-URG-0038A — Read-only ticket detail modal. Robust PWA/mobile ticket resolver; UI only. */
(function(){
  'use strict';
  const REV='PXL-URG-0038A';
  const text=v=>String(v??'').trim();
  const first=(obj,keys)=>{for(const k of keys){const v=obj?.[k];if(v!==undefined&&v!==null&&text(v)!=='')return v;}return '';};
  const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const prettyDate=v=>{if(!v)return '-';const d=new Date(v);if(!Number.isFinite(d.getTime()))return text(v)||'-';try{return d.toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'});}catch(_){return d.toLocaleString('id-ID');}};

  function activeTickets(){try{return typeof allTickets!=='undefined'&&Array.isArray(allTickets)?allTickets:[];}catch(_){return[];}}
  function archiveTickets(){try{return typeof archivedTickets!=='undefined'&&Array.isArray(archivedTickets)?archivedTickets:[];}catch(_){return[];}}
  function allKnown(){return activeTickets().concat(archiveTickets());}
  function byId(id){return allKnown().find(t=>String(t?.id)===String(id))||null;}
  function woValue(t){return text(first(t,['wo_number','wo_no','work_order_number','work_order_no','wo','number','ticket_no','ticket_number'])).toUpperCase();}

  function resolveTicket(card){
    if(!card)return null;
    const ids=[];
    ['ticketId','id','ticket'].forEach(k=>{if(card.dataset?.[k])ids.push(card.dataset[k]);});
    card.querySelectorAll('[data-ticket-id],[data-id],[data-ticket]').forEach(el=>{
      const v=el.dataset?.ticketId||el.dataset?.id||el.dataset?.ticket;
      if(v)ids.push(v);
    });
    for(const id of ids){const t=byId(id);if(t)return t;}

    for(const el of card.querySelectorAll('[onclick]')){
      const code=text(el.getAttribute('onclick'));
      let m=code.match(/(?:openAssignModal|exportTicketPDF|deleteTicket|openPhotoModal|showTicket|openTicket|openRemarks)\(\s*['\"]([^'\"]+)['\"]/i);
      if(!m)m=code.match(/\(\s*['\"]([0-9a-f-]{8,})['\"]/i);
      if(m){const t=byId(m[1]);if(t)return t;}
    }

    const cardText=text(card.textContent).toUpperCase();
    const woMatch=cardText.match(/WO-\d{4}-\d{4,}/);
    if(woMatch){const wanted=woMatch[0];const t=allKnown().find(row=>woValue(row)===wanted);if(t)return t;}
    return null;
  }

  function sourceOf(t){return archiveTickets().some(x=>String(x?.id)===String(t?.id))?'archive':'active';}
  function row(label,value,wide=false){const v=text(value)||'-';return `<div style="${wide?'grid-column:1/-1;':''}min-width:0"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#777);margin-bottom:3px">${esc(label)}</div><div style="font-size:13px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere">${esc(v)}</div></div>`;}
  function detailHtml(t){
    const wo=first(t,['wo_number','wo_no','number','ticket_number','code']);
    const project=first(t,['project_name','project','title','subject']);
    const customer=first(t,['customer_name','customer','client_name','client']);
    const phone=first(t,['customer_phone','phone','phone_number','contact_phone','whatsapp']);
    const location=first(t,['location','address','customer_address','site_address','alamat']);
    const desc=first(t,['description','desc','problem','issue','work_description','notes']);
    const remarks=first(t,['technician_remarks','remarks']);
    const status=first(t,['status']);
    const tech1=first(t,['technician_name','technician','assigned_to_name','assigned_to']);
    const tech2=first(t,['technician2_name','technician_2_name','technician2','assigned_to_2_name']);
    const date=first(t,['worked_at','work_date','scheduled_at','scheduled_date','date','created_at']);
    const created=first(t,['created_at']);
    const requester=first(t,['created_by_name','created_by','requester_name','requester']);
    const maps=first(t,['maps_url','map_url','google_maps_url','location_url']);
    return `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 18px">${row('No. WO / Tiket',wo)}${row('Status',status)}${row('Project / Pekerjaan',project,true)}${row('Customer',customer)}${row('Nomor Telepon',phone)}${row('Lokasi',location,true)}${row('Tanggal Pekerjaan',prettyDate(date))}${row('Dibuat',prettyDate(created))}${row('Teknisi 1',tech1)}${row('Teknisi 2',tech2)}${row('Dibuat / Dilaporkan Oleh',requester,true)}${row('Deskripsi / Informasi Pekerjaan',desc,true)}${row('Remarks Teknisi',remarks,true)}${maps?`<div style="grid-column:1/-1"><a href="${esc(maps)}" target="_blank" rel="noopener" class="btn sm">📍 Buka Google Maps</a></div>`:''}</div>`;
  }

  function ensureModal(){
    let modal=document.getElementById('pxl-0038-ticket-detail-modal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='pxl-0038-ticket-detail-modal';
    modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:100002;align-items:center;justify-content:center;padding:14px;overflow:auto';
    modal.innerHTML=`<div style="width:min(720px,100%);max-height:92vh;overflow:auto;background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:12px;box-shadow:0 16px 45px rgba(0,0,0,.22)"><div style="position:sticky;top:0;background:var(--surface,#fff);z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 17px;border-bottom:1px solid var(--border,#e5e5e5)"><div><div style="font-size:16px;font-weight:700">Detail Work Order</div><div id="pxl-0038-sub" style="font-size:11px;color:var(--muted,#777);margin-top:2px"></div></div><button type="button" class="btn sm" id="pxl-0038-close">Tutup</button></div><div id="pxl-0038-body" style="padding:17px"></div><div style="position:sticky;bottom:0;background:var(--surface,#fff);display:flex;justify-content:flex-end;gap:8px;padding:12px 17px;border-top:1px solid var(--border,#e5e5e5)"><button type="button" class="btn" id="pxl-0038-pdf">📄 Download PDF</button><button type="button" class="btn primary" id="pxl-0038-done">Selesai</button></div></div>`;
    document.body.appendChild(modal);
    const close=()=>modal.style.display='none';
    modal.querySelector('#pxl-0038-close').onclick=close;modal.querySelector('#pxl-0038-done').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    modal.querySelector('#pxl-0038-pdf').onclick=()=>{const id=modal.dataset.ticketId,source=modal.dataset.source||'active';if(typeof window.exportTicketPDF==='function')window.exportTicketPDF(id,source);else alert('Fungsi PDF belum tersedia.');};
    return modal;
  }

  function openTicketDetail(ticket){
    if(!ticket)return alert('Detail Work Order tidak ditemukan.');
    const modal=ensureModal();
    modal.dataset.ticketId=String(ticket.id);modal.dataset.source=sourceOf(ticket);
    modal.querySelector('#pxl-0038-body').innerHTML=detailHtml(ticket);
    modal.querySelector('#pxl-0038-sub').textContent=text(first(ticket,['wo_number','wo_no','number','ticket_number']))||'Informasi tiket';
    modal.style.display='flex';
  }

  function installButtons(){
    document.querySelectorAll('.ticket-item').forEach(card=>{
      const actions=card.querySelector('.ticket-actions');if(!actions)return;
      const ticket=resolveTicket(card);if(!ticket)return;
      let btn=actions.querySelector('.pxl-0038-detail-btn');
      if(!btn){
        btn=document.createElement('button');btn.type='button';btn.className='btn sm pxl-0038-detail-btn';btn.textContent='🔎 Detail';btn.style.cssText='min-width:0';
        const photo=[...actions.querySelectorAll('button,a')].find(el=>/Foto/i.test(text(el.textContent)));
        if(photo)photo.insertAdjacentElement('afterend',btn);else actions.appendChild(btn);
      }
      btn.dataset.ticketId=String(ticket.id);
    });
  }

  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('.pxl-0038-detail-btn');if(!btn)return;
    const ticket=byId(btn.dataset.ticketId)||resolveTicket(btn.closest('.ticket-item'));
    if(!ticket)return;
    e.preventDefault();e.stopImmediatePropagation();openTicketDetail(ticket);
  },true);

  let timer=null;const schedule=()=>{clearTimeout(timer);timer=setTimeout(installButtons,80);};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',installButtons);
  setTimeout(installButtons,0);setTimeout(installButtons,300);setTimeout(installButtons,1000);setInterval(installButtons,5000);
  window.PXL_URG_0038={revision:REV,refresh:installButtons,open:id=>openTicketDetail(byId(id))};
})();
