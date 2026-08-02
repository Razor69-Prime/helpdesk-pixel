/* PXL-STG-0007X — lengkapi Timeline Mingguan tanpa mengubah Kanban/Custom Date. */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let busy=false,lastSignature='';

  function token(){return localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('pxl_token')||sessionStorage.getItem('token')||'';}
  async function api(url){
    const t=token();
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{...(t?{Authorization:`Bearer ${t}`,'X-Auth-Token':t}:{})}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||d.message||`HTTP ${r.status}`);
    return d;
  }
  function identity(t,i){
    const id=String(t?.id??'').trim();
    if(id)return`id:${id}`;
    const wo=String(t?.wo_number??'').trim();
    if(wo)return`wo:${wo}:${t?.scheduled_date||''}`;
    return`row:${i}:${t?.scheduled_date||''}`;
  }
  function chipIdentity(el){
    const id=String(el?.dataset?.id||'').trim();
    if(id)return`id:${id}`;
    const wo=String(el?.textContent||'').replace(/^\s*\d{2}:\d{2}\s*/,'').replace(/\bi\s*$/,'').trim();
    const date=el?.closest('[data-week-date]')?.dataset?.weekDate||'';
    return wo?`wo:${wo}:${date}`:'';
  }
  function isWeeklyTimeline(){
    return $('[data-k7l-mode="timeline"]')?.classList.contains('active')&&$('#k7lScale')?.value==='week'&&!!$('.k7l-week');
  }
  function techValues(t){
    const source=Array.isArray(t?.technicians)?t.technicians:[];
    return source.flatMap(x=>typeof x==='object'?[x.id,x.name,x.username]:[x]).filter(Boolean).map(v=>String(v).trim().toLowerCase());
  }
  function knownTechValues(){
    return $$('.k7l-week>.k7l-cell.head:nth-child(8n+1)').slice(1).map(x=>String(x.textContent||'').trim().toLowerCase()).filter(Boolean);
  }

  async function completeWeek(){
    if(!isWeeklyTimeline()||busy)return;
    const dates=[...new Set($$('[data-week-date]').map(x=>x.dataset.weekDate).filter(Boolean))].sort();
    if(dates.length!==7)return;
    const currentIds=$$('.k7l-chip').map(chipIdentity).filter(Boolean).sort();
    const signature=`${dates.join(',')}|${currentIds.join(',')}`;
    if(signature===lastSignature)return;
    busy=true;
    try{
      const data=await api(`/api/technician-kanban?date_from=${dates[0]}&date_to=${dates[6]}`);
      const rows=[],seenApi=new Set();
      (data.tickets||[]).forEach((t,i)=>{const key=identity(t,i);if(seenApi.has(key))return;seenApi.add(key);rows.push(t);});
      const rendered=new Set($$('.k7l-chip').map(chipIdentity).filter(Boolean));
      const missing=rows.filter((t,i)=>dates.includes(t.scheduled_date)&&!rendered.has(identity(t,i)));

      $('.k7x-unassigned-label')?.remove();
      $$('.k7x-unassigned-cell').forEach(x=>x.remove());
      if(!missing.length){lastSignature=signature;return;}

      const grid=$('.k7l-week');
      const known=knownTechValues();
      const unassigned=missing.filter(t=>{
        const vals=techValues(t);
        return !vals.length||!vals.some(v=>known.includes(v));
      });
      const remaining=missing.filter(t=>!unassigned.includes(t));
      const display=[...unassigned,...remaining];
      if(!display.length){lastSignature=signature;return;}

      const label=document.createElement('div');
      label.className='k7l-cell head k7x-unassigned-label';
      label.textContent='Belum Ditugaskan';
      grid.appendChild(label);
      for(const date of dates){
        const jobs=display.filter(t=>t.scheduled_date===date);
        const cell=document.createElement('div');
        cell.className='k7l-cell k7x-unassigned-cell';
        cell.dataset.weekDate=date;
        cell.innerHTML=jobs.length?jobs.map((t,i)=>`<span class="k7l-chip" data-id="${esc(t.id||'')}" data-k7x-key="${esc(identity(t,i))}">${esc(t.scheduled_start_time||'-')} ${esc(t.wo_number||'-')}</span>`).join(''):'<span class="k7l-empty">Kosong</span>';
        grid.appendChild(cell);
      }
      lastSignature=`${dates.join(',')}|${$$('.k7l-chip').map(chipIdentity).filter(Boolean).sort().join(',')}`;
    }catch(_){/* pertahankan tampilan existing jika API gagal */}
    finally{busy=false;}
  }

  new MutationObserver(()=>setTimeout(completeWeek,30)).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.id==='k7lScale')setTimeout(()=>{lastSignature='';completeWeek();},80);},true);
  document.addEventListener('click',e=>{if(e.target?.closest('[data-k7l-mode="timeline"],#k7kPrev,#k7kNext,#k7kToday'))setTimeout(()=>{lastSignature='';completeWeek();},180);},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',completeWeek,{once:true});else completeWeek();
})();