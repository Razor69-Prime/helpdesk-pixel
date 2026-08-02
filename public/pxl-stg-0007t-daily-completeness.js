/* PXL-STG-0007T — Timeline harian selalu menampilkan seluruh WO unik pada tanggal terpilih. */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const pad=n=>String(n).padStart(2,'0');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').trim().toLowerCase();
  const minutes=v=>{const [h,m]=String(v||'08:00').slice(0,5).split(':').map(Number);return (Number.isFinite(h)?h:8)*60+(Number.isFinite(m)?m:0);};
  const ticketKey=(t,index)=>{
    const id=String(t?.id??'').trim();
    if(id)return `id:${id}`;
    const wo=String(t?.wo_number??'').trim();
    if(wo)return `wo:${wo}|${t?.scheduled_date||''}`;
    return `row:${index}|${t?.scheduled_date||''}|${t?.scheduled_start_time||''}`;
  };
  const assignmentValues=v=>{
    if(v==null)return[];
    if(typeof v==='object')return [v.id,v.user_id,v.technician_id,v.name,v.username,v.email].filter(Boolean).map(norm);
    return [norm(v)];
  };
  const ticketAssignments=t=>{
    const values=[];
    (Array.isArray(t?.technicians)?t.technicians:[]).forEach(v=>values.push(...assignmentValues(v)));
    [t?.technician,t?.technician_id,t?.technician_1,t?.technician_1_id,t?.technician_2,t?.technician_2_id,t?.assigned_to,t?.assigned_to_id].forEach(v=>values.push(...assignmentValues(v)));
    return new Set(values.filter(Boolean));
  };
  const techValues=t=>new Set([t?.id,t?.name,t?.username,t?.email].filter(Boolean).map(norm));
  let timer=null,busy=false,lastSignature='';

  function token(){return localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('pxl_token')||sessionStorage.getItem('token')||'';}
  async function api(url){const value=token();const response=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{...(value?{Authorization:`Bearer ${value}`,'X-Auth-Token':value}:{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||data.message||`HTTP ${response.status}`);return data;}
  function dailyActive(){return $('[data-k7l-mode="timeline"]')?.classList.contains('active')&&($('#k7lScale')?.value||'day')==='day'&&!!$('#k7lDate')&&!!$('.k7l-grid');}
  function selectedDate(){return $('#k7lDate')?.value||'';}

  function buildBar(ticket,index){
    const start=8*60,end=20*60,span=end-start;
    const raw=Math.max(start,Math.min(end-1,minutes(ticket.scheduled_start_time)));
    const duration=Math.max(30,Number(ticket.estimated_duration_minutes||60));
    const left=(raw-start)/span*100;
    const width=Math.max(4,Math.min(100-left,duration/span*100));
    const id=String(ticket.id??'').trim();
    const wo=String(ticket.wo_number||'WO');
    const time=String(ticket.scheduled_start_time||'-').slice(0,5);
    return `<div class="k7l-bar k7t-bar" data-id="${esc(id)}" data-k7t-key="${esc(ticketKey(ticket,index))}" style="left:${left}%;width:${width}%;top:${8+index*54}px" title="${esc(wo)} · ${esc(time)}"><span class="k7r-wo">${esc(wo)}</span><span class="k7r-time">${esc(time)}</span></div>`;
  }

  function render(data,date){
    const grid=$('.k7l-grid');if(!grid)return;
    const source=(data.tickets||[]).filter(t=>String(t.scheduled_date||'').slice(0,10)===date);
    const unique=[];const seen=new Set();
    source.forEach((ticket,index)=>{const key=ticketKey(ticket,index);if(seen.has(key))return;seen.add(key);unique.push(ticket);});

    const technicians=Array.isArray(data.technicians)?data.technicians:[];
    const groups=technicians.map(tech=>({tech,name:tech.name||tech.username||String(tech.id||'Teknisi'),jobs:[]}));
    const unmapped=[];
    unique.forEach(ticket=>{
      const assignments=ticketAssignments(ticket);
      const group=groups.find(item=>[...techValues(item.tech)].some(value=>assignments.has(value)));
      if(group)group.jobs.push(ticket);else unmapped.push(ticket);
    });

    const hourLabels=[];
    for(let value=8*60;value<=20*60;value+=30){const h=Math.floor(value/60),m=value%60,left=(value-8*60)/(12*60)*100;hourLabels.push(`<span class="k7l-hour" style="left:${left}%">${pad(h)}:${pad(m)}</span>`);}
    const rows=[];
    groups.forEach(group=>{
      const height=Math.max(58,group.jobs.length*54+12);
      rows.push(`<div class="k7l-row"><div class="k7l-label">${esc(group.name)}</div><div class="k7l-track" data-tech="${esc(group.tech.id||group.name)}" style="min-height:${height}px">${group.jobs.map(buildBar).join('')||'<span class="k7l-empty" style="position:absolute;left:10px;top:20px">Kosong</span>'}</div></div>`);
    });
    if(unmapped.length){const height=Math.max(66,unmapped.length*54+12);rows.push(`<div class="k7l-row k7r-unmapped"><div class="k7l-label">Belum Terpetakan</div><div class="k7l-track" style="min-height:${height}px">${unmapped.map(buildBar).join('')}</div></div>`);}
    grid.innerHTML=`<div class="k7l-headrow"><div class="k7l-label">Teknisi</div><div class="k7l-hours">${hourLabels.join('')}</div></div>${rows.join('')}`;
    grid.dataset.k7tDate=date;
    grid.dataset.k7tCount=String(unique.length);
  }

  async function rebuild(){
    if(!dailyActive()||busy)return;
    const date=selectedDate();if(!date)return;
    busy=true;
    try{
      const data=await api(`/api/technician-kanban?date_from=${encodeURIComponent(date)}&date_to=${encodeURIComponent(date)}`);
      const keys=(data.tickets||[]).filter(t=>String(t.scheduled_date||'').slice(0,10)===date).map(ticketKey).sort();
      const signature=`${date}|${keys.join(',')}`;
      const grid=$('.k7l-grid');
      if(signature!==lastSignature||grid?.dataset.k7tDate!==date||Number(grid?.dataset.k7tCount||0)!==new Set(keys).size){render(data,date);lastSignature=signature;}
    }catch(_){/* Biarkan tampilan sebelumnya jika request gagal. */}
    finally{busy=false;}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(rebuild,80);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('change',event=>{if(event.target?.id==='k7lDate'||event.target?.id==='k7lScale'){lastSignature='';schedule();}},true);
  document.addEventListener('click',event=>{if(event.target?.closest('[data-k7l-mode="timeline"],#k7kToday')){lastSignature='';setTimeout(schedule,160);}},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
