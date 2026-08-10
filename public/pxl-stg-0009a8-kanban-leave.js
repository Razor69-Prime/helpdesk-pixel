/* PXL-STG-0009A11 — pencocokan akun teknisi dan render OFF/Cuti yang deterministik. */
(function(){
  'use strict';
  const state={technicians:[],leaves:[],tickets:[]};
  const originalFetch=window.fetch.bind(window);
  const norm=v=>String(v??'').trim().toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateOnly=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||'').slice(0,10))?String(v).slice(0,10):null;
  const covers=(leave,date)=>Boolean(date&&dateOnly(leave.start_date)<=date&&dateOnly(leave.end_date)>=date);
  const keys=value=>value&&typeof value==='object'?[value.id,value.user_id,value.name,value.username].filter(Boolean).map(norm):[norm(value)].filter(Boolean);
  function leaveFor(tech,date){const set=new Set(keys(tech));return state.leaves.find(x=>covers(x,date)&&[x.user_id,x.technician].filter(Boolean).map(norm).some(v=>set.has(v)));}
  function techFromLabel(label){const value=norm(String(label?.textContent||'').replace(/OFF\s*\/\s*CUTI/ig,'').trim());return state.technicians.find(x=>keys(x).includes(value));}
  function ticket(id){return state.tickets.find(x=>String(x.id)===String(id));}

  async function remember(response,url){
    if(!response.ok||!String(url).includes('/api/technician-kanban?'))return;
    try{const data=await response.clone().json();state.technicians=data.technicians||[];state.leaves=data.technician_leaves||[];state.tickets=data.tickets||[];setTimeout(enhance,0);}catch(_){ }
  }
  window.fetch=async function pxlLeaveAwareFetch(input,options){
    const url=typeof input==='string'?input:(input?.url||'');
    let response=await originalFetch(input,options);
    await remember(response,url);
    const method=String(options?.method||'GET').toUpperCase();
    const kanbanAssign=url.includes('/api/technician-kanban/')&&method==='PATCH';
    const reportAssign=/\/api\/tickets(?:\/[^/?]+)?(?:\?|$)/.test(url)&&(method==='POST'||method==='PATCH');
    if((!kanbanAssign&&!reportAssign)||response.status!==409)return response;
    let problem={};try{problem=await response.clone().json();}catch(_){ }
    if(problem.code!=='TECHNICIAN_ON_APPROVED_LEAVE'||problem.can_force!==true)return response;
    const names=(problem.conflicts||[]).map(x=>x.technician).filter(Boolean).join(', ')||'Teknisi';
    const ok=window.confirm(`${names} sedang cuti pada ${problem.scheduled_date||'tanggal tersebut'} dan tidak tersedia pada slot Kanban.\n\nTetap Paksa Assign?`);
    if(!ok)return response;
    let body={};try{body=JSON.parse(options?.body||'{}');}catch(_){body={};}
    response=await originalFetch(input,{...(options||{}),body:JSON.stringify({...body,force_leave_assignment:true})});
    if(response.ok){try{const data=await response.clone().json();if(data.warning)window.setTimeout(()=>alert(data.warning),0);}catch(_){ }}
    return response;
  };

  function enhanceKanban(){
    document.querySelectorAll('.k7k-day[data-date]').forEach(day=>{
      const date=day.dataset.date,off=state.technicians.filter(t=>leaveFor(t,date));
      const rows=state.tickets.filter(t=>t.scheduled_date===date),used=new Set();
      rows.forEach(t=>(t.technicians||[]).forEach(x=>keys(x).forEach(k=>used.add(k))));
      const available=state.technicians.filter(t=>!leaveFor(t,date));
      const usedAvailable=available.filter(t=>keys(t).some(k=>used.has(k)));
      const free=available.filter(t=>!keys(t).some(k=>used.has(k)));
      const cap=day.querySelector('.k7k-cap');if(cap)cap.textContent=`${rows.length} WO · Terisi ${usedAvailable.length}/${available.length} · Sisa ${free.length} · Off ${off.length}`;
      const freeBox=day.querySelector('.k7k-free');if(freeBox)freeBox.innerHTML=`${free.length?'Kosong: '+free.map(x=>esc(x.name)).join(', '):'Tidak ada teknisi kosong'}${off.length?`<div class="k9a8-off">OFF/Cuti: ${off.map(x=>esc(x.name)).join(', ')}</div>`:''}`;
      day.querySelectorAll('.k7k-card[data-id]').forEach(card=>{const t=ticket(card.dataset.id),conflicts=t?.leave_conflicts||[];let warning=card.querySelector('.k9a8-warning');if(!conflicts.length){warning?.remove();return;}if(!warning){warning=document.createElement('div');warning.className='k7k-meta k9a8-warning';card.appendChild(warning);}warning.textContent=`⚠ ${conflicts.map(x=>x.technician).join(', ')} sedang cuti (Paksa Assign)`;});
    });
  }
  function enhanceDailyTimeline(){
    const date=document.querySelector('#k7lDate')?.value;if(!date)return;
    document.querySelectorAll('.k7l-row').forEach(row=>{const label=row.querySelector('.k7l-label'),tech=techFromLabel(label);if(!label||!tech)return;const leave=leaveFor(tech,date);label.classList.toggle('k9a8-off-row',!!leave);let tag=label.querySelector('.k9a8-off-tag');if(!leave){tag?.remove();return;}if(!tag){tag=document.createElement('span');tag.className='k9a8-off-tag';label.appendChild(tag);}tag.textContent='OFF / CUTI';});
  }
  function enhanceWeeklyTimeline(){
    const grid=document.querySelector('.k7l-week');if(!grid)return;const cells=[...grid.children];
    for(let i=8;i+7<cells.length;i+=8){const label=cells[i],tech=techFromLabel(label);if(!tech)continue;for(let d=1;d<=7;d++){const cell=cells[i+d],date=cell?.dataset.weekDate,leave=leaveFor(tech,date);cell?.classList.toggle('k9a8-off-cell',!!leave);let tag=cell?.querySelector(':scope > .k9a8-off-tag');if(!leave){tag?.remove();continue;}if(!tag){tag=document.createElement('span');tag.className='k9a8-off-tag';cell.prepend(tag);}tag.textContent='OFF / CUTI';}}
  }
  function enhance(){enhanceKanban();enhanceDailyTimeline();enhanceWeeklyTimeline();}
  const style=document.createElement('style');style.textContent=`.k9a8-off{color:#a32d2d;font-weight:700;margin-top:4px}.k9a8-warning{color:#a32d2d!important;font-weight:700}.k9a8-off-tag{display:block;width:max-content;margin:4px 0;padding:2px 6px;border-radius:999px;background:#fce8e6;color:#a32d2d;font-size:9px;font-weight:800}.k9a8-off-row{background:#fff0ef!important;color:#a32d2d}.k9a8-off-cell{background:repeating-linear-gradient(135deg,#fff5f4,#fff5f4 7px,#fce8e6 7px,#fce8e6 14px)!important}`;document.head.appendChild(style);
  new MutationObserver(()=>setTimeout(enhance,20)).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.id==='k7lDate'||e.target?.id==='k7lScale')setTimeout(enhance,50);},true);
})();
